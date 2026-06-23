import { Router } from "express";
import { db, packagesTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

// GET /api/reports
router.get("/", requireAuth, requireRole("owner"), async (req, res) => {
  try {
    const { type, date, month, year } = req.query as any;
    const packages = await db.select().from(packagesTable);
    const now = new Date();

    let entries: { label: string; incoming: number; outgoing: number }[] = [];
    let periodLabel = "";
    let filteredPkgs = packages;

    if (type === "daily") {
      const targetDate = date || now.toISOString().split("T")[0];
      periodLabel = targetDate;
      filteredPkgs = packages.filter(p => p.createdAt.toISOString().startsWith(targetDate));

      // Hourly breakdown 00-23
      for (let h = 0; h < 24; h++) {
        const label = `${String(h).padStart(2, "0")}:00`;
        const incoming = packages.filter(p =>
          p.createdAt.toISOString().startsWith(targetDate) && new Date(p.createdAt).getHours() === h
        ).length;
        const outgoing = packages.filter(p =>
          p.pickedUpAt && p.pickedUpAt.toISOString().startsWith(targetDate) && new Date(p.pickedUpAt).getHours() === h
        ).length;
        entries.push({ label, incoming, outgoing });
      }

    } else if (type === "monthly") {
      // month can be "YYYY-MM" or just number; year is optional
      let targetYear: number, targetMonth: number; // 0-indexed month
      if (month && String(month).includes("-")) {
        const parts = String(month).split("-");
        targetYear = Number(parts[0]);
        targetMonth = Number(parts[1]) - 1;
      } else {
        targetYear = year ? Number(year) : now.getFullYear();
        targetMonth = month ? Number(month) - 1 : now.getMonth();
      }
      const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
      periodLabel = new Date(targetYear, targetMonth, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });

      filteredPkgs = packages.filter(p => {
        const d = new Date(p.createdAt);
        return d.getFullYear() === targetYear && d.getMonth() === targetMonth;
      });

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const incoming = packages.filter(p => p.createdAt.toISOString().startsWith(dateStr)).length;
        const outgoing = packages.filter(p => p.pickedUpAt?.toISOString().startsWith(dateStr)).length;
        entries.push({ label: `${d}`, incoming, outgoing });
      }

    } else if (type === "yearly") {
      const targetYear = year ? Number(year) : now.getFullYear();
      periodLabel = String(targetYear);

      filteredPkgs = packages.filter(p => new Date(p.createdAt).getFullYear() === targetYear);

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

    res.json({
      period: periodLabel,
      totalPackages: filteredPkgs.length,
      pickedUp: filteredPkgs.filter(p => p.status === "diserahkan").length,
      pending: filteredPkgs.filter(p => p.status === "pending").length,
      entries,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
