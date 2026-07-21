import { useListPackages } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, PackageCheck, TrendingUp, Layers, TrendingDown, ArrowUpCircle, ArrowDownCircle, Minus } from "lucide-react";
import {
  Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip,
  CartesianGrid, Cell, Pie, PieChart, Legend,
} from "recharts";
import { useEffect, useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";

function formatRp(n: number) {
  return `Rp ${n.toLocaleString("id-ID")}`;
}
function formatDate(d: string | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function formatDateLong(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric",
  });
}
function formatDateShort(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("id-ID", {
    day: "numeric", month: "short",
  });
}

function getMonthKey(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function getMonthLabel(key: string) {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
}

const PIE_COLORS = ["#ef4444", "#f97316", "#22c55e", "#6b7280"];
const SERVICE_COLORS: Record<string, string> = {
  "jastip pesawat": "#3b82f6",
  "jastip hemat+": "#10b981",
  "jastip kargo": "#f59e0b",
  "jastip pelni": "#8b5cf6",
};

const serviceLabel: Record<string, string> = {
  "jastip pesawat": "Jastip Pesawat",
  "jastip hemat+": "Jastip Hemat+",
  "jastip kargo": "Jastip Kargo",
  "jastip pelni": "Jastip Pelni",
};

const PAGE_SIZE = 15;

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

// ── Custom tooltip for daily chart ───────────────────────────────────────────
function DailyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const pendapatan = payload.find((p: any) => p.dataKey === "pendapatan")?.value ?? 0;
  const pengeluaran = payload.find((p: any) => p.dataKey === "pengeluaran")?.value ?? 0;
  const laba = pendapatan - pengeluaran;
  return (
    <div className="bg-white border rounded-lg shadow-lg p-3 text-sm min-w-[200px]">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5 text-green-700"><span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" />Pendapatan</span>
          <span className="font-bold text-green-700">{formatRp(pendapatan)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5 text-red-700"><span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" />Pengeluaran</span>
          <span className="font-bold text-red-700">{formatRp(pengeluaran)}</span>
        </div>
        <div className="border-t pt-1 mt-1 flex justify-between gap-4">
          <span className={laba >= 0 ? "text-blue-700 font-medium" : "text-orange-700 font-medium"}>Laba Bersih</span>
          <span className={`font-black ${laba >= 0 ? "text-blue-700" : "text-orange-700"}`}>{formatRp(laba)}</span>
        </div>
      </div>
    </div>
  );
}

export default function OwnerFinance() {
  const { data: packages, isLoading } = useListPackages();
  const [viewMonths, setViewMonths] = useState("6");
  const [activeTab, setActiveTab] = useState("harian");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [detailPage, setDetailPage] = useState(1);
  const [serviceFilter, setServiceFilter] = useState("all");

  // ── Pengeluaran data ────────────────────────────────────────────────────────
  const [pengeluaranAll, setPengeluaranAll] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("jaj_token");
    fetch("/api/pengeluaran", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(setPengeluaranAll)
      .catch(() => {});
  }, []);

  // ── Today summary (always today, ignores filter) ────────────────────────────
  const today = todayIso();

  const todayIncome = useMemo(() => {
    return (packages || []).reduce((s, p: any) => {
      const d = (p.packageDate || p.createdAt || "").split("T")[0];
      return d === today ? s + (Number(p.totalShipping) || 0) : s;
    }, 0);
  }, [packages, today]);

  const todayExpense = useMemo(() => {
    return pengeluaranAll.reduce((s, e: any) => {
      return e.tanggal === today ? s + Number(e.nominal) : s;
    }, 0);
  }, [pengeluaranAll, today]);

  const todayNet = todayIncome - todayExpense;

  // ── Filtered packages ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const pkgs = packages || [];
    return pkgs.filter((p: any) => {
      const d = new Date(p.packageDate || p.createdAt);
      if (dateFrom && d < new Date(dateFrom)) return false;
      if (dateTo && d > new Date(dateTo + "T23:59:59")) return false;
      if (serviceFilter !== "all" && p.serviceType !== serviceFilter) return false;
      return true;
    });
  }, [packages, dateFrom, dateTo, serviceFilter]);

  // ── Filtered pengeluaran (same date range) ──────────────────────────────────
  const filteredPengeluaran = useMemo(() => {
    return pengeluaranAll.filter((e: any) => {
      if (dateFrom && e.tanggal < dateFrom) return false;
      if (dateTo && e.tanggal > dateTo) return false;
      return true;
    });
  }, [pengeluaranAll, dateFrom, dateTo]);

  // ── Daily stats ─────────────────────────────────────────────────────────────
  const dailyStats = useMemo(() => {
    const incomeByDay: Record<string, number> = {};
    filtered.forEach((p: any) => {
      const day = (p.packageDate || p.createdAt || "").split("T")[0];
      if (day) incomeByDay[day] = (incomeByDay[day] || 0) + (Number(p.totalShipping) || 0);
    });

    const expenseByDay: Record<string, number> = {};
    filteredPengeluaran.forEach((e: any) => {
      if (e.tanggal) expenseByDay[e.tanggal] = (expenseByDay[e.tanggal] || 0) + Number(e.nominal);
    });

    const allDays = [...new Set([...Object.keys(incomeByDay), ...Object.keys(expenseByDay)])].sort();

    const rows = allDays.map(day => ({
      day,
      label: formatDateShort(day),
      pendapatan: incomeByDay[day] || 0,
      pengeluaran: expenseByDay[day] || 0,
      laba: (incomeByDay[day] || 0) - (expenseByDay[day] || 0),
    }));

    const chartData = rows.slice(-14);

    const totalPendapatan = rows.reduce((s, r) => s + r.pendapatan, 0);
    const totalPengeluaran = rows.reduce((s, r) => s + r.pengeluaran, 0);
    const totalLaba = totalPendapatan - totalPengeluaran;

    return { rows: [...rows].reverse(), chartData, totalPendapatan, totalPengeluaran, totalLaba };
  }, [filtered, filteredPengeluaran]);

  // ── Existing stats (ongkir summary) ────────────────────────────────────────
  const stats = useMemo(() => {
    const pkgs = filtered;
    const totalOngkir = pkgs.reduce((s, p: any) => s + (Number(p.totalShipping) || 0), 0);
    const pickedUp = pkgs.filter((p: any) => p.status === "diserahkan");
    const ongkirCollected = pickedUp.reduce((s, p: any) => s + (Number(p.totalShipping) || 0), 0);
    const pending = pkgs.filter((p: any) => p.status === "pending");
    const ongkirPending = pending.reduce((s, p: any) => s + (Number(p.totalShipping) || 0), 0);
    const avgOngkir = pkgs.length > 0 ? Math.round(totalOngkir / pkgs.length) : 0;

    const monthMap: Record<string, { ongkir: number; count: number }> = {};
    pkgs.forEach((p: any) => {
      const key = getMonthKey(p.packageDate || p.createdAt);
      if (!monthMap[key]) monthMap[key] = { ongkir: 0, count: 0 };
      monthMap[key].ongkir += Number(p.totalShipping) || 0;
      monthMap[key].count += 1;
    });
    const months = Object.keys(monthMap).sort().slice(-Number(viewMonths));
    const monthlyData = months.map(k => ({
      month: getMonthLabel(k),
      ongkir: monthMap[k].ongkir,
      paket: monthMap[k].count,
    }));

    const statusCount = { pending: 0, diserahkan: 0 };
    pkgs.forEach((p: any) => { if (statusCount.hasOwnProperty(p.status)) (statusCount as any)[p.status]++; });
    const pieData = [
      { name: "Pending", value: statusCount.pending },
      { name: "Diserahkan", value: statusCount.diserahkan },
    ].filter(d => d.value > 0);

    const serviceMap: Record<string, { count: number; ongkir: number; berat: number; diserahkan: number }> = {};
    pkgs.forEach((p: any) => {
      const svc = p.serviceType || "lainnya";
      if (!serviceMap[svc]) serviceMap[svc] = { count: 0, ongkir: 0, berat: 0, diserahkan: 0 };
      serviceMap[svc].count++;
      serviceMap[svc].ongkir += Number(p.totalShipping) || 0;
      serviceMap[svc].berat += Number(p.usedWeight) || 0;
      if (p.status === "diserahkan") serviceMap[svc].diserahkan++;
    });
    const byService = Object.entries(serviceMap)
      .map(([svc, d]) => ({ svc, label: serviceLabel[svc] || svc, ...d }))
      .sort((a, b) => b.ongkir - a.ongkir);

    return {
      totalOngkir, ongkirCollected, ongkirPending, monthlyData, pieData,
      totalPkgs: pkgs.length, pickedUpCount: pickedUp.length, pendingCount: pending.length,
      avgOngkir, byService,
    };
  }, [filtered, viewMonths]);

  const detailPkgs = useMemo(() => {
    return [...filtered].sort((a: any, b: any) => {
      return new Date(b.packageDate || b.createdAt).getTime() - new Date(a.packageDate || a.createdAt).getTime();
    });
  }, [filtered]);
  const detailTotal = detailPkgs.length;
  const detailTotalPages = Math.ceil(detailTotal / PAGE_SIZE);
  const detailPaginated = detailPkgs.slice((detailPage - 1) * PAGE_SIZE, detailPage * PAGE_SIZE);

  function exportExcel() {
    if (!detailPkgs.length) return;
    const rows = detailPkgs.map((p: any) => ({
      "Tanggal": formatDate(p.packageDate || p.createdAt),
      "No Resi": p.resiNumber || "",
      "No Paket": p.packageNumber || "",
      "Nama Konsumen": p.customerName || "",
      "Jenis Jastip": serviceLabel[p.serviceType] || p.serviceType || "",
      "Rute": p.deliveryRoute || "",
      "Berat Real (Kg)": p.realWeight ?? "",
      "Berat Digunakan (Kg)": p.usedWeight ?? "",
      "Total Berat (Kg)": p.totalWeight ?? "",
      "Tarif/Kg": p.shippingRate ?? "",
      "Total Ongkir": p.totalShipping ?? "",
      "Status": p.status === "diserahkan" ? "Diserahkan" : "Pending",
    }));

    const summaryRows = stats.byService.map(s => ({
      "Jenis Jastip": s.label,
      "Jumlah Paket": s.count,
      "Diserahkan": s.diserahkan,
      "Total Berat (Kg)": s.berat.toFixed(2),
      "Total Ongkir": s.ongkir,
    }));

    const harian = dailyStats.rows.map(r => ({
      "Tanggal": formatDateLong(r.day),
      "Pendapatan (Rp)": r.pendapatan,
      "Pengeluaran (Rp)": r.pengeluaran,
      "Laba Bersih (Rp)": r.laba,
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(harian), "Harian");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Detail Paket");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Per Jenis Jastip");
    XLSX.writeFile(wb, `keuangan-${new Date().toISOString().split("T")[0]}.xlsx`);
  }

  if (isLoading) return <div className="animate-pulse p-8">Memuat data keuangan...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Laporan Keuangan</h1>
          <p className="text-muted-foreground mt-1">Pendapatan, pengeluaran, dan laba bersih Jastip Anggun Jaya.</p>
        </div>
        <Button variant="outline" onClick={exportExcel} disabled={!detailPkgs.length}>
          <Download className="w-4 h-4 mr-2" /> Export Excel
        </Button>
      </div>

      {/* ── Ringkasan Hari Ini ─────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Ringkasan Hari Ini — {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-l-4 border-l-green-500 bg-green-50/40">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Pendapatan Hari Ini</p>
                <ArrowUpCircle className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-2xl font-black text-green-700">{formatRp(todayIncome)}</p>
              <p className="text-xs text-green-600 mt-1">dari ongkir paket masuk hari ini</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-400 bg-red-50/40">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Pengeluaran Hari Ini</p>
                <ArrowDownCircle className="w-5 h-5 text-red-400" />
              </div>
              <p className="text-2xl font-black text-red-700">{formatRp(todayExpense)}</p>
              <p className="text-xs text-red-600 mt-1">biaya operasional hari ini</p>
            </CardContent>
          </Card>
          <Card className={`border-l-4 ${todayNet >= 0 ? "border-l-blue-500 bg-blue-50/40" : "border-l-orange-400 bg-orange-50/40"}`}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-1">
                <p className={`text-xs font-semibold uppercase tracking-wide ${todayNet >= 0 ? "text-blue-700" : "text-orange-700"}`}>
                  Laba Bersih Hari Ini
                </p>
                <Minus className={`w-5 h-5 ${todayNet >= 0 ? "text-blue-500" : "text-orange-400"}`} />
              </div>
              <p className={`text-2xl font-black ${todayNet >= 0 ? "text-blue-700" : "text-orange-700"}`}>{formatRp(todayNet)}</p>
              <p className={`text-xs mt-1 ${todayNet >= 0 ? "text-blue-600" : "text-orange-600"}`}>
                {todayNet >= 0 ? "pendapatan − pengeluaran" : "pengeluaran melebihi pendapatan"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Filter bar ────────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-sm text-muted-foreground whitespace-nowrap">Dari:</span>
              <Input type="date" className="w-full sm:w-[160px]" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setDetailPage(1); }} />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-sm text-muted-foreground whitespace-nowrap">Sampai:</span>
              <Input type="date" className="w-full sm:w-[160px]" value={dateTo} onChange={e => { setDateTo(e.target.value); setDetailPage(1); }} />
            </div>
            <Select value={serviceFilter} onValueChange={v => { setServiceFilter(v); setDetailPage(1); }}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Semua Jenis" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Jenis</SelectItem>
                <SelectItem value="jastip pesawat">Jastip Pesawat</SelectItem>
                <SelectItem value="jastip hemat+">Jastip Hemat+</SelectItem>
                <SelectItem value="jastip kargo">Jastip Kargo</SelectItem>
                <SelectItem value="jastip pelni">Jastip Pelni</SelectItem>
              </SelectContent>
            </Select>
            {(dateFrom || dateTo || serviceFilter !== "all") && (
              <Button variant="outline" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); setServiceFilter("all"); setDetailPage(1); }}>
                Reset Filter
              </Button>
            )}
            <Badge variant="secondary" className="ml-auto">{stats.totalPkgs} paket</Badge>
          </div>
        </CardContent>
      </Card>

      {/* ── Tabs ──────────────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="harian">Harian</TabsTrigger>
          <TabsTrigger value="ringkasan">Ringkasan</TabsTrigger>
          <TabsTrigger value="per-jenis">Per Jenis Jastip</TabsTrigger>
          <TabsTrigger value="detail">Detail Paket</TabsTrigger>
        </TabsList>

        {/* ── Tab: Harian ─────────────────────────────────────────────────────── */}
        {activeTab === "harian" && (
          <div className="mt-4 space-y-4">
            {/* Range summary cards */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="border-l-4 border-l-green-500">
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Total Pendapatan</p>
                  <p className="text-xl font-black text-green-700 mt-1">{formatRp(dailyStats.totalPendapatan)}</p>
                  <p className="text-xs text-muted-foreground mt-1">ongkir dari {stats.totalPkgs} paket</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-red-400">
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Total Pengeluaran</p>
                  <p className="text-xl font-black text-red-700 mt-1">{formatRp(dailyStats.totalPengeluaran)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{filteredPengeluaran.length} transaksi operasional</p>
                </CardContent>
              </Card>
              <Card className={`border-l-4 ${dailyStats.totalLaba >= 0 ? "border-l-blue-500" : "border-l-orange-400"}`}>
                <CardContent className="pt-4 pb-3">
                  <p className={`text-xs font-semibold uppercase tracking-wide ${dailyStats.totalLaba >= 0 ? "text-blue-700" : "text-orange-700"}`}>
                    Laba Bersih
                  </p>
                  <p className={`text-xl font-black mt-1 ${dailyStats.totalLaba >= 0 ? "text-blue-700" : "text-orange-700"}`}>
                    {formatRp(dailyStats.totalLaba)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">pendapatan − pengeluaran</p>
                </CardContent>
              </Card>
            </div>

            {/* Daily chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Pendapatan vs Pengeluaran Harian</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {dailyStats.chartData.length > 0
                    ? `${dailyStats.chartData.length} hari terakhir dalam rentang filter`
                    : "Tidak ada data"}
                </p>
              </CardHeader>
              <CardContent>
                {dailyStats.chartData.length === 0 ? (
                  <div className="h-[280px] flex items-center justify-center text-muted-foreground">Belum ada data</div>
                ) : (
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailyStats.chartData} barCategoryGap="30%">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${(v / 1000000).toFixed(1)}jt`} />
                        <Tooltip content={<DailyTooltip />} />
                        <Legend formatter={v => v === "pendapatan" ? "Pendapatan" : "Pengeluaran"} />
                        <Bar dataKey="pendapatan" name="pendapatan" fill="#22c55e" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="pengeluaran" name="pengeluaran" fill="#f87171" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Daily table */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Rincian Per Hari</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {dailyStats.rows.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">Belum ada data pada rentang ini</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Tanggal</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-green-700 uppercase">Pendapatan</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-red-600 uppercase">Pengeluaran</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Laba Bersih</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailyStats.rows.map((row, i) => (
                          <tr
                            key={row.day}
                            className={`border-b ${row.day === today ? "bg-blue-50 font-semibold" : i % 2 === 0 ? "" : "bg-muted/10"}`}
                          >
                            <td className="py-2.5 px-4 whitespace-nowrap">
                              {formatDateLong(row.day)}
                              {row.day === today && (
                                <span className="ml-2 text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Hari Ini</span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-right font-semibold text-green-700 whitespace-nowrap">
                              {row.pendapatan > 0 ? formatRp(row.pendapatan) : <span className="text-muted-foreground font-normal">-</span>}
                            </td>
                            <td className="py-2.5 px-4 text-right font-semibold text-red-600 whitespace-nowrap">
                              {row.pengeluaran > 0 ? formatRp(row.pengeluaran) : <span className="text-muted-foreground font-normal">-</span>}
                            </td>
                            <td className={`py-2.5 px-4 text-right font-bold whitespace-nowrap ${row.laba >= 0 ? "text-blue-700" : "text-orange-600"}`}>
                              {formatRp(row.laba)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 bg-muted/20 font-bold">
                          <td className="py-3 px-4">Total</td>
                          <td className="py-3 px-4 text-right text-green-700">{formatRp(dailyStats.totalPendapatan)}</td>
                          <td className="py-3 px-4 text-right text-red-600">{formatRp(dailyStats.totalPengeluaran)}</td>
                          <td className={`py-3 px-4 text-right ${dailyStats.totalLaba >= 0 ? "text-blue-700" : "text-orange-600"}`}>
                            {formatRp(dailyStats.totalLaba)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Tab: Ringkasan ──────────────────────────────────────────────────── */}
        {activeTab === "ringkasan" && (
          <div className="mt-4 space-y-4">
            {/* KPI Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-l-4 border-l-green-500">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Ongkir Terkumpul</CardTitle>
                  <PackageCheck className="h-5 w-5 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{formatRp(stats.ongkirCollected)}</div>
                  <p className="text-xs text-muted-foreground mt-1">{stats.pickedUpCount} paket diserahkan</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-amber-500">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Ongkir Pending</CardTitle>
                  <Package className="h-5 w-5 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-600">{formatRp(stats.ongkirPending)}</div>
                  <p className="text-xs text-muted-foreground mt-1">{stats.pendingCount} paket belum diserahkan</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-primary">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Ongkir</CardTitle>
                  <TrendingUp className="h-5 w-5 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatRp(stats.totalOngkir)}</div>
                  <p className="text-xs text-muted-foreground mt-1">{stats.totalPkgs} total paket</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-purple-500">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Rata-rata Ongkir</CardTitle>
                  <Layers className="h-5 w-5 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">{formatRp(stats.avgOngkir)}</div>
                  <p className="text-xs text-muted-foreground mt-1">per paket</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Ongkir Bulanan</CardTitle>
                  <Select value={viewMonths} onValueChange={setViewMonths}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 Bulan</SelectItem>
                      <SelectItem value="6">6 Bulan</SelectItem>
                      <SelectItem value="12">12 Bulan</SelectItem>
                    </SelectContent>
                  </Select>
                </CardHeader>
                <CardContent>
                  {stats.monthlyData.length === 0 ? (
                    <div className="h-[280px] flex items-center justify-center text-muted-foreground">Belum ada data</div>
                  ) : (
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.monthlyData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${(v / 1000000).toFixed(0)}jt`} />
                          <Tooltip formatter={(v: any) => formatRp(v)} />
                          <Bar dataKey="ongkir" name="Total Ongkir" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Status Paket</CardTitle></CardHeader>
                <CardContent>
                  {stats.pieData.length === 0 ? (
                    <div className="h-[280px] flex items-center justify-center text-muted-foreground">Belum ada data</div>
                  ) : (
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={stats.pieData} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={80}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                            {stats.pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              {stats.monthlyData.length > 0 && (
                <Card className="lg:col-span-3">
                  <CardHeader><CardTitle>Ringkasan Bulanan</CardTitle></CardHeader>
                  <CardContent>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase">Bulan</th>
                          <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground uppercase">Jumlah Paket</th>
                          <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground uppercase">Total Ongkir</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.monthlyData.map((row, i) => (
                          <tr key={i} className="border-b hover:bg-muted/20">
                            <td className="py-2.5 px-3 font-medium">{row.month}</td>
                            <td className="py-2.5 px-3 text-right">{row.paket} paket</td>
                            <td className="py-2.5 px-3 text-right font-semibold text-primary">{formatRp(row.ongkir)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 font-bold">
                          <td className="py-2.5 px-3">Total</td>
                          <td className="py-2.5 px-3 text-right">{stats.monthlyData.reduce((s, r) => s + r.paket, 0)} paket</td>
                          <td className="py-2.5 px-3 text-right text-primary">{formatRp(stats.monthlyData.reduce((s, r) => s + r.ongkir, 0))}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* ── Tab: Per Jenis Jastip ───────────────────────────────────────────── */}
        {activeTab === "per-jenis" && (
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {stats.byService.map(s => (
                <Card key={s.svc} style={{ borderLeftColor: SERVICE_COLORS[s.svc] || "#6b7280", borderLeftWidth: 4 }}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{s.label}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <div className="text-xl font-bold">{formatRp(s.ongkir)}</div>
                    <div className="text-xs text-muted-foreground">{s.count} paket · {s.diserahkan} diserahkan</div>
                    <div className="text-xs text-muted-foreground">Total berat: {s.berat.toFixed(2)} Kg</div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardHeader><CardTitle>Perbandingan Jenis Jastip</CardTitle></CardHeader>
              <CardContent>
                {stats.byService.length === 0 ? (
                  <div className="h-[280px] flex items-center justify-center text-muted-foreground">Belum ada data</div>
                ) : (
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.byService} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${(v / 1000000).toFixed(1)}jt`} />
                        <YAxis type="category" dataKey="label" fontSize={11} tickLine={false} axisLine={false} width={110} />
                        <Tooltip formatter={(v: any) => formatRp(v)} />
                        <Bar dataKey="ongkir" name="Total Ongkir" radius={[0, 4, 4, 0]}>
                          {stats.byService.map((s) => (
                            <Cell key={s.svc} fill={SERVICE_COLORS[s.svc] || "#6b7280"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      {["Jenis Jastip", "Jumlah Paket", "Diserahkan", "Pending", "Total Berat (Kg)", "Total Ongkir", "Rata-rata Ongkir"].map(h => (
                        <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byService.map(s => (
                      <tr key={s.svc} className="border-b hover:bg-muted/20">
                        <td className="py-3 px-4 font-medium">
                          <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ background: SERVICE_COLORS[s.svc] || "#6b7280" }} />
                          {s.label}
                        </td>
                        <td className="py-3 px-4 text-right">{s.count}</td>
                        <td className="py-3 px-4 text-right text-green-700">{s.diserahkan}</td>
                        <td className="py-3 px-4 text-right text-amber-700">{s.count - s.diserahkan}</td>
                        <td className="py-3 px-4 text-right">{s.berat.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right font-semibold text-primary">{formatRp(s.ongkir)}</td>
                        <td className="py-3 px-4 text-right">{formatRp(s.count > 0 ? Math.round(s.ongkir / s.count) : 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-bold bg-muted/10">
                      <td className="py-3 px-4">Total</td>
                      <td className="py-3 px-4 text-right">{stats.totalPkgs}</td>
                      <td className="py-3 px-4 text-right text-green-700">{stats.pickedUpCount}</td>
                      <td className="py-3 px-4 text-right text-amber-700">{stats.pendingCount}</td>
                      <td className="py-3 px-4 text-right">{stats.byService.reduce((s, r) => s + r.berat, 0).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right text-primary">{formatRp(stats.totalOngkir)}</td>
                      <td className="py-3 px-4 text-right">{formatRp(stats.avgOngkir)}</td>
                    </tr>
                  </tfoot>
                </table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Tab: Detail Paket ───────────────────────────────────────────────── */}
        {activeTab === "detail" && (
          <div className="mt-4">
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm min-w-[900px]">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      {["Tanggal", "No Resi", "Nama Konsumen", "Jenis Jastip", "Berat Real (Kg)", "Berat Digunakan (Kg)", "Total Berat (Kg)", "Tarif/Kg", "Total Ongkir", "Status"].map(h => (
                        <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detailPaginated.length > 0 ? (
                      detailPaginated.map((p: any) => (
                        <tr key={p.id} className="border-b hover:bg-muted/20">
                          <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground">{formatDate(p.packageDate || p.createdAt)}</td>
                          <td className="py-2.5 px-3 font-mono whitespace-nowrap">{p.resiNumber || "-"}</td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-medium">{p.customerName || "-"}</td>
                          <td className="py-2.5 px-3 whitespace-nowrap text-xs">
                            <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: SERVICE_COLORS[p.serviceType] || "#6b7280" }} />
                            {serviceLabel[p.serviceType] || p.serviceType || "-"}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">{p.realWeight ?? "-"}</td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap font-medium">{p.usedWeight ?? "-"}</td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">{p.totalWeight ?? "-"}</td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">{p.shippingRate ? formatRp(p.shippingRate) : "-"}</td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap font-semibold text-primary">{p.totalShipping ? formatRp(p.totalShipping) : "-"}</td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.status === "diserahkan" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                              {p.status === "diserahkan" ? "Diserahkan" : "Pending"}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={10} className="h-24 text-center text-muted-foreground">Tidak ada data</td></tr>
                    )}
                  </tbody>
                  {detailPaginated.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 bg-muted/10 font-semibold">
                        <td className="py-2.5 px-3" colSpan={8}>Total halaman ini ({detailPaginated.length} paket)</td>
                        <td className="py-2.5 px-3 text-right text-primary">
                          {formatRp(detailPaginated.reduce((s: number, p: any) => s + (Number(p.totalShipping) || 0), 0))}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </CardContent>
              {detailTotalPages > 1 && (
                <div className="p-3 border-t flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{detailTotal} paket · {detailTotalPages} halaman</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={detailPage <= 1} onClick={() => setDetailPage(p => p - 1)}>Sebelumnya</Button>
                    <span className="flex items-center px-2 text-sm">{detailPage} / {detailTotalPages}</span>
                    <Button variant="outline" size="sm" disabled={detailPage >= detailTotalPages} onClick={() => setDetailPage(p => p + 1)}>Berikutnya</Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
      </Tabs>
    </div>
  );
}
