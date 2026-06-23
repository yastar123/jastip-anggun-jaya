import { Router } from "express";
import { db, packagesTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
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

function getShippingRate(
  serviceType: string | null | undefined,
  deliveryRoute: string | null | undefined,
  weight: number | null | undefined,
): number | null {
  if (!serviceType || !weight || weight <= 0) return null;
  if (serviceType === "jastip pesawat") return 77000;
  if (serviceType === "jastip hemat+") return 10000;
  if (serviceType === "jastip kargo") return 7000;
  if (serviceType === "jastip pelni") {
    if (deliveryRoute === "Jakarta → Manokwari") {
      if (weight <= 10) return 20000;
      if (weight <= 20) return 19000;
      if (weight <= 40) return 18000;
      return 17000;
    }
    if (deliveryRoute === "Surabaya → Manokwari") {
      if (weight <= 10) return 18000;
      if (weight <= 20) return 17000;
      if (weight <= 40) return 16000;
      return 15500;
    }
  }
  return null;
}

function getTotalShipping(
  serviceType: string | null | undefined,
  deliveryRoute: string | null | undefined,
  weight: number | null | undefined,
): number | null {
  if (!serviceType || !weight || weight <= 0) return null;

  if (serviceType === "jastip pesawat" && deliveryRoute === "Jakarta → Manokwari") {
    if (weight <= 0.2) return 15800;
    if (weight <= 0.4) return 30800;
    if (weight <= 0.5) return 38500;
    if (weight <= 0.6) return 46200;
    if (weight <= 0.7) return 53900;
    if (weight <= 0.8) return 61600;
    if (weight <= 0.9) return 69300;
    if (weight <= 1) return 77000;
    if (weight <= 2) return 154000;
    if (weight <= 3) return 231000;
    if (weight <= 5) return 385000;
    if (weight <= 10) return 770000;
    return Math.round(weight * 77000);
  }

  if (serviceType === "jastip hemat+" && deliveryRoute === "Surabaya → Manokwari") {
    return Math.round(weight * 10000);
  }

  if (serviceType === "jastip kargo" && deliveryRoute === "Jakarta/Surabaya → Manokwari") {
    return Math.round(weight * 7000);
  }

  if (serviceType === "jastip pelni") {
    if (deliveryRoute === "Jakarta → Manokwari") {
      if (weight <= 10) return Math.round(weight * 20000);
      if (weight <= 20) return Math.round(weight * 19000);
      if (weight <= 40) return Math.round(weight * 18000);
      return Math.round(weight * 17000);
    }
    if (deliveryRoute === "Surabaya → Manokwari") {
      if (weight <= 10) return Math.round(weight * 18000);
      if (weight <= 20) return Math.round(weight * 17000);
      if (weight <= 40) return Math.round(weight * 16000);
      return Math.round(weight * 15500);
    }
  }

  return null;
}

function getVolumeDivisor(serviceType: string | null | undefined) {
  if (serviceType === "jastip pesawat") return 5000;
  if (serviceType === "jastip hemat+") return 4000;
  if (serviceType === "jastip pelni") return 4000;
  if (serviceType === "jastip kargo") return 1000000;
  return 6000;
}

function formatPackage(
  pkg: any,
  customerMap: Map<number, any>,
  adminMap: Map<number, any>,
) {
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
    deliveryRoute: pkg.deliveryRoute || null,
    customerName:
      (pkg.customerName || customerMap.get(pkg.customerId)?.name) ?? "",
    customerPhone: customerMap.get(pkg.customerId)?.phone ?? "",
    adminName: pkg.adminId ? (adminMap.get(pkg.adminId)?.name ?? null) : null,
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
    const { status, customerId, adminId, dateFrom, dateTo, search } =
      req.query as any;

    const admins = await db
      .select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.role, "admin"));
    const adminMap = new Map(admins.map((a) => [a.id, a]));
    const customerMap = new Map<number, any>();

    let rows = await db
      .select()
      .from(packagesTable)
      .orderBy(packagesTable.createdAt);

    if (status) rows = rows.filter((p) => p.status === status);
    if (customerId)
      rows = rows.filter((p) => p.customerId === Number(customerId));
    if (adminId) rows = rows.filter((p) => p.adminId === Number(adminId));
    if (dateFrom)
      rows = rows.filter((p) => new Date(p.createdAt) >= new Date(dateFrom));
    if (dateTo)
      rows = rows.filter(
        (p) => new Date(p.createdAt) <= new Date(dateTo + "T23:59:59Z"),
      );
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter(
        (p) =>
          p.resiNumber.toLowerCase().includes(s) ||
          (p.itemName ?? "").toLowerCase().includes(s) ||
          p.barcode.toLowerCase().includes(s) ||
          (p.packageNumber ?? "").toLowerCase().includes(s) ||
          (p.customerName ?? "").toLowerCase().includes(s),
      );
    }

    res.json(rows.map((p) => formatPackage(p, customerMap, adminMap)));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/packages
router.post(
  "/",
  requireAuth,
  requireRole("admin", "owner"),
  async (req, res) => {
    try {
      const user = (req as any).user;
      const {
        resiNumber,
        packageNumber,
        packageMode,
        itemName,
        realWeight,
        length,
        width,
        height,
        serviceType,
        deliveryRoute,
        packagingType,
        shippingRate,
        totalShipping: totalShippingInput,
        totalWeight,
        price,
        weight,
        notes,
        customerId,
        customerName,
        packageDate,
      } = req.body;

      if (!resiNumber || (!customerId && !customerName)) {
        res.status(400).json({
          error: "resiNumber and customerName or customerId required",
        });
        return;
      }

      const divisor = getVolumeDivisor(serviceType);
      let volumeWeight: number | null = null;
      if (length && width && height) {
        volumeWeight =
          (Number(length) * Number(width) * Number(height)) / divisor;
      }
      const effectiveRealWeight = realWeight ? Number(realWeight) : null;
      const usedWeight =
        effectiveRealWeight !== null && volumeWeight !== null
          ? Math.max(effectiveRealWeight, volumeWeight)
          : (effectiveRealWeight ?? volumeWeight);
      const effectiveShippingRate =
        getShippingRate(serviceType, deliveryRoute, usedWeight) ??
        (shippingRate ? Number(shippingRate) : null);

      // totalShipping: use provided value if given, otherwise auto-calculate
      let totalShipping: number | null = null;
      if (totalShippingInput !== undefined && totalShippingInput !== null && totalShippingInput !== "") {
        totalShipping = Number(totalShippingInput);
      } else {
        totalShipping = getTotalShipping(serviceType, deliveryRoute, usedWeight);
      }

      const barcode = generateBarcode();
      const insertData: Record<string, any> = {
        barcode,
        resiNumber,
        itemName: itemName || null,
        status: "pending",
        adminId: user.id,
        packageDate: packageDate ? new Date(packageDate) : new Date(),
        ...(packageNumber ? { packageNumber } : {}),
        ...(packageMode ? { packageMode } : {}),
        ...(realWeight ? { realWeight: String(realWeight) } : {}),
        ...(length ? { length: String(length) } : {}),
        ...(width ? { width: String(width) } : {}),
        ...(height ? { height: String(height) } : {}),
        ...(volumeWeight !== null ? { volumeWeight: String(volumeWeight) } : {}),
        ...(serviceType ? { serviceType } : {}),
        ...(deliveryRoute ? { deliveryRoute } : {}),
        ...(packagingType ? { packagingType } : {}),
        ...(usedWeight !== null ? { usedWeight: String(usedWeight) } : {}),
        ...(effectiveShippingRate !== null ? { shippingRate: String(effectiveShippingRate) } : {}),
        ...(totalWeight ? { totalWeight: String(totalWeight) } : {}),
        ...(price ? { price: String(price) } : {}),
        ...(totalShipping !== null ? { totalShipping: String(totalShipping) } : {}),
        ...(weight ? { weight: String(weight) } : {}),
        ...(notes ? { notes } : {}),
        ...(customerName ? { customerName } : {}),
        ...(customerId ? { customerId: Number(customerId) } : {}),
      };
      const inserted = await db
        .insert(packagesTable)
        .values(insertData as any)
        .returning();

      const pkg = inserted[0];
      const adminMap = new Map<number, any>();
      if (pkg.adminId) {
        const admin = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.id, pkg.adminId))
          .limit(1);
        if (admin[0]) adminMap.set(admin[0].id, admin[0]);
      }

      res.status(201).json(formatPackage(pkg, new Map(), adminMap));
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

// POST /api/packages/import
router.post(
  "/import",
  requireAuth,
  requireRole("admin", "owner"),
  async (req, res) => {
    try {
      const user = (req as any).user;
      const { packages: rows } = req.body;
      if (!rows || !Array.isArray(rows)) {
        res.status(400).json({ error: "packages array required" });
        return;
      }
      let success = 0,
        failed = 0;
      const errors: string[] = [];

      for (const row of rows) {
        try {
          const {
            resiNumber,
            packageNumber,
            customerName,
            itemName,
            realWeight,
            length,
            width,
            height,
            packagingType,
            shippingRate,
            totalWeight,
            price,
            notes,
            packageDate,
            serviceType,
            deliveryRoute,
          } = row;

          if (!resiNumber || !customerName) {
            failed++;
            errors.push(
              `Row missing resiNumber or customerName: ${JSON.stringify(row)}`,
            );
            continue;
          }

          const divisor = getVolumeDivisor(serviceType);
          let volumeWeight: number | null = null;
          if (length && width && height) {
            volumeWeight =
              (Number(length) * Number(width) * Number(height)) / divisor;
          }
          const effectiveRealWeight = realWeight ? Number(realWeight) : null;
          const usedWeight =
            effectiveRealWeight !== null && volumeWeight !== null
              ? Math.max(effectiveRealWeight, volumeWeight)
              : (effectiveRealWeight ?? volumeWeight);
          const totalShipping = getTotalShipping(serviceType, deliveryRoute, usedWeight);

          const barcode = generateBarcode();
          await db.insert(packagesTable).values({
            barcode,
            resiNumber: String(resiNumber),
            packageNumber: packageNumber ? String(packageNumber) : null,
            itemName: itemName ? String(itemName) : null,
            customerName: String(customerName),
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
            status: "pending",
            adminId: user.id,
            serviceType: serviceType ? String(serviceType) : null,
            deliveryRoute: deliveryRoute ? String(deliveryRoute) : null,
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
  },
);

// GET /api/packages/scan/:barcode
router.get("/scan/:barcode", requireAuth, async (req, res) => {
  try {
    const barcode = String(req.params.barcode);
    let pkgs = await db
      .select()
      .from(packagesTable)
      .where(eq(packagesTable.barcode, barcode))
      .limit(1);
    if (!pkgs[0]) {
      pkgs = await db
        .select()
        .from(packagesTable)
        .where(eq(packagesTable.resiNumber, barcode))
        .limit(1);
    }
    if (!pkgs[0] && barcode) {
      const all = await db.select().from(packagesTable);
      const found = all.find((p) => p.packageNumber === barcode);
      if (found) pkgs = [found];
    }
    const pkg = pkgs[0];

    if (!pkg) {
      res.json({ valid: false, message: "Paket tidak ditemukan" });
      return;
    }
    if (pkg.status === "diserahkan") {
      res.json({ valid: false, message: "Paket sudah diserahkan sebelumnya", package: formatPackage(pkg, new Map(), new Map()) });
      return;
    }

    const adminMap = new Map<number, any>();
    if (pkg.adminId) {
      const admin = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, pkg.adminId))
        .limit(1);
      if (admin[0]) adminMap.set(admin[0].id, admin[0]);
    }

    res.json({
      valid: true,
      message: "Paket ditemukan",
      package: formatPackage(pkg, new Map(), adminMap),
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
    const pkgs = await db
      .select()
      .from(packagesTable)
      .where(eq(packagesTable.id, id))
      .limit(1);
    const pkg = pkgs[0];
    if (!pkg) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const adminMap = new Map<number, any>();
    if (pkg.adminId) {
      const admin = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, pkg.adminId))
        .limit(1);
      if (admin[0]) adminMap.set(admin[0].id, admin[0]);
    }
    res.json(formatPackage(pkg, new Map(), adminMap));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/packages/:id
router.patch(
  "/:id",
  requireAuth,
  requireRole("admin", "owner"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { status, notes } = req.body;
      const updateData: any = { updatedAt: new Date() };
      if (status) updateData.status = status;
      if (notes !== undefined) updateData.notes = notes;
      if (status === "diserahkan") updateData.pickedUpAt = new Date();
      const updated = await db
        .update(packagesTable)
        .set(updateData)
        .where(eq(packagesTable.id, id))
        .returning();
      const pkg = updated[0];
      if (!pkg) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const adminMap = new Map<number, any>();
      res.json(formatPackage(pkg, new Map(), adminMap));
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

// POST /api/packages/:id/serahkan
router.post(
  "/:id/serahkan",
  requireAuth,
  requireRole("admin", "owner"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const updated = await db
        .update(packagesTable)
        .set({ status: "diserahkan", pickedUpAt: new Date(), updatedAt: new Date() })
        .where(eq(packagesTable.id, id))
        .returning();
      const pkg = updated[0];
      if (!pkg) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.json(formatPackage(pkg, new Map(), new Map()));
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

// POST /api/packages/:id/tolak
router.post(
  "/:id/tolak",
  requireAuth,
  requireRole("admin", "owner"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const updated = await db
        .update(packagesTable)
        .set({ status: "pending", updatedAt: new Date() })
        .where(eq(packagesTable.id, id))
        .returning();
      const pkg = updated[0];
      if (!pkg) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.json(formatPackage(pkg, new Map(), new Map()));
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

// GET /api/packages/:id/barcode
router.get("/:id/barcode", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const pkgs = await db
      .select()
      .from(packagesTable)
      .where(eq(packagesTable.id, id))
      .limit(1);
    const pkg = pkgs[0];
    if (!pkg) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({
      barcode: pkg.barcode,
      packageId: pkg.id,
      resiNumber: pkg.resiNumber,
      itemName: pkg.itemName,
      customerName: pkg.customerName ?? "",
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
