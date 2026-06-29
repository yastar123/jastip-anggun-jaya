import { useListPackages, PackageStatus } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { Pagination } from "@/components/pagination";
import { useState } from "react";
import { useLocation } from "wouter";
import { Search, FileDown, X } from "lucide-react";
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
  "Jasa Belanja",
];

function formatRp(n: any) {
  if (!n) return "-";
  return `Rp ${Number(n).toLocaleString("id-ID")}`;
}
function formatDate(d: string | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function packagingLabel(t: string | null | undefined) {
  const map: Record<string, string> = { karton: "Karton", plastik: "Plastik", kayu: "Kayu", bubble_wrap: "Bubble Wrap", sack: "Karung", lainnya: "Lainnya" };
  return t ? map[t] || t : "-";
}

export default function AdminPackages() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [, setLocation] = useLocation();

  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfJenis, setPdfJenis] = useState<string>("all");
  const [pdfDateFrom, setPdfDateFrom] = useState("");
  const [pdfDateTo, setPdfDateTo] = useState("");

  const { data: packages, isLoading } = useListPackages({
    search: search || undefined,
    status: status === "all" ? undefined : (status as PackageStatus),
  });

  const total = packages?.length || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const paginated = packages?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleSearch(v: string) { setSearch(v); setPage(1); }
  function handleStatus(v: string) { setStatus(v); setPage(1); }

  function exportPdf() {
    if (!packages || packages.length === 0) return;

    let filtered = [...packages] as any[];

    if (pdfJenis !== "all") {
      filtered = filtered.filter((p) =>
        (p.serviceType || "").toLowerCase() === pdfJenis.toLowerCase()
      );
    }

    if (pdfDateFrom) {
      const from = new Date(pdfDateFrom);
      from.setHours(0, 0, 0, 0);
      filtered = filtered.filter((p) => {
        const d = new Date(p.packageDate || p.createdAt);
        return d >= from;
      });
    }

    if (pdfDateTo) {
      const to = new Date(pdfDateTo);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter((p) => {
        const d = new Date(p.packageDate || p.createdAt);
        return d <= to;
      });
    }

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
      packagingLabel(p.packagingType),
      p.totalWeight ?? "-",
      p.totalShipping ? `Rp ${Number(p.totalShipping).toLocaleString("id-ID")}` : "-",
      p.status === "diserahkan" ? "Diserahkan" : "Pending",
    ]);

    autoTable(doc, {
      startY: 40,
      head: [[
        "No", "Tanggal", "No Resi", "No Paket", "Nama Konsumen",
        "Jenis Jastip", "Jenis Barang", "Berat Real", "Berat Digunakan",
        "Paking", "Total Berat", "Total Ongkir", "Status",
      ]],
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
        10: { halign: "right", cellWidth: 16 },
        11: { halign: "right", cellWidth: 24 },
        12: { halign: "center", cellWidth: 18 },
      },
      margin: { left: 14, right: 14 },
    });

    const namaFile = [
      "laporan-paket",
      pdfJenis !== "all" ? pdfJenis.replace(/\s+/g, "-").toLowerCase() : "semua",
      pdfDateFrom || "awal",
      pdfDateTo || "akhir",
    ].join("_") + ".pdf";

    doc.save(namaFile);
    setPdfOpen(false);
  }

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
        <div className="p-4 border-b flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cari resi, no paket, nama customer..." className="pl-9" value={search} onChange={(e) => handleSearch(e.target.value)} />
          </div>
          <Select value={status} onValueChange={handleStatus}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Filter Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="diserahkan">Diserahkan</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[1400px]">
            <thead>
              <tr className="border-b bg-muted/30">
                {["Tanggal","No Resi","No Paket","Nama Konsumen","Berat Real (Kg)","P (cm)","L (cm)","T (cm)","Berat Volume","Jenis Paking","Berat Digunakan","Ongkir/Kg","Total Berat","Total Ongkir","Status","Aksi"].map(h => (
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
                    <td className="py-3 px-3 whitespace-nowrap text-right">{(pkg as any).realWeight ?? "-"}</td>
                    <td className="py-3 px-3 whitespace-nowrap text-right">{(pkg as any).length ?? "-"}</td>
                    <td className="py-3 px-3 whitespace-nowrap text-right">{(pkg as any).width ?? "-"}</td>
                    <td className="py-3 px-3 whitespace-nowrap text-right">{(pkg as any).height ?? "-"}</td>
                    <td className="py-3 px-3 whitespace-nowrap text-right">{(pkg as any).volumeWeight ?? "-"}</td>
                    <td className="py-3 px-3 whitespace-nowrap">{packagingLabel((pkg as any).packagingType)}</td>
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tanggal Dari</Label>
                <Input
                  type="date"
                  value={pdfDateFrom}
                  onChange={(e) => setPdfDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tanggal Sampai</Label>
                <Input
                  type="date"
                  value={pdfDateTo}
                  onChange={(e) => setPdfDateTo(e.target.value)}
                />
              </div>
            </div>
            {(pdfJenis !== "all" || pdfDateFrom || pdfDateTo) && (
              <button
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                onClick={() => { setPdfJenis("all"); setPdfDateFrom(""); setPdfDateTo(""); }}
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
