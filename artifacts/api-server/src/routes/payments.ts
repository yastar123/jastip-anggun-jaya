import { Router } from "express";
import { db, paymentsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

router.get("/", requireAuth, requireRole("admin", "owner"), async (req, res) => {
  try {
    const { paymentType } = req.query as Record<string, string>;
    let rows = await db
      .select()
      .from(paymentsTable)
      .orderBy(desc(paymentsTable.createdAt));

    if (paymentType && paymentType !== "all") {
      rows = rows.filter((r) => r.paymentType === paymentType);
    }

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil data pembayaran" });
  }
});

router.post("/", requireAuth, requireRole("admin", "owner"), async (req, res) => {
  try {
    const {
      paymentType,
      totalAmount,
      paidAmount,
      changeAmount,
      packageIds,
      packageSummary,
      notes,
    } = req.body;

    if (!paymentType || !totalAmount || !packageIds?.length) {
      return res.status(400).json({ error: "Data tidak lengkap" });
    }

    const user = (req as any).user;

    const [payment] = await db
      .insert(paymentsTable)
      .values({
        paymentType,
        totalAmount: String(totalAmount),
        paidAmount: paidAmount != null ? String(paidAmount) : null,
        changeAmount: changeAmount != null ? String(changeAmount) : null,
        packageIds,
        packageSummary: packageSummary ?? null,
        adminId: user?.id ?? null,
        adminName: user?.name ?? null,
        notes: notes ?? null,
      })
      .returning();

    res.status(201).json(payment);
  } catch (err) {
    res.status(500).json({ error: "Gagal menyimpan pembayaran" });
  }
});

export default router;
