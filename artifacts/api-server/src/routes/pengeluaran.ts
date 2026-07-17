import { Router } from "express";
import { db, pengeluaranTable } from "@workspace/db";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

// GET /api/pengeluaran — list with filters
router.get("/", requireAuth, requireRole("admin", "owner"), async (req, res) => {
  try {
    const { dari, sampai, kategori, metodePembayaran, dicatatOleh } =
      req.query as Record<string, string>;

    let rows = await db
      .select()
      .from(pengeluaranTable)
      .orderBy(desc(pengeluaranTable.tanggal), desc(pengeluaranTable.createdAt));

    // Filter in-memory (simple & portable)
    if (dari) rows = rows.filter((r) => r.tanggal >= dari);
    if (sampai) rows = rows.filter((r) => r.tanggal <= sampai);
    if (kategori) rows = rows.filter((r) => r.kategori === kategori);
    if (metodePembayaran) rows = rows.filter((r) => r.metodePembayaran === metodePembayaran);
    if (dicatatOleh) rows = rows.filter((r) => String(r.dicatatOleh) === dicatatOleh);

    res.json(rows);
  } catch (err) {
    (req as any).log?.error?.(err);
    res.status(500).json({ error: "Gagal mengambil data pengeluaran" });
  }
});

// POST /api/pengeluaran — create
router.post("/", requireAuth, requireRole("admin", "owner"), async (req, res) => {
  try {
    const user = (req as any).user;
    const { tanggal, kategori, nominal, metodePembayaran, catatan } = req.body;

    if (!tanggal || !kategori || !nominal) {
      res.status(400).json({ error: "tanggal, kategori, dan nominal wajib diisi" });
      return;
    }

    const nominalNum = Number(nominal);
    if (isNaN(nominalNum) || nominalNum <= 0) {
      res.status(400).json({ error: "nominal harus berupa angka positif" });
      return;
    }

    const [row] = await db
      .insert(pengeluaranTable)
      .values({
        tanggal,
        kategori,
        nominal: String(nominalNum),
        metodePembayaran: (metodePembayaran as any) || "cash",
        dicatatOleh: user?.id ?? null,
        namaPencatat: user?.name ?? null,
        catatan: catatan || null,
      })
      .returning();

    res.status(201).json(row);
  } catch (err) {
    (req as any).log?.error?.(err);
    res.status(500).json({ error: "Gagal menyimpan pengeluaran" });
  }
});

// PATCH /api/pengeluaran/:id — update
router.patch("/:id", requireAuth, requireRole("admin", "owner"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { tanggal, kategori, nominal, metodePembayaran, catatan } = req.body;

    const existing = await db
      .select()
      .from(pengeluaranTable)
      .where(eq(pengeluaranTable.id, id))
      .limit(1);

    if (!existing[0]) {
      res.status(404).json({ error: "Data tidak ditemukan" });
      return;
    }

    const updates: Partial<typeof pengeluaranTable.$inferInsert> = {};
    if (tanggal != null) updates.tanggal = tanggal;
    if (kategori != null) updates.kategori = kategori;
    if (nominal != null) updates.nominal = String(Number(nominal));
    if (metodePembayaran != null) updates.metodePembayaran = metodePembayaran;
    if (catatan !== undefined) updates.catatan = catatan;

    const [row] = await db
      .update(pengeluaranTable)
      .set(updates)
      .where(eq(pengeluaranTable.id, id))
      .returning();

    res.json(row);
  } catch (err) {
    (req as any).log?.error?.(err);
    res.status(500).json({ error: "Gagal memperbarui pengeluaran" });
  }
});

// DELETE /api/pengeluaran/:id
router.delete("/:id", requireAuth, requireRole("admin", "owner"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(pengeluaranTable).where(eq(pengeluaranTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    (req as any).log?.error?.(err);
    res.status(500).json({ error: "Gagal menghapus pengeluaran" });
  }
});

export default router;
