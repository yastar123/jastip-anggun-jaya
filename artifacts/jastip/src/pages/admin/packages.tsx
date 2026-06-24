import { useListPackages, PackageStatus } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { Pagination } from "@/components/pagination";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Plus, Search, FileSpreadsheet, Barcode, Download } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import * as XLSX from "xlsx";

const PAGE_SIZE = 10;

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

  const { data: packages, isLoading } = useListPackages({
    search: search || undefined,
    status: status === "all" ? undefined : (status as PackageStatus),
  });

  const total = packages?.length || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const paginated = packages?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleSearch(v: string) { setSearch(v); setPage(1); }
  function handleStatus(v: string) { setStatus(v); setPage(1); }

  function exportExcel() {
    if (!packages || packages.length === 0) return;
    const rows = packages.map((p: any) => ({
      "Tanggal": formatDate(p.packageDate || p.createdAt),
      "No Resi": p.resiNumber || "",
      "No Paket": p.packageNumber || "",
      "Nama Konsumen": p.customerName || "",
      "Jenis Jastip": p.serviceType || "",
      "Rute": p.deliveryRoute || "",
      "Jenis Barang": p.itemName || "",
      "Berat Real (Kg)": p.realWeight ?? "",
      "P (cm)": p.length ?? "",
      "L (cm)": p.width ?? "",
      "T (cm)": p.height ?? "",
      "Berat Volume (Kg)": p.volumeWeight ?? "",
      "Jenis Paking": packagingLabel(p.packagingType),
      "Berat Digunakan (Kg)": p.usedWeight ?? "",
      "Ongkir/Kg": p.shippingRate ?? "",
      "Total Berat (Kg)": p.totalWeight ?? "",
      "Total Ongkir": p.totalShipping ?? "",
      "Status": p.status === "diserahkan" ? "Diserahkan" : "Pending",
      "Barcode": p.barcode || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Paket");
    XLSX.writeFile(wb, `data-paket-${new Date().toISOString().split("T")[0]}.xlsx`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Semua Paket</h1>
          <p className="text-muted-foreground mt-1">Kelola data paket pelanggan.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportExcel} disabled={!packages || packages.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/packages/import">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Import Excel
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/barcode">
              <Barcode className="w-4 h-4 mr-2" />
              Label Barcode
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/admin/packages/type">
              <Plus className="w-4 h-4 mr-2" />
              Input Paket Baru
            </Link>
          </Button>
        </div>
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
    </div>
  );
}
