import { useEffect, useMemo, useState } from "react";
import { useListPackages } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import {
  Download, Wallet, TrendingDown, ArrowUpDown, AlertCircle,
  Banknote, ArrowRightLeft, Clock, ChevronDown, ChevronUp, ExternalLink,
} from "lucide-react";
import * as XLSX from "xlsx";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRp(n: number) {
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}
function todayIso() {
  return new Date().toISOString().split("T")[0];
}
function isoDateOf(d: string | null | undefined) {
  if (!d) return "";
  return (d.includes("T") ? d.split("T")[0] : d);
}
function formatDateLabel(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("id-ID", {
    day: "numeric", month: "short", year: "numeric",
  });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

const SERVICE_LABELS: Record<string, string> = {
  "jastip pesawat": "Pesawat",
  "jastip hemat+":  "Hemat+",
  "jastip kargo":   "Kargo",
  "jastip pelni":   "Pelni",
};
const SERVICE_COLOR: Record<string, string> = {
  "jastip pesawat": "bg-blue-500",
  "jastip hemat+":  "bg-emerald-500",
  "jastip kargo":   "bg-amber-500",
  "jastip pelni":   "bg-purple-500",
};
const SERVICE_BORDER: Record<string, string> = {
  "jastip pesawat": "border-l-blue-500",
  "jastip hemat+":  "border-l-emerald-500",
  "jastip kargo":   "border-l-amber-500",
  "jastip pelni":   "border-l-purple-500",
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  title, subtitle, value, sub, color, icon: Icon, onClick, clickable = false,
}: {
  title: string; subtitle?: string; value: string; sub: string;
  color: string; icon: any; onClick?: () => void; clickable?: boolean;
}) {
  return (
    <Card
      className={`border-l-4 ${color} transition-all ${clickable ? "cursor-pointer hover:shadow-md hover:scale-[1.01]" : ""}`}
      onClick={onClick}
    >
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground leading-tight">{title}</p>
            {subtitle && <p className="text-[10px] text-muted-foreground/70 leading-tight">{subtitle}</p>}
            <p className="text-2xl font-black tracking-tight leading-none pt-1">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{sub}</p>
          </div>
          <Icon className="w-5 h-5 text-muted-foreground/50 shrink-0 mt-0.5" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Method Card ─────────────────────────────────────────────────────────────

function MethodCard({
  label, amount, count, color, icon: Icon, onClick,
}: {
  label: string; amount: number; count: number; color: string; icon: any; onClick?: () => void;
}) {
  return (
    <Card
      className={`border-t-4 ${color} cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all`}
      onClick={onClick}
    >
      <CardContent className="pt-4 pb-4 px-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
          <Icon className="w-4 h-4 text-muted-foreground/50" />
        </div>
        <p className="text-xl font-black">{formatRp(amount)}</p>
        <p className="text-xs text-muted-foreground mt-1">{count} transaksi</p>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OwnerFinance() {
  const [, setLocation] = useLocation();

  // ── Filters ──────────────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [kasirFilter,   setKasirFilter]   = useState("all");
  const [metodeFilter,  setMetodeFilter]  = useState("all");
  const [layananFilter, setLayananFilter] = useState("all");

  // ── Raw data ─────────────────────────────────────────────────────────────
  const { data: packages, isLoading: pkgLoading } = useListPackages();
  const [payments,     setPayments]     = useState<any[]>([]);
  const [pengeluaran,  setPengeluaran]  = useState<any[]>([]);
  const [loadingPay,   setLoadingPay]   = useState(true);

  // UI state
  const [showTrxDetail, setShowTrxDetail] = useState(false);
  const [activeMethod,  setActiveMethod]  = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("jaj_token");
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch("/api/payments",     { headers }).then(r => r.ok ? r.json() : []),
      fetch("/api/pengeluaran",  { headers }).then(r => r.ok ? r.json() : []),
    ]).then(([pay, pen]) => {
      setPayments(pay);
      setPengeluaran(pen);
      setLoadingPay(false);
    }).catch(() => setLoadingPay(false));
  }, []);

  // ── Derived: unique kasir list from payments ──────────────────────────────
  const kasirList = useMemo(() => {
    const names = new Set<string>();
    payments.forEach(p => { if (p.adminName) names.add(p.adminName); });
    return [...names].sort();
  }, [payments]);

  // ── Package map: id → pkg (for payment attribution) ──────────────────────
  const pkgMap = useMemo(() => {
    const m = new Map<number, any>();
    (packages || []).forEach(p => m.set(p.id, p));
    return m;
  }, [packages]);

  // ── Filtered payments ─────────────────────────────────────────────────────
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      const d = isoDateOf(p.createdAt);
      if (selectedDate !== "all" && d !== selectedDate) return false;
      if (kasirFilter !== "all" && p.adminName !== kasirFilter) return false;
      if (metodeFilter !== "all" && p.paymentType !== metodeFilter) return false;
      // layanan filter: check if any package in payment matches
      if (layananFilter !== "all") {
        const ids: number[] = p.packageIds || [];
        const hasSvc = ids.some(id => pkgMap.get(id)?.serviceType === layananFilter);
        if (!hasSvc) return false;
      }
      return true;
    });
  }, [payments, selectedDate, kasirFilter, metodeFilter, layananFilter, pkgMap]);

  // ── Filtered pengeluaran ──────────────────────────────────────────────────
  const filteredPengeluaran = useMemo(() => {
    return pengeluaran.filter(e => {
      if (selectedDate !== "all" && e.tanggal !== selectedDate) return false;
      return true;
    });
  }, [pengeluaran, selectedDate]);

  // ── Filtered packages (for service table & billing totals) ────────────────
  const filteredPackages = useMemo(() => {
    return (packages || []).filter((p: any) => {
      const d = isoDateOf(p.packageDate || p.createdAt);
      if (selectedDate !== "all" && d !== selectedDate) return false;
      if (layananFilter !== "all" && p.serviceType !== layananFilter) return false;
      return true;
    });
  }, [packages, selectedDate, layananFilter]);

  // ── KPI computations ──────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    // Pembayaran diterima = actual money received (non-piutang, use paidAmount)
    const nonPiutang = filteredPayments.filter(p => p.paymentType !== "piutang");
    const pembayaranDiterima = nonPiutang.reduce((s, p) =>
      s + Number(p.paidAmount ?? p.totalAmount ?? 0), 0);

    const totalPengeluaran = filteredPengeluaran.reduce((s, e) =>
      s + Number(e.nominal ?? 0), 0);

    const arusKas = pembayaranDiterima - totalPengeluaran;

    // Piutang terbuka = ALL piutang payments (accumulated, not filtered by date)
    // but filter by kasir/layanan
    const piutangPayments = payments.filter(p => {
      if (p.paymentType !== "piutang") return false;
      if (kasirFilter !== "all" && p.adminName !== kasirFilter) return false;
      if (layananFilter !== "all") {
        const ids: number[] = p.packageIds || [];
        return ids.some(id => pkgMap.get(id)?.serviceType === layananFilter);
      }
      return true;
    });
    const piutangTerbuka = piutangPayments.reduce((s, p) =>
      s + Number(p.totalAmount ?? 0), 0);

    return { pembayaranDiterima, totalPengeluaran, arusKas, piutangTerbuka };
  }, [filteredPayments, filteredPengeluaran, payments, kasirFilter, layananFilter, pkgMap]);

  // ── Method breakdown ──────────────────────────────────────────────────────
  const byMethod = useMemo(() => {
    const m: Record<string, { amount: number; count: number }> = {
      tunai: { amount: 0, count: 0 },
      transfer: { amount: 0, count: 0 },
      piutang: { amount: 0, count: 0 },
    };
    filteredPayments.forEach(p => {
      const key = p.paymentType as string;
      if (!m[key]) m[key] = { amount: 0, count: 0 };
      m[key].amount += Number(p.paidAmount ?? p.totalAmount ?? 0);
      m[key].count += 1;
    });
    return m;
  }, [filteredPayments]);

  // ── Service table ─────────────────────────────────────────────────────────
  const serviceRows = useMemo(() => {
    const svcMap: Record<string, {
      tagihan: number; dibayar: number; sisa: number; diserahkan: number; totalPkg: number;
    }> = {};

    filteredPackages.forEach((p: any) => {
      const svc = p.serviceType || "lainnya";
      if (!svcMap[svc]) svcMap[svc] = { tagihan: 0, dibayar: 0, sisa: 0, diserahkan: 0, totalPkg: 0 };
      const ship = Number(p.totalShipping || 0);
      svcMap[svc].tagihan += ship;
      svcMap[svc].totalPkg += 1;
      if (p.status === "diserahkan") {
        svcMap[svc].dibayar += ship;
        svcMap[svc].diserahkan += 1;
      } else {
        svcMap[svc].sisa += ship;
      }
    });

    return Object.entries(svcMap)
      .map(([svc, d]) => ({ svc, label: SERVICE_LABELS[svc] || svc, ...d }))
      .sort((a, b) => b.tagihan - a.tagihan);
  }, [filteredPackages]);

  // ── Per-kasir table ───────────────────────────────────────────────────────
  const kasirRows = useMemo(() => {
    const m: Record<string, { tunai: number; transfer: number; piutang: number; count: number }> = {};
    filteredPayments.forEach(p => {
      const kasir = p.adminName || "—";
      if (!m[kasir]) m[kasir] = { tunai: 0, transfer: 0, piutang: 0, count: 0 };
      const amt = Number(p.paidAmount ?? p.totalAmount ?? 0);
      if (p.paymentType === "tunai") m[kasir].tunai += amt;
      else if (p.paymentType === "transfer") m[kasir].transfer += amt;
      else m[kasir].piutang += amt;
      m[kasir].count += 1;
    });
    return Object.entries(m)
      .map(([kasir, d]) => ({ kasir, total: d.tunai + d.transfer, ...d }))
      .sort((a, b) => b.total - a.total);
  }, [filteredPayments]);

  // ── Transactions for detail panel ─────────────────────────────────────────
  const detailTrx = useMemo(() => {
    return [...filteredPayments]
      .filter(p => activeMethod === null || p.paymentType === activeMethod)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [filteredPayments, activeMethod]);

  // ── Export Excel ──────────────────────────────────────────────────────────
  function exportExcel() {
    const wb = XLSX.utils.book_new();

    // Sheet 1: KPI
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Laporan Keuangan Jastip Anggun Jaya"],
      ["Tanggal", selectedDate === "all" ? "Semua" : formatDateLabel(selectedDate)],
      ["Kasir", kasirFilter === "all" ? "Semua" : kasirFilter],
      ["Layanan", layananFilter === "all" ? "Semua" : (SERVICE_LABELS[layananFilter] || layananFilter)],
      [],
      ["PEMBAYARAN DITERIMA", kpi.pembayaranDiterima],
      ["PENGELUARAN", kpi.totalPengeluaran],
      ["ARUS KAS BERSIH", kpi.arusKas],
      ["PIUTANG TERBUKA", kpi.piutangTerbuka],
    ]), "Ringkasan");

    // Sheet 2: Per jenis jastip
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(serviceRows.map(r => ({
      Layanan: r.label,
      "Tagihan (Rp)": r.tagihan,
      "Dibayar (Rp)": r.dibayar,
      "Sisa Tagihan (Rp)": r.sisa,
      "Paket Diserahkan": r.diserahkan,
      "Total Paket": r.totalPkg,
    }))), "Per Jenis Jastip");

    // Sheet 3: Transaksi pembayaran
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filteredPayments.map(p => ({
      Waktu: formatTime(p.createdAt),
      Kasir: p.adminName || "-",
      Metode: p.paymentType,
      "Total Tagihan (Rp)": Number(p.totalAmount || 0),
      "Dibayar (Rp)": Number(p.paidAmount || p.totalAmount || 0),
      Keterangan: p.notes || "",
    }))), "Transaksi");

    // Sheet 4: Pengeluaran
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filteredPengeluaran.map(e => ({
      Tanggal: e.tanggal,
      Kategori: e.kategori,
      "Nominal (Rp)": Number(e.nominal || 0),
      Metode: e.metodePembayaran,
      Keterangan: e.keterangan || "",
    }))), "Pengeluaran");

    XLSX.writeFile(wb, `keuangan-${selectedDate || "all"}.xlsx`);
  }

  const isLoading = pkgLoading || loadingPay;
  const dateLabel = selectedDate === "all"
    ? "Semua tanggal"
    : formatDateLabel(selectedDate);

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Laporan Keuangan</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Seluruh penerimaan, pengeluaran, piutang, dan status kasir
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportExcel} className="gap-2 self-start sm:self-auto">
          <Download className="w-4 h-4" />Export Excel
        </Button>
      </div>

      {/* ── Filter Bar ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center bg-muted/30 border rounded-xl px-4 py-3">
        {/* Date */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">Tanggal:</span>
          <input
            type="date"
            className="text-sm font-medium border rounded-md px-2 py-1 bg-background h-8 focus:outline-none focus:ring-2 focus:ring-primary/30"
            value={selectedDate === "all" ? "" : selectedDate}
            onChange={e => setSelectedDate(e.target.value || "all")}
          />
          {selectedDate !== "all" && (
            <button
              className="text-xs text-muted-foreground hover:text-foreground underline"
              onClick={() => setSelectedDate("all")}
            >Semua</button>
          )}
        </div>

        <div className="w-px h-5 bg-border mx-1 hidden sm:block" />

        {/* Kasir */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground font-medium">Kasir:</span>
          <Select value={kasirFilter} onValueChange={setKasirFilter}>
            <SelectTrigger className="h-8 text-sm w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              {kasirList.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Metode */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground font-medium">Metode:</span>
          <Select value={metodeFilter} onValueChange={setMetodeFilter}>
            <SelectTrigger className="h-8 text-sm w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value="tunai">Tunai</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
              <SelectItem value="piutang">Piutang</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Layanan */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground font-medium">Layanan:</span>
          <Select value={layananFilter} onValueChange={setLayananFilter}>
            <SelectTrigger className="h-8 text-sm w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value="jastip pesawat">Pesawat</SelectItem>
              <SelectItem value="jastip hemat+">Hemat+</SelectItem>
              <SelectItem value="jastip kargo">Kargo</SelectItem>
              <SelectItem value="jastip pelni">Pelni</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Badge tanggal */}
        <Badge variant="secondary" className="ml-auto text-xs">{dateLabel}</Badge>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1,2,3,4].map(i => <div key={i} className="h-28 bg-muted rounded-xl" />)}
          </div>
        </div>
      ) : (
        <>
          {/* ── KPI Cards ───────────────────────────────────────────────── */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">
              Ringkasan Utama
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                title="Pembayaran Diterima"
                subtitle="uang benar-benar diterima"
                value={formatRp(kpi.pembayaranDiterima)}
                sub={`${filteredPayments.filter(p => p.paymentType !== "piutang").length} transaksi`}
                color="border-l-green-500"
                icon={Wallet}
                clickable
                onClick={() => { setActiveMethod(null); setShowTrxDetail(true); }}
              />
              <KpiCard
                title="Pengeluaran"
                subtitle="operasional"
                value={formatRp(kpi.totalPengeluaran)}
                sub={`${filteredPengeluaran.length} item pengeluaran`}
                color="border-l-red-400"
                icon={TrendingDown}
                clickable
                onClick={() => setLocation("/owner/pengeluaran")}
              />
              <KpiCard
                title="Arus Kas Bersih"
                subtitle="penerimaan − pengeluaran"
                value={formatRp(kpi.arusKas)}
                sub={kpi.arusKas >= 0 ? "positif" : "defisit"}
                color={kpi.arusKas >= 0 ? "border-l-blue-500" : "border-l-orange-500"}
                icon={ArrowUpDown}
              />
              <KpiCard
                title="Piutang Terbuka"
                subtitle="belum lunas / sebagian"
                value={formatRp(kpi.piutangTerbuka)}
                sub={`${payments.filter(p => p.paymentType === "piutang").length} transaksi`}
                color="border-l-amber-500"
                icon={AlertCircle}
                clickable
                onClick={() => { setMetodeFilter("piutang"); setSelectedDate("all"); }}
              />
            </div>
          </div>

          {/* ── Method Cards ─────────────────────────────────────────────── */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">
              Penerimaan Berdasarkan Metode Pembayaran
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <MethodCard
                label="Tunai"
                amount={byMethod.tunai?.amount ?? 0}
                count={byMethod.tunai?.count ?? 0}
                color="border-t-green-500"
                icon={Banknote}
                onClick={() => { setActiveMethod("tunai"); setShowTrxDetail(true); }}
              />
              <MethodCard
                label="Transfer"
                amount={byMethod.transfer?.amount ?? 0}
                count={byMethod.transfer?.count ?? 0}
                color="border-t-blue-500"
                icon={ArrowRightLeft}
                onClick={() => { setActiveMethod("transfer"); setShowTrxDetail(true); }}
              />
              <MethodCard
                label="Piutang"
                amount={byMethod.piutang?.amount ?? 0}
                count={byMethod.piutang?.count ?? 0}
                color="border-t-amber-500"
                icon={Clock}
                onClick={() => { setActiveMethod("piutang"); setShowTrxDetail(true); }}
              />
            </div>
          </div>

          {/* ── Service Summary Table ────────────────────────────────────── */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">
              Ringkasan Per Jenis Jastip
            </p>
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Layanan</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Tagihan</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Dibayar</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Sisa tagihan</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Paket diserahkan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serviceRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-muted-foreground text-sm">
                          Belum ada data untuk periode ini
                        </td>
                      </tr>
                    ) : (
                      serviceRows.map(row => (
                        <tr
                          key={row.svc}
                          className="border-b hover:bg-muted/20 cursor-pointer transition-colors"
                          onClick={() => setLocation(`/owner/packages?serviceType=${encodeURIComponent(row.svc)}`)}
                        >
                          <td className="py-3 px-4 font-medium whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${SERVICE_COLOR[row.svc] || "bg-gray-400"}`} />
                              {row.label}
                              <span className="text-xs text-muted-foreground">({row.totalPkg} paket)</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-semibold whitespace-nowrap">
                            {formatRp(row.tagihan)}
                          </td>
                          <td className="py-3 px-4 text-right text-green-700 font-semibold whitespace-nowrap">
                            {row.dibayar > 0 ? formatRp(row.dibayar) : <span className="text-muted-foreground font-normal">—</span>}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            {row.sisa > 0
                              ? <span className="text-amber-700 font-semibold">{formatRp(row.sisa)}</span>
                              : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <span className={`font-bold ${row.diserahkan > 0 ? "text-green-700" : "text-muted-foreground"}`}>
                              {row.diserahkan}
                            </span>
                            <span className="text-muted-foreground text-xs ml-1">/ {row.totalPkg}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {serviceRows.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 bg-muted/10 font-bold">
                        <td className="py-3 px-4">Total</td>
                        <td className="py-3 px-4 text-right">{formatRp(serviceRows.reduce((s, r) => s + r.tagihan, 0))}</td>
                        <td className="py-3 px-4 text-right text-green-700">{formatRp(serviceRows.reduce((s, r) => s + r.dibayar, 0))}</td>
                        <td className="py-3 px-4 text-right text-amber-700">{formatRp(serviceRows.reduce((s, r) => s + r.sisa, 0))}</td>
                        <td className="py-3 px-4 text-right text-green-700">
                          {serviceRows.reduce((s, r) => s + r.diserahkan, 0)}
                          <span className="text-muted-foreground font-normal text-xs ml-1">
                            / {serviceRows.reduce((s, r) => s + r.totalPkg, 0)}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </Card>
          </div>

          {/* ── Kasir Table ──────────────────────────────────────────────── */}
          {kasirRows.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">
                Rekapitulasi Per Kasir
              </p>
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Kasir</th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Tunai</th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Transfer</th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Piutang</th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Total Diterima</th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Jml Trx</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kasirRows.map((row, i) => (
                        <tr key={row.kasir} className={`border-b hover:bg-muted/20 ${i % 2 === 1 ? "bg-muted/5" : ""}`}>
                          <td className="py-3 px-4 font-semibold">{row.kasir}</td>
                          <td className="py-3 px-4 text-right text-green-700 font-medium whitespace-nowrap">
                            {row.tunai > 0 ? formatRp(row.tunai) : <span className="text-muted-foreground font-normal">—</span>}
                          </td>
                          <td className="py-3 px-4 text-right text-blue-700 font-medium whitespace-nowrap">
                            {row.transfer > 0 ? formatRp(row.transfer) : <span className="text-muted-foreground font-normal">—</span>}
                          </td>
                          <td className="py-3 px-4 text-right text-amber-700 font-medium whitespace-nowrap">
                            {row.piutang > 0 ? formatRp(row.piutang) : <span className="text-muted-foreground font-normal">—</span>}
                          </td>
                          <td className="py-3 px-4 text-right font-bold whitespace-nowrap">
                            {formatRp(row.tunai + row.transfer)}
                          </td>
                          <td className="py-3 px-4 text-right text-muted-foreground">{row.count}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 bg-muted/10 font-bold">
                        <td className="py-3 px-4">Total</td>
                        <td className="py-3 px-4 text-right text-green-700">{formatRp(kasirRows.reduce((s, r) => s + r.tunai, 0))}</td>
                        <td className="py-3 px-4 text-right text-blue-700">{formatRp(kasirRows.reduce((s, r) => s + r.transfer, 0))}</td>
                        <td className="py-3 px-4 text-right text-amber-700">{formatRp(kasirRows.reduce((s, r) => s + r.piutang, 0))}</td>
                        <td className="py-3 px-4 text-right">{formatRp(kasirRows.reduce((s, r) => s + r.tunai + r.transfer, 0))}</td>
                        <td className="py-3 px-4 text-right text-muted-foreground">{kasirRows.reduce((s, r) => s + r.count, 0)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* ── Transaction Detail (collapsible) ────────────────────────── */}
          <div>
            <button
              className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-2.5"
              onClick={() => setShowTrxDetail(v => !v)}
            >
              {showTrxDetail ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              Detail Transaksi Pembayaran
              {activeMethod && (
                <Badge variant="secondary" className="ml-1 capitalize text-[10px] normal-case font-normal">
                  {activeMethod}
                  <button className="ml-1 opacity-60 hover:opacity-100" onClick={e => { e.stopPropagation(); setActiveMethod(null); }}>×</button>
                </Badge>
              )}
              <Badge variant="outline" className="ml-1 text-[10px] font-normal">{detailTrx.length} transaksi</Badge>
            </button>

            {showTrxDetail && (
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Jam</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Kasir</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Layanan</th>
                        <th className="text-right py-3 px-3 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Tagihan</th>
                        <th className="text-right py-3 px-3 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Dibayar</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Metode</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailTrx.length === 0 ? (
                        <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">Belum ada transaksi</td></tr>
                      ) : detailTrx.map((p, i) => {
                        // Get service types from packages in this payment
                        const ids: number[] = p.packageIds || [];
                        const svcTypes = [...new Set(ids.map(id => pkgMap.get(id)?.serviceType).filter(Boolean))];
                        const svcLabel = svcTypes.map(s => SERVICE_LABELS[s] || s).join(", ") || "—";

                        const isPiutang = p.paymentType === "piutang";
                        const isLunas = !isPiutang && Number(p.paidAmount || 0) >= Number(p.totalAmount || 0);

                        return (
                          <tr key={p.id} className={`border-b transition-colors ${i % 2 === 1 ? "bg-muted/5" : ""} hover:bg-muted/20`}>
                            <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap font-mono text-xs">
                              {formatTime(p.createdAt)}
                            </td>
                            <td className="py-2.5 px-3 font-medium whitespace-nowrap">{p.adminName || "—"}</td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {svcTypes.length > 0 ? (
                                <span className="flex items-center gap-1">
                                  <span className={`w-2 h-2 rounded-full inline-block shrink-0 ${SERVICE_COLOR[svcTypes[0]] || "bg-gray-400"}`} />
                                  {svcLabel}
                                </span>
                              ) : "—"}
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap font-medium">
                              {formatRp(Number(p.totalAmount || 0))}
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap font-semibold text-green-700">
                              {isPiutang
                                ? <span className="text-amber-700">{formatRp(Number(p.paidAmount || 0))}</span>
                                : formatRp(Number(p.paidAmount || p.totalAmount || 0))}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                p.paymentType === "tunai"    ? "bg-green-100 text-green-800" :
                                p.paymentType === "transfer" ? "bg-blue-100 text-blue-800" :
                                "bg-amber-100 text-amber-800"
                              }`}>
                                {p.paymentType === "tunai" ? "Tunai" : p.paymentType === "transfer" ? "Transfer" : "Piutang"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs max-w-[160px] truncate">
                              {p.notes || "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {detailTrx.length > 0 && (
                      <tfoot>
                        <tr className="border-t-2 bg-muted/10 font-bold">
                          <td className="py-2.5 px-3" colSpan={3}>
                            Total ({detailTrx.length} transaksi)
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {formatRp(detailTrx.reduce((s, p) => s + Number(p.totalAmount || 0), 0))}
                          </td>
                          <td className="py-2.5 px-3 text-right text-green-700">
                            {formatRp(detailTrx
                              .filter(p => p.paymentType !== "piutang")
                              .reduce((s, p) => s + Number(p.paidAmount ?? p.totalAmount ?? 0), 0))}
                          </td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </Card>
            )}
          </div>

          {/* ── Quick link to pengeluaran ────────────────────────────────── */}
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground text-xs gap-1.5"
              onClick={() => setLocation("/owner/pengeluaran")}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Kelola pengeluaran operasional
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
