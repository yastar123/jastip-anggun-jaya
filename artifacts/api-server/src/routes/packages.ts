import { Router } from "express";
import { db, packagesTable, usersTable } from "@workspace/db";
import { eq, and, gte, lte, or, ilike, inArray } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";
import crypto from "crypto";

const router = Router();

function generateBarcode(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `JAJ-${ts}-${rnd}`;
}

function buildStatus(status: string | undefined) {
  if (!status || status === "all") return undefined;
  return status as "pending" | "in_transit" | "ready" | "picked_up";
}

// GET /api/packages
router.get("/", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { status, customerId, adminId, dateFrom, dateTo, search } = req.query as any;

    const customers = await db.select({ id: usersTable.id, name: usersTable.name, phone: usersTable.phone }).from(usersTable).where(eq(usersTable.role, "customer"));
    const admins = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.role, "admin"));
    const customerMap = new Map(customers.map(c => [c.id, c]));
    const adminMap = new Map(admins.map(a => [a.id, a]));

    let rows = await db.select().from(packagesTable).orderBy(packagesTable.createdAt);

    // Filter by role
    if (user.role === "customer") {
      rows = rows.filter(p => p.customerId === user.id);
    }

    // Filters
    if (status) rows = rows.filter(p => p.status === status);
    if (customerId) rows = rows.filter(p => p.customerId === Number(customerId));
    if (adminId) rows = rows.filter(p => p.adminId === Number(adminId));
    if (dateFrom) rows = rows.filter(p => new Date(p.createdAt) >= new Date(dateFrom));
    if (dateTo) rows = rows.filter(p => new Date(p.createdAt) <= new Date(dateTo + "T23:59:59Z"));
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter(p =>
        p.resiNumber.toLowerCase().includes(s) ||
        p.itemName.toLowerCase().includes(s) ||
        p.barcode.toLowerCase().includes(s)
      );
    }

    const result = rows.map(p => ({
      ...p,
      weight: p.weight ? Number(p.weight) : null,
      customerName: customerMap.get(p.customerId)?.name ?? "",
      customerPhone: customerMap.get(p.customerId)?.phone ?? "",
      adminName: p.adminId ? adminMap.get(p.adminId)?.name ?? null : null,
      pickedUpAt: p.pickedUpAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));

    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/packages
router.post("/", requireAuth, requireRole("admin", "owner"), async (req, res) => {
  try {
    const user = (req as any).user;
    const { resiNumber, itemName, weight, notes, customerId } = req.body;
    if (!resiNumber || !itemName || !customerId) {
      res.status(400).json({ error: "resiNumber, itemName, customerId required" });
      return;
    }
    const barcode = generateBarcode();
    const inserted = await db.insert(packagesTable).values({
      barcode,
      resiNumber,
      itemName,
      weight: weight ? String(weight) : null,
      notes: notes || null,
      status: "ready",
      customerId: Number(customerId),
      adminId: user.role === "admin" ? user.id : null,
    }).returning();
    const pkg = inserted[0];

    const customer = await db.select().from(usersTable).where(eq(usersTable.id, pkg.customerId)).limit(1);
    res.status(201).json({
      ...pkg,
      weight: pkg.weight ? Number(pkg.weight) : null,
      customerName: customer[0]?.name ?? "",
      customerPhone: customer[0]?.phone ?? "",
      adminName: null,
      pickedUpAt: null,
      createdAt: pkg.createdAt.toISOString(),
      updatedAt: pkg.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/packages/import
router.post("/import", requireAuth, requireRole("admin", "owner"), async (req, res) => {
  try {
    const user = (req as any).user;
    const { packages: rows } = req.body;
    if (!rows || !Array.isArray(rows)) {
      res.status(400).json({ error: "packages array required" });
      return;
    }
    let success = 0, failed = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        const { resiNumber, itemName, weight, customerPhone, notes } = row;
        if (!resiNumber || !itemName || !customerPhone) {
          failed++;
          errors.push(`Row missing required fields: ${JSON.stringify(row)}`);
          continue;
        }
        const customer = await db.select().from(usersTable).where(and(eq(usersTable.phone, customerPhone), eq(usersTable.role, "customer"))).limit(1);
        if (!customer[0]) {
          failed++;
          errors.push(`Customer not found for phone: ${customerPhone}`);
          continue;
        }
        const barcode = generateBarcode();
        await db.insert(packagesTable).values({
          barcode,
          resiNumber,
          itemName,
          weight: weight ? String(weight) : null,
          notes: notes || null,
          status: "ready",
          customerId: customer[0].id,
          adminId: user.role === "admin" ? user.id : null,
        });
        success++;
      } catch (e) {
        failed++;
        errors.push(`Error processing row: ${String(e)}`);
      }
    }
    res.json({ success, failed, total: rows.length, errors });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/packages/scan/:barcode
router.get("/scan/:barcode", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { barcode } = req.params;
    const pkgs = await db.select().from(packagesTable).where(eq(packagesTable.barcode, barcode)).limit(1);
    const pkg = pkgs[0];

    if (!pkg) {
      res.json({ valid: false, message: "Paket tidak ditemukan" });
      return;
    }
    if (user.role === "customer" && pkg.customerId !== user.id) {
      res.json({ valid: false, message: "Paket ini bukan milik Anda" });
      return;
    }
    if (pkg.status === "picked_up") {
      res.json({ valid: false, message: "Paket sudah diambil sebelumnya" });
      return;
    }
    if (pkg.status !== "ready") {
      res.json({ valid: false, message: "Paket belum siap untuk diambil" });
      return;
    }

    const customer = await db.select().from(usersTable).where(eq(usersTable.id, pkg.customerId)).limit(1);
    res.json({
      valid: true,
      message: "Paket valid dan siap diambil",
      package: {
        ...pkg,
        weight: pkg.weight ? Number(pkg.weight) : null,
        customerName: customer[0]?.name ?? "",
        customerPhone: customer[0]?.phone ?? "",
        adminName: null,
        pickedUpAt: null,
        createdAt: pkg.createdAt.toISOString(),
        updatedAt: pkg.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/packages/:id
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const pkgs = await db.select().from(packagesTable).where(eq(packagesTable.id, id)).limit(1);
    const pkg = pkgs[0];
    if (!pkg) { res.status(404).json({ error: "Not found" }); return; }

    const customer = await db.select().from(usersTable).where(eq(usersTable.id, pkg.customerId)).limit(1);
    let adminName = null;
    if (pkg.adminId) {
      const admin = await db.select().from(usersTable).where(eq(usersTable.id, pkg.adminId)).limit(1);
      adminName = admin[0]?.name ?? null;
    }
    res.json({
      ...pkg,
      weight: pkg.weight ? Number(pkg.weight) : null,
      customerName: customer[0]?.name ?? "",
      customerPhone: customer[0]?.phone ?? "",
      adminName,
      pickedUpAt: pkg.pickedUpAt?.toISOString() ?? null,
      createdAt: pkg.createdAt.toISOString(),
      updatedAt: pkg.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/packages/:id
router.patch("/:id", requireAuth, requireRole("admin", "owner"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status, notes } = req.body;
    const updateData: any = { updatedAt: new Date() };
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (status === "picked_up") updateData.pickedUpAt = new Date();
    const updated = await db.update(packagesTable).set(updateData).where(eq(packagesTable.id, id)).returning();
    const pkg = updated[0];
    if (!pkg) { res.status(404).json({ error: "Not found" }); return; }
    const customer = await db.select().from(usersTable).where(eq(usersTable.id, pkg.customerId)).limit(1);
    res.json({
      ...pkg,
      weight: pkg.weight ? Number(pkg.weight) : null,
      customerName: customer[0]?.name ?? "",
      customerPhone: customer[0]?.phone ?? "",
      adminName: null,
      pickedUpAt: pkg.pickedUpAt?.toISOString() ?? null,
      createdAt: pkg.createdAt.toISOString(),
      updatedAt: pkg.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/packages/:id/confirm-pickup
router.post("/:id/confirm-pickup", requireAuth, requireRole("admin", "owner"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const updated = await db.update(packagesTable).set({ status: "picked_up", pickedUpAt: new Date(), updatedAt: new Date() }).where(eq(packagesTable.id, id)).returning();
    const pkg = updated[0];
    if (!pkg) { res.status(404).json({ error: "Not found" }); return; }
    const customer = await db.select().from(usersTable).where(eq(usersTable.id, pkg.customerId)).limit(1);
    res.json({
      ...pkg,
      weight: pkg.weight ? Number(pkg.weight) : null,
      customerName: customer[0]?.name ?? "",
      customerPhone: customer[0]?.phone ?? "",
      adminName: null,
      pickedUpAt: pkg.pickedUpAt?.toISOString() ?? null,
      createdAt: pkg.createdAt.toISOString(),
      updatedAt: pkg.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/packages/:id/barcode
router.get("/:id/barcode", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const pkgs = await db.select().from(packagesTable).where(eq(packagesTable.id, id)).limit(1);
    const pkg = pkgs[0];
    if (!pkg) { res.status(404).json({ error: "Not found" }); return; }
    const customer = await db.select().from(usersTable).where(eq(usersTable.id, pkg.customerId)).limit(1);
    res.json({
      barcode: pkg.barcode,
      packageId: pkg.id,
      resiNumber: pkg.resiNumber,
      itemName: pkg.itemName,
      customerName: customer[0]?.name ?? "",
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
