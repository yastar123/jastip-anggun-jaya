import { useListPackages, PackageStatus } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { Pagination } from "@/components/pagination";
import { useState } from "react";
import { useLocation } from "wouter";
import { Search, FileDown, X, Filter } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const PAGE_SIZE = 10;

const JENIS_JASTIP = [
  "Jastip Cargo",
  "Jastip Hemat+",
  "Jastip Pelni",
  "Jastip Pesawat",
];

const GROUPED_JENIS = ["jastip hemat+", "jastip pelni", "jastip pesawat"];

function formatRp(n: any) {
  if (n == null || n === "" || n === 0) return "-";
  return `Rp ${Number(n).toLocaleString("id-ID")}`;
}
function formatRpForce(n: any) {
  if (n == null || n === "") return "-";
  return `Rp ${Number(n).toLocaleString("id-ID")}`;
}
function formatDate(d: string | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function serviceTypeLabel(t: string | null | undefined) {
  if (!t) return "-";
  const map: Record<string, string> = {
    "jastip cargo": "Jastip Cargo",
    "jastip hemat+": "Jastip Hemat+",
    "jastip pelni": "Jastip Pelni",
    "jastip pesawat": "Jastip Pesawat",
    "jasa belanja": "Jasa Belanja",
  };
  return map[t.toLowerCase()] || t;
}

function fNum(n: any, decimals = 1) {
  if (n == null || n === "") return "";
  const v = Number(n);
  return isNaN(v) ? "" : v.toFixed(decimals);
}

export default function AdminPackages() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [filterJenis, setFilterJenis] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [, setLocation] = useLocation();

  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfJenis, setPdfJenis] = useState<string>("all");
  const [pdfDateFrom, setPdfDateFrom] = useState("");
  const [pdfDateTo, setPdfDateTo] = useState("");
  const [pdfNamaKapal, setPdfNamaKapal] = useState("");

  const { data: packages, isLoading } = useListPackages({
    search: search || undefined,
    status: status === "all" ? undefined : (status as any),
  });

  function applyTableFilters(data: any[]): any[] {
    let filtered = [...data];
    if (filterJenis !== "all") {
      filtered = filtered.filter((p) =>
        (p.serviceType || "").toLowerCase() === filterJenis.toLowerCase()
      );
    }
    if (filterDateFrom) {
      const from = new Date(filterDateFrom);
      from.setHours(0, 0, 0, 0);
      filtered = filtered.filter((p) => new Date(p.packageDate || p.createdAt) >= from);
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter((p) => new Date(p.packageDate || p.createdAt) <= to);
    }
    return filtered;
  }

  const displayed = applyTableFilters(packages || []);
  const total = displayed.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const paginated = displayed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hasTableFilter = filterJenis !== "all" || filterDateFrom || filterDateTo;

  function handleSearch(v: string) { setSearch(v); setPage(1); }
  function handleStatus(v: string) { setStatus(v); setPage(1); }
  function handleFilterJenis(v: string) { setFilterJenis(v); setPage(1); }
  function resetTableFilters() { setFilterJenis("all"); setFilterDateFrom(""); setFilterDateTo(""); setPage(1); }

  function getFilteredPackages() {
    if (!packages) return [];
    let filtered = [...packages] as any[];
    if (pdfJenis !== "all") {
      filtered = filtered.filter((p) =>
        (p.serviceType || "").toLowerCase() === pdfJenis.toLowerCase()
      );
    }
    if (pdfDateFrom) {
      const from = new Date(pdfDateFrom);
      from.setHours(0, 0, 0, 0);
      filtered = filtered.filter((p) => new Date(p.packageDate || p.createdAt) >= from);
    }
    if (pdfDateTo) {
      const to = new Date(pdfDateTo);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter((p) => new Date(p.packageDate || p.createdAt) <= to);
    }
    return filtered;
  }

  function isGroupedExport() {
    return GROUPED_JENIS.includes(pdfJenis.toLowerCase());
  }

  function exportPdf() {
    if (!packages || packages.length === 0) return;
    if (isGroupedExport()) {
      exportPdfGrouped();
    } else {
      exportPdfFlat();
    }
  }

  function exportPdfGrouped() {
    const filtered = getFilteredPackages();
    if (filtered.length === 0) return;

    filtered.sort((a: any, b: any) =>
      (a.customerName || "").localeCompare(b.customerName || "", "id")
    );

    const groups = new Map<string, any[]>();
    for (const pkg of filtered) {
      const name = (pkg.customerName || "(Tanpa Nama)").trim();
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name)!.push(pkg);
    }

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = 297;
    const margin = 10;

    const totalPaket = filtered.length;
    const totalBeratAll = filtered.reduce((s: number, p: any) => s + (Number(p.usedWeight) || 0), 0);

    const serviceUpper: Record<string, string> = {
      "jastip pelni": "JASTIP PELNI",
      "jastip hemat+": "JASTIP HEMAT+",
      "jastip pesawat": "JASTIP PESAWAT",
    };
    const ruteDefault: Record<string, string> = {
      "jastip pesawat": "JAKARTA - MANOKWARI",
      "jastip hemat+": "SURABAYA - MANOKWARI",
      "jastip pelni": "JAKARTA - MANOKWARI",
    };

    const jenisKey = pdfJenis.toLowerCase();
    const titleText = (serviceUpper[jenisKey] || pdfJenis.toUpperCase()) +
      (pdfNamaKapal ? " " + pdfNamaKapal.toUpperCase() : "");
    const rute = ruteDefault[jenisKey] || "-";
    // ── Header halaman ──────────────────────────────────────────────────────
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(titleText, pageW / 2, 11, { align: "center" });

    const infoRows: [string, string][] = [
      ["Rute", rute],
      ["Jumlah Paket", `${totalPaket} Item`],
    ];

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const labelX = 45;
    const valX = 95;
    let y = 17;
    for (const [lbl, val] of infoRows) {
      doc.text(lbl, labelX, y);
      doc.text(val, valX, y);
      y += 4.2;
    }
    y += 3;

    // ── Header tabel (reusable) ─────────────────────────────────────────────
    const tableHead = [[
      "TANGGAL", "NO RESI", "SCAN PAKET",
      "STATUS NO\nSCAN PAKET",
      "NAMA\nKONSUMEN",
      "BERAT\nREAL", "P", "L", "T",
      "BERAT\nVOLUME",
      "BERAT YANG\nDI GUNAKAN",
      "ONGKIR PER\nPAKET",
      "TOTAL\nBERAT",
      "HARGA",
      "TOTAL ONGKIR\nJASTIP",
    ]];

    const colStyles: Record<number, object> = {
      0:  { cellWidth: 17 },
      1:  { cellWidth: 27 },
      2:  { cellWidth: 27 },
      3:  { cellWidth: 14, halign: "center" },
      4:  { cellWidth: 19 },
      5:  { cellWidth: 10, halign: "right" },
      6:  { cellWidth: 7,  halign: "right" },
      7:  { cellWidth: 7,  halign: "right" },
      8:  { cellWidth: 7,  halign: "right" },
      9:  { cellWidth: 11, halign: "right" },
      10: { cellWidth: 15, halign: "right" },
      11: { cellWidth: 20, halign: "right" },
      12: { cellWidth: 14, halign: "right" },
      13: { cellWidth: 17, halign: "right" },
      14: { cellWidth: 22, halign: "right" },
    };

    // ── Loop per grup konsumen ──────────────────────────────────────────────
    for (const [customerName, pkgs] of groups) {
      const totalBeratGrup = pkgs.reduce((s: number, p: any) => s + (Number(p.usedWeight) || 0), 0);
      const totalOngkirGrup = pkgs.reduce((s: number, p: any) => s + (Number(p.totalShipping) || 0), 0);
      const hargaPerKg = pkgs.find((p: any) => p.shippingRate != null)?.shippingRate ?? null;

      if (210 - y < 22) { doc.addPage(); y = 10; }

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.text(`NAMA KONSUMEN       ${customerName}`, margin, y + 3);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.text(`  Jumlah Paket:     ${pkgs.length}.0`, margin, y + 7.5);
      y += 12;

      const rows = pkgs.map((p: any, i: number) => [
        formatDate(p.packageDate || p.createdAt),
        p.resiNumber || "-",
        p.barcode || p.resiNumber || "-",
        p.status === "diserahkan" ? "SUDAH\nSCAN" : "BELUM\nSCAN",
        p.customerName || "-",
        fNum(p.realWeight, 1),
        fNum(p.length, 0),
        fNum(p.width, 0),
        fNum(p.height, 0),
        p.volumeWeight != null ? fNum(p.volumeWeight, 1) : "0.0",
        fNum(p.usedWeight, 1),
        p.totalShipping != null ? `Rp ${Number(p.totalShipping).toLocaleString("id-ID")}` : "-",
        i === 0 ? totalBeratGrup.toFixed(1) : "",
        i === 0 && hargaPerKg != null ? `Rp ${Number(hargaPerKg).toLocaleString("id-ID")}` : (i === 0 ? "-" : ""),
        i === 0 ? `Rp ${totalOngkirGrup.toLocaleString("id-ID")}` : "",
      ]);

      autoTable(doc, {
        startY: y,
        head: tableHead,
        body: rows,
        styles: { fontSize: 5.8, cellPadding: 1.1, overflow: "ellipsize", lineColor: [200, 200, 200], lineWidth: 0.1 },
        headStyles: { fillColor: [185, 28, 28], textColor: 255, fontStyle: "bold", fontSize: 5.8, halign: "center", valign: "middle" },
        alternateRowStyles: { fillColor: [253, 248, 248] },
        columnStyles: colStyles,
        margin: { left: margin, right: margin },
        tableLineColor: [200, 200, 200],
        tableLineWidth: 0.1,
      });

      y = (doc as any).lastAutoTable.finalY + 8;
    }

    const safeJenis = pdfJenis.replace(/\+/g, "plus").replace(/\s+/g, "-").toLowerCase();
    const safeKapal = pdfNamaKapal ? `-${pdfNamaKapal.replace(/\s+/g, "-")}` : "";
    doc.save(`laporan-${safeJenis}${safeKapal}-${pdfDateFrom || "awal"}-${pdfDateTo || "akhir"}.pdf`);
    setPdfOpen(false);
  }

  function exportPdfFlat() {
    const filtered = getFilteredPackages();
    if (filtered.length === 0) return;

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const judul = pdfJenis !== "all" ? pdfJenis : "Semua Jenis Jastip";
    const periodeFrom = pdfDateFrom ? new Date(pdfDateFrom).toLocaleDateString("id-ID") : "-";
    const periodeTo = pdfDateTo ? new Date(pdfDateTo).toLocaleDateString("id-ID") : "-";

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Jastip Anggun Jaya — Laporan Paket", 14, 14);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Jenis Jastip : ${judul}`, 14, 21);
    doc.text(`Periode      : ${periodeFrom} s/d ${periodeTo}`, 14, 26);
    doc.text(`Dicetak      : ${new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}`, 14, 31);
    doc.text(`Total Paket  : ${filtered.length} paket`, 14, 36);

    const rows = filtered.map((p: any, i: number) => [
      i + 1,
      formatDate(p.packageDate || p.createdAt),
      p.resiNumber || "-",
      p.packageNumber || "-",
      p.customerName || "-",
      p.serviceType || "-",
      p.itemName || "-",
      p.realWeight ?? "-",
      p.usedWeight ?? "-",
      p.totalWeight ?? "-",
      p.totalShipping ? `Rp ${Number(p.totalShipping).toLocaleString("id-ID")}` : "-",
      p.status === "diserahkan" ? "Diserahkan" : "Pending",
    ]);

    autoTable(doc, {
      startY: 40,
      head: [["No", "Tanggal", "No Resi", "No Paket", "Nama Konsumen", "Jenis Jastip", "Jenis Barang", "Berat Real", "Berat Digunakan", "Total Berat", "Total Ongkir", "Status"]],
      body: rows,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [200, 30, 30], textColor: 255, fontStyle: "bold", fontSize: 7 },
      alternateRowStyles: { fillColor: [250, 245, 245] },
      columnStyles: {
        0: { halign: "center", cellWidth: 8 },
        1: { cellWidth: 18 },
        2: { cellWidth: 22 },
        3: { cellWidth: 18 },
        7: { halign: "right", cellWidth: 16 },
        8: { halign: "right", cellWidth: 18 },
        9: { halign: "right", cellWidth: 16 },
        10: { halign: "right", cellWidth: 24 },
        11: { halign: "center", cellWidth: 18 },
      },
      margin: { left: 14, right: 14 },
    });

    const namaFile = ["laporan-paket", pdfJenis !== "all" ? pdfJenis.replace(/\s+/g, "-").toLowerCase() : "semua", pdfDateFrom || "awal", pdfDateTo || "akhir"].join("_") + ".pdf";
    doc.save(namaFile);
    setPdfOpen(false);
  }

  const showGroupedFields = isGroupedExport();
  const showNamaKapal = pdfJenis.toLowerCase() === "jastip pelni";

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Semua Paket</h1>
          <p className="text-muted-foreground mt-1">Kelola data paket pelanggan.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPdfOpen(true)}
          disabled={!packages || packages.length === 0}
        >
          <FileDown className="w-4 h-4 mr-2" />
          Export PDF
        </Button>
      </div>

      <Card>
        <div className="p-4 border-b space-y-3">
          {/* Row 1: search + export */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cari resi, no paket, nama customer..." className="pl-9" value={search} onChange={(e) => handleSearch(e.target.value)} />
            </div>
          </div>
          {/* Row 2: filters */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium shrink-0">
              <Filter className="w-3.5 h-3.5" /> Filter:
            </div>
            <Select value={status} onValueChange={handleStatus}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="diserahkan">Diserahkan</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterJenis} onValueChange={handleFilterJenis}>
              <SelectTrigger className="w-full sm:w-[170px]">
                <SelectValue placeholder="Jenis Jastip" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Jenis</SelectItem>
                {JENIS_JASTIP.map((j) => (
                  <SelectItem key={j} value={j}>{j}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 w-full sm:w-auto">
              <span className="text-xs text-muted-foreground shrink-0">Tanggal:</span>
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <Input
                  type="date"
                  className="w-full sm:w-[145px] text-sm"
                  value={filterDateFrom}
                  onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1); }}
                />
                <span className="text-xs text-muted-foreground shrink-0">–</span>
                <Input
                  type="date"
                  className="w-full sm:w-[145px] text-sm"
                  value={filterDateTo}
                  onChange={(e) => { setFilterDateTo(e.target.value); setPage(1); }}
                />
              </div>
            </div>
            {hasTableFilter && (
              <button
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground flex items-center gap-1"
                onClick={resetTableFilters}
              >
                <X className="w-3 h-3" /> Reset filter
              </button>
            )}
          </div>
          {/* Active filter summary */}
          {hasTableFilter && (
            <p className="text-xs text-muted-foreground">
              Menampilkan <span className="font-semibold text-foreground">{total}</span> paket
              {filterJenis !== "all" && <> · Jenis: <span className="font-medium text-foreground">{filterJenis}</span></>}
              {filterDateFrom && <> · Dari: <span className="font-medium text-foreground">{new Date(filterDateFrom).toLocaleDateString("id-ID")}</span></>}
              {filterDateTo && <> · s/d: <span className="font-medium text-foreground">{new Date(filterDateTo).toLocaleDateString("id-ID")}</span></>}
            </p>
          )}
        </div>
        {/* Mobile card view */}
        <CardContent className="p-0 md:hidden">
          {isLoading ? (
            <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">Memuat data...</div>
          ) : paginated && paginated.length > 0 ? (
            <div className="divide-y">
              {paginated.map((pkg) => (
                <div
                  key={pkg.id}
                  className="p-4 cursor-pointer hover:bg-muted/20 active:bg-muted/30 transition-colors"
                  onClick={() => setLocation(`/admin/packages/${pkg.id}`)}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{pkg.customerName || "-"}</p>
                      <p className="text-xs font-mono text-muted-foreground truncate">{pkg.resiNumber || "-"}{(pkg as any).packageNumber ? ` · #${(pkg as any).packageNumber}` : ""}</p>
                    </div>
                    <StatusBadge status={pkg.status} />
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-1">
                    <span className="inline-flex items-center rounded-full px-1.5 py-0.5 bg-primary/10 text-primary font-medium">{serviceTypeLabel((pkg as any).serviceType)}</span>
                    <span>{formatDate((pkg as any).packageDate || pkg.createdAt)}</span>
                    {(pkg as any).usedWeight && <span>{(pkg as any).usedWeight} Kg</span>}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-bold text-primary text-sm">{(pkg as any).totalShipping ? formatRp((pkg as any).totalShipping) : "-"}</span>
                    <span className="text-xs text-primary font-medium">Detail →</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">Data paket tidak ditemukan.</div>
          )}
        </CardContent>
        {/* Desktop table */}
        <CardContent className="p-0 overflow-x-auto hidden md:block">
          <table className="w-full text-sm min-w-[1400px]">
            <thead>
              <tr className="border-b bg-muted/30">
                {["Tanggal","No Resi","No Paket","Nama Konsumen","Jenis Jastip","Berat Real (Kg)","P (cm)","L (cm)","T (cm)","Berat Volume","Berat Digunakan","Ongkir/Kg","Total Berat","Total Ongkir","Status","Aksi"].map(h => (
                  <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={16} className="h-24 text-center text-muted-foreground py-10">Memuat data...</td></tr>
              ) : paginated && paginated.length > 0 ? (
                paginated.map((pkg) => (
                  <tr key={pkg.id} className="border-b hover:bg-muted/20 cursor-pointer transition-colors" onClick={() => setLocation(`/admin/packages/${pkg.id}`)}>
                    <td className="py-3 px-3 whitespace-nowrap text-muted-foreground">{formatDate((pkg as any).packageDate || pkg.createdAt)}</td>
                    <td className="py-3 px-3 font-mono font-medium whitespace-nowrap">{pkg.resiNumber || "-"}</td>
                    <td className="py-3 px-3 font-mono whitespace-nowrap">{(pkg as any).packageNumber || "-"}</td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="font-medium">{pkg.customerName || "-"}</div>
                      <div className="text-xs text-muted-foreground">{pkg.customerPhone || ""}</div>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary">
                        {serviceTypeLabel((pkg as any).serviceType)}
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-right">{(pkg as any).realWeight ?? "-"}</td>
                    <td className="py-3 px-3 whitespace-nowrap text-right">{(pkg as any).length ?? "-"}</td>
                    <td className="py-3 px-3 whitespace-nowrap text-right">{(pkg as any).width ?? "-"}</td>
                    <td className="py-3 px-3 whitespace-nowrap text-right">{(pkg as any).height ?? "-"}</td>
                    <td className="py-3 px-3 whitespace-nowrap text-right">{(pkg as any).volumeWeight ?? "-"}</td>
                    <td className="py-3 px-3 whitespace-nowrap text-right font-medium">{(pkg as any).usedWeight ?? "-"}</td>
                    <td className="py-3 px-3 whitespace-nowrap text-right">{(pkg as any).shippingRate ? formatRp((pkg as any).shippingRate) : "-"}</td>
                    <td className="py-3 px-3 whitespace-nowrap text-right">{(pkg as any).totalWeight ?? "-"}</td>
                    <td className="py-3 px-3 whitespace-nowrap text-right font-semibold text-primary">{(pkg as any).totalShipping ? formatRp((pkg as any).totalShipping) : "-"}</td>
                    <td className="py-3 px-3 whitespace-nowrap"><StatusBadge status={pkg.status} /></td>
                    <td className="py-3 px-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" onClick={() => setLocation(`/admin/packages/${pkg.id}`)}>Detail</Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={16} className="h-32 text-center text-muted-foreground">Data paket tidak ditemukan.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </Card>

      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileDown className="w-5 h-5 text-primary" />
              Export Laporan PDF
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Jenis Jastip</Label>
              <Select value={pdfJenis} onValueChange={setPdfJenis}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih jenis jastip" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Jenis</SelectItem>
                  {JENIS_JASTIP.map((j) => (
                    <SelectItem key={j} value={j}>{j}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {showGroupedFields && (
              <>
                {showNamaKapal && (
                  <div className="space-y-1.5">
                    <Label>Nama Kapal <span className="text-muted-foreground font-normal text-xs">(Opsional)</span></Label>
                    <Input
                      placeholder="Contoh: KM DEMPO"
                      value={pdfNamaKapal}
                      onChange={(e) => setPdfNamaKapal(e.target.value)}
                    />
                  </div>
                )}
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tanggal Dari</Label>
                <Input type="date" value={pdfDateFrom} onChange={(e) => setPdfDateFrom(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Tanggal Sampai</Label>
                <Input type="date" value={pdfDateTo} onChange={(e) => setPdfDateTo(e.target.value)} />
              </div>
            </div>

            {(pdfJenis !== "all" || pdfDateFrom || pdfDateTo || pdfNamaKapal) && (
              <button
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                onClick={() => { setPdfJenis("all"); setPdfDateFrom(""); setPdfDateTo(""); setPdfNamaKapal(""); }}
              >
                <X className="w-3 h-3 inline mr-1" />
                Reset filter
              </button>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPdfOpen(false)}>Batal</Button>
            <Button onClick={exportPdf} disabled={!packages || packages.length === 0}>
              <FileDown className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
