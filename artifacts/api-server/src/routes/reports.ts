import { Router } from "express";
import { db, packagesTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

// GET /api/reports
router.get("/", requireAuth, requireRole("owner"), async (req, res) => {
  try {
    const { type, date, month, year } = req.query as any;
    const packages = await db.select().from(packagesTable);

    let entries: { label: string; incoming: number; outgoing: number }[] = [];
    let periodLabel = "";

    if (type === "daily") {
      const targetDate = date || new Date().toISOString().split("T")[0];
      periodLabel = targetDate;
      // Hourly breakdown
      for (let h = 0; h < 24; h++) {
        const label = `${String(h).padStart(2, "0")}:00`;
        const incoming = packages.filter(p => {
          const d = new Date(p.createdAt);
          return p.createdAt.toISOString().startsWith(targetDate) && d.getHours() === h;
        }).length;
        const outgoing = packages.filter(p => {
          if (!p.pickedUpAt) return false;
          const d = new Date(p.pickedUpAt);
          return p.pickedUpAt.toISOString().startsWith(targetDate) && d.getHours() === h;
        }).length;
        entries.push({ label, incoming, outgoing });
      }
    } else if (type === "monthly") {
      const now = new Date();
      const targetYear = year ? Number(year) : now.getFullYear();
      const targetMonth = month ? Number(month) - 1 : now.getMonth();
      const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
      periodLabel = new Date(targetYear, targetMonth, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const incoming = packages.filter(p => p.createdAt.toISOString().startsWith(dateStr)).length;
        const outgoing = packages.filter(p => p.pickedUpAt?.toISOString().startsWith(dateStr)).length;
        entries.push({ label: `${d}`, incoming, outgoing });
      }
    } else if (type === "yearly") {
      const targetYear = year ? Number(year) : new Date().getFullYear();
      periodLabel = String(targetYear);
      for (let m = 0; m < 12; m++) {
        const label = new Date(targetYear, m, 1).toLocaleDateString("id-ID", { month: "long" });
        const incoming = packages.filter(p => {
          const d = new Date(p.createdAt);
          return d.getFullYear() === targetYear && d.getMonth() === m;
        }).length;
        const outgoing = packages.filter(p => {
          if (!p.pickedUpAt) return false;
          const d = new Date(p.pickedUpAt);
          return d.getFullYear() === targetYear && d.getMonth() === m;
        }).length;
        entries.push({ label, incoming, outgoing });
      }
    }

    const filteredPkgs = packages.filter(p => {
      if (type === "daily" && date) return p.createdAt.toISOString().startsWith(date);
      if (type === "monthly" && month && year) {
        const d = new Date(p.createdAt);
        return d.getFullYear() === Number(year) && d.getMonth() === Number(month) - 1;
      }
      if (type === "yearly" && year) {
        return new Date(p.createdAt).getFullYear() === Number(year);
      }
      return true;
    });

    res.json({
      period: periodLabel,
      totalPackages: filteredPkgs.length,
      pickedUp: filteredPkgs.filter(p => p.status === "picked_up").length,
      pending: filteredPkgs.filter(p => p.status !== "picked_up").length,
      entries,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
