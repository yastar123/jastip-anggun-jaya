import { Router } from "express";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

const ALLOWED_KEYS = ["kargoRate"] as const;

// GET /api/settings — returns all app settings (admin + owner)
router.get("/", requireAuth, requireRole("admin", "owner"), async (req, res) => {
  try {
    const rows = await db.select().from(settingsTable);
    const result: Record<string, any> = {};
    for (const row of rows) {
      result[row.key] = isNaN(Number(row.value)) ? row.value : Number(row.value);
    }
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/settings — update one or more settings (admin + owner)
router.patch("/", requireAuth, requireRole("admin", "owner"), async (req, res) => {
  try {
    const body = req.body as Record<string, any>;
    const updates: { key: string; value: string }[] = [];

    for (const key of ALLOWED_KEYS) {
      if (key in body) {
        const val = body[key];
        if (val == null || val === "") continue;
        updates.push({ key, value: String(val) });
      }
    }

    if (updates.length === 0) {
      res.status(400).json({ error: "No valid settings provided" });
      return;
    }

    for (const { key, value } of updates) {
      await db
        .insert(settingsTable)
        .values({ key, value })
        .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });
    }

    const rows = await db.select().from(settingsTable);
    const result: Record<string, any> = {};
    for (const row of rows) {
      result[row.key] = isNaN(Number(row.value)) ? row.value : Number(row.value);
    }
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
