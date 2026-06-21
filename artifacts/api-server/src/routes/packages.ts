import { Router } from "express";
import { db, packagesTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";
import crypto from "crypto";

const router = Router();

function generateBarcode(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `JAJ-${ts}-${rnd}`;
}

function toNum(val: any): number | null {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function formatPackage(pkg: any, customerMap: Map<number, any>, adminMap: Map<number, any>) {
  return {
    ...pkg,
    weight: toNum(pkg.weight),
    realWeight: toNum(pkg.realWeight),
    length: toNum(pkg.length),
    width: toNum(pkg.width),
    height: toNum(pkg.height),
    volumeWeight: toNum(pkg.volumeWeight),
    usedWeight: toNum(pkg.usedWeight),
    shippingRate: toNum(pkg.shippingRate),
    totalWeight: toNum(pkg.totalWeight),
    price: toNum(pkg.price),
    totalShipping: toNum(pkg.totalShipping),
    customerName: customerMap.get(pkg.customerId)?.name ?? "",
    customerPhone: customerMap.get(pkg.customerId)?.phone ?? "",
    adminName: pkg.adminId ? adminMap.get(pkg.adminId)?.name ?? null : null,
    packageDate: pkg.packageDate?.toISOString() ?? null,
    pickedUpAt: pkg.pickedUpAt?.toISOString() ?? null,
    createdAt: pkg.createdAt.toISOString(),
    updatedAt: pkg.updatedAt.toISOString(),
  };
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

    if (user.role === "customer") rows = rows.filter(p => p.customerId === user.id);
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
        p.barcode.toLowerCase().includes(s) ||
        (p.packageNumber ?? "").toLowerCase().includes(s)
      );
    }

    res.json(rows.map(p => formatPackage(p, customerMap, adminMap)));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/packages
router.post("/", requireAuth, requireRole("admin", "owner"), async (req, res) => {
  try {
    const user = (req as any).user;
    const {
      resiNumber, packageNumber, itemName,
      realWeight, length, width, height,
      packagingType, shippingRate, totalWeight, price,
      weight, notes, customerId, packageDate
    } = req.body;

    if (!resiNumber || !customerId) {
      res.status(400).json({ error: "resiNumber, customerId required" });
      return;
    }

    // Auto-calculate volumeWeight and usedWeight
    let volumeWeight: number | null = null;
    if (length && width && height) {
      volumeWeight = (Number(length) * Number(width) * Number(height)) / 6000;
    }
    const effectiveRealWeight = realWeight ? Number(realWeight) : null;
    const usedWeight = effectiveRealWeight !== null && volumeWeight !== null
      ? Math.max(effectiveRealWeight, volumeWeight)
      : effectiveRealWeight ?? volumeWeight;
    const totalShipping = usedWeight && shippingRate ? usedWeight * Number(shippingRate) : null;

    const barcode = generateBarcode();
    const inserted = await db.insert(packagesTable).values({
      barcode,
      resiNumber,
      packageNumber: packageNumber || null,
      itemName: itemName || resiNumber,
      realWeight: realWeight ? String(realWeight) : null,
      length: length ? String(length) : null,
      width: width ? String(width) : null,
      height: height ? String(height) : null,
      volumeWeight: volumeWeight !== null ? String(volumeWeight) : null,
      packagingType: packagingType || null,
      usedWeight: usedWeight !== null ? String(usedWeight) : null,
      shippingRate: shippingRate ? String(shippingRate) : null,
      totalWeight: totalWeight ? String(totalWeight) : null,
      price: price ? String(price) : null,
      totalShipping: totalShipping !== null ? String(totalShipping) : null,
      weight: weight ? String(weight) : null,
      notes: notes || null,
      status: "in_transit",
      customerId: Number(customerId),
      adminId: user.id,
      packageDate: packageDate ? new Date(packageDate) : new Date(),
    }).returning();

    const pkg = inserted[0];
    const customer = await db.select().from(usersTable).where(eq(usersTable.id, pkg.customerId)).limit(1);
    const customerMap = new Map([[customer[0]?.id, customer[0]]]);
    const adminMap = new Map<number, any>();
    if (pkg.adminId) {
      const admin = await db.select().from(usersTable).where(eq(usersTable.id, pkg.adminId)).limit(1);
      if (admin[0]) adminMap.set(admin[0].id, admin[0]);
    }

    res.status(201).json(formatPackage(pkg, customerMap, adminMap));
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
        const {
          resiNumber, packageNumber, customerPhone, itemName,
          realWeight, length, width, height,
          packagingType, shippingRate, totalWeight, price,
          notes, packageDate
        } = row;

        if (!resiNumber || !customerPhone) {
          failed++;
          errors.push(`Row missing resiNumber or customerPhone: ${JSON.stringify(row)}`);
          continue;
        }
        const customer = await db.select().from(usersTable).where(and(eq(usersTable.phone, String(customerPhone)), eq(usersTable.role, "customer"))).limit(1);
        if (!customer[0]) {
          failed++;
          errors.push(`Customer not found for phone: ${customerPhone}`);
          continue;
        }

        // Auto-calculate volumeWeight
        let volumeWeight: number | null = null;
        if (length && width && height) {
          volumeWeight = (Number(length) * Number(width) * Number(height)) / 6000;
        }
        const effectiveRealWeight = realWeight ? Number(realWeight) : null;
        const usedWeight = effectiveRealWeight !== null && volumeWeight !== null
          ? Math.max(effectiveRealWeight, volumeWeight)
          : effectiveRealWeight ?? volumeWeight;
        const totalShipping = usedWeight && shippingRate ? usedWeight * Number(shippingRate) : null;

        const barcode = generateBarcode();
        await db.insert(packagesTable).values({
          barcode,
          resiNumber: String(resiNumber),
          packageNumber: packageNumber ? String(packageNumber) : null,
          itemName: itemName ? String(itemName) : String(resiNumber),
          realWeight: realWeight ? String(realWeight) : null,
          length: length ? String(length) : null,
          width: width ? String(width) : null,
          height: height ? String(height) : null,
          volumeWeight: volumeWeight !== null ? String(volumeWeight) : null,
          packagingType: packagingType ? String(packagingType) : null,
          usedWeight: usedWeight !== null ? String(usedWeight) : null,
          shippingRate: shippingRate ? String(shippingRate) : null,
          totalWeight: totalWeight ? String(totalWeight) : null,
          price: price ? String(price) : null,
          totalShipping: totalShipping !== null ? String(totalShipping) : null,
          notes: notes ? String(notes) : null,
          status: "in_transit",
          customerId: customer[0].id,
          adminId: user.id,
          packageDate: packageDate ? new Date(String(packageDate)) : new Date(),
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
    let pkgs = await db.select().from(packagesTable).where(eq(packagesTable.barcode, barcode)).limit(1);
    if (!pkgs[0]) {
      pkgs = await db.select().from(packagesTable).where(eq(packagesTable.resiNumber, barcode)).limit(1);
    }
    if (!pkgs[0] && barcode) {
      const all = await db.select().from(packagesTable);
      const found = all.find(p => p.packageNumber === barcode);
      if (found) pkgs = [found];
    }
    const pkg = pkgs[0];

    if (!pkg) { res.json({ valid: false, message: "Paket tidak ditemukan" }); return; }
    if (user.role === "customer" && pkg.customerId !== user.id) {
      res.json({ valid: false, message: "Bukan barcode dari paket kamu" }); return;
    }
    if (pkg.status === "picked_up") { res.json({ valid: false, message: "Paket sudah diambil sebelumnya" }); return; }

    const customer = await db.select().from(usersTable).where(eq(usersTable.id, pkg.customerId)).limit(1);
    const customerMap = new Map([[customer[0]?.id, customer[0]]]);
    const adminMap = new Map<number, any>();
    if (pkg.adminId) {
      const admin = await db.select().from(usersTable).where(eq(usersTable.id, pkg.adminId)).limit(1);
      if (admin[0]) adminMap.set(admin[0].id, admin[0]);
    }

    res.json({ valid: true, message: "Paket ditemukan", package: formatPackage(pkg, customerMap, adminMap) });
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
    const customerMap = new Map([[customer[0]?.id, customer[0]]]);
    const adminMap = new Map<number, any>();

    if (pkg.adminId) {
      const admin = await db.select().from(usersTable).where(eq(usersTable.id, pkg.adminId)).limit(1);
      if (admin[0]) adminMap.set(admin[0].id, admin[0]);
    }

    res.json(formatPackage(pkg, customerMap, adminMap));
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
    const customerMap = new Map([[customer[0]?.id, customer[0]]]);
    const adminMap = new Map<number, any>();
    res.json(formatPackage(pkg, customerMap, adminMap));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/packages/:id/customer-pickup  (customer marks their own package as picked up)
router.post("/:id/customer-pickup", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const id = Number(req.params.id);
    const pkgs = await db.select().from(packagesTable).where(eq(packagesTable.id, id)).limit(1);
    const pkg = pkgs[0];
    if (!pkg) { res.status(404).json({ error: "Not found" }); return; }
    if (user.role === "customer" && pkg.customerId !== user.id) {
      res.status(403).json({ error: "Paket ini bukan milik Anda" }); return;
    }
    if (pkg.status === "picked_up") { res.status(400).json({ error: "Paket sudah diambil sebelumnya" }); return; }
    const updated = await db.update(packagesTable).set({ status: "picked_up", pickedUpAt: new Date(), updatedAt: new Date() }).where(eq(packagesTable.id, id)).returning();
    const updPkg = updated[0];
    const customer = await db.select().from(usersTable).where(eq(usersTable.id, updPkg.customerId)).limit(1);
    const customerMap = new Map([[customer[0]?.id, customer[0]]]);
    const adminMap = new Map<number, any>();
    res.json(formatPackage(updPkg, customerMap, adminMap));
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
    const customerMap = new Map([[customer[0]?.id, customer[0]]]);
    const adminMap = new Map<number, any>();
    res.json(formatPackage(pkg, customerMap, adminMap));
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
    res.json({ barcode: pkg.barcode, packageId: pkg.id, resiNumber: pkg.resiNumber, itemName: pkg.itemName, customerName: customer[0]?.name ?? "" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
