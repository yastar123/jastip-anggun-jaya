import { useListPackages, PackageStatus } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { Pagination } from "@/components/pagination";
import { useState } from "react";
import { useLocation } from "wouter";
import { Search, Download, ScanLine, CheckCircle2, XCircle, AlertCircle, Hash } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
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
  return t ? (map[t] || t) : "-";
}

export default function OwnerPackages() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Scan verification state
  const [scanInput, setScanInput] = useState("");
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [scanError, setScanError] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isActioning, setIsActioning] = useState(false);

  const { data: packages, isLoading, refetch } = useListPackages({
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
    XLSX.utils.book_append_sheet(wb, ws, "Monitor Paket");
    XLSX.writeFile(wb, `monitor-paket-${new Date().toISOString().split("T")[0]}.xlsx`);
  }

  async function doScan(code: string) {
    if (!code.trim()) return;
    setIsScanning(true);
    setScanResult(null);
    setScanError("");
    try {
      const token = localStorage.getItem("jaj_token");
      const r = await fetch(`/api/packages/scan/${encodeURIComponent(code.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      if (data.package) {
        setScanResult(data.package);
      } else {
        const r2 = await fetch(`/api/packages?search=${encodeURIComponent(code.trim())}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const pkgs = await r2.json();
        if (Array.isArray(pkgs) && pkgs.length > 0) {
          setScanResult(pkgs[0]);
        } else {
          setScanError("Paket tidak ditemukan. Periksa kembali nomor resi atau barcode.");
        }
      }
    } catch {
      setScanError("Terjadi kesalahan saat mencari paket.");
    } finally {
      setIsScanning(false);
    }
  }

  async function serahkan() {
    if (!scanResult) return;
    setIsActioning(true);
    try {
      const token = localStorage.getItem("jaj_token");
      const r = await fetch(`/api/packages/${scanResult.id}/serahkan`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!r.ok) throw new Error("Gagal");
      const updated = await r.json();
      setScanResult(updated);
      refetch();
      toast({ title: "Diserahkan", description: `Paket ${scanResult.resiNumber} berhasil diserahkan.` });
    } catch {
      toast({ variant: "destructive", title: "Gagal menyerahkan paket" });
    } finally {
      setIsActioning(false);
    }
  }

  async function tolak() {
    if (!scanResult) return;
    setIsActioning(true);
    try {
      const token = localStorage.getItem("jaj_token");
      const r = await fetch(`/api/packages/${scanResult.id}/tolak`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!r.ok) throw new Error("Gagal");
      const updated = await r.json();
      setScanResult(updated);
      refetch();
      toast({ title: "Dikembalikan", description: `Status paket ${scanResult.resiNumber} dikembalikan ke Pending.` });
    } catch {
      toast({ variant: "destructive", title: "Gagal memperbarui status" });
    } finally {
      setIsActioning(false);
    }
  }

  const isDiserahkan = scanResult?.status === "diserahkan";

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monitor Paket</h1>
          <p className="text-muted-foreground mt-1">Pantau seluruh data paket dalam sistem.</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportExcel} disabled={!packages || packages.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          Export Excel
        </Button>
      </div>

      {/* Scan Verification Panel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-primary" />
            Verifikasi Paket via Scan / Resi
          </CardTitle>
          <CardDescription>Masukkan nomor resi, barcode, atau no paket untuk memverifikasi dan mengubah status.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="flex gap-2"
            onSubmit={(e) => { e.preventDefault(); doScan(scanInput); }}
          >
            <div className="relative flex-1">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 font-mono"
                placeholder="Contoh: JAJ-ABC123 atau JNE123456789"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={!scanInput.trim() || isScanning}>
              {isScanning ? "Mencari..." : "Cari"}
            </Button>
            {(scanResult || scanError) && (
              <Button type="button" variant="outline" onClick={() => { setScanResult(null); setScanError(""); setScanInput(""); }}>
                Reset
              </Button>
            )}
          </form>

          {scanError && (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm">{scanError}</p>
            </div>
          )}

          {scanResult && (
            <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{scanResult.customerName}</p>
                  <p className="text-sm text-muted-foreground font-mono">{scanResult.resiNumber} · {scanResult.barcode}</p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isDiserahkan ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                  {isDiserahkan ? "✓ Diserahkan" : "● Pending"}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <div><span className="text-xs text-muted-foreground block">Jenis Jastip</span>{scanResult.serviceType?.replace("jastip ", "Jastip ") || "-"}</div>
                <div><span className="text-xs text-muted-foreground block">Tanggal</span>{formatDate(scanResult.packageDate)}</div>
                <div><span className="text-xs text-muted-foreground block">Berat Digunakan</span>{scanResult.usedWeight != null ? `${scanResult.usedWeight} Kg` : "-"}</div>
                <div><span className="text-xs text-muted-foreground block">Total Ongkir</span>{formatRp(scanResult.totalShipping)}</div>
              </div>
              {!isDiserahkan ? (
                <div className="flex gap-2">
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1.5" onClick={serahkan} disabled={isActioning}>
                    <CheckCircle2 className="w-4 h-4" /> {isActioning ? "..." : "Serahkan"}
                  </Button>
                  <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 gap-1.5" onClick={tolak} disabled={isActioning}>
                    <XCircle className="w-4 h-4" /> Tolak
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-800 font-medium">Sudah diserahkan</span>
                  {scanResult.pickedUpAt && (
                    <span className="text-xs text-muted-foreground">pada {formatDate(scanResult.pickedUpAt)}</span>
                  )}
                  <Button size="sm" variant="outline" className="ml-auto border-amber-300 text-amber-700" onClick={tolak} disabled={isActioning}>
                    Kembalikan ke Pending
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <div className="p-4 border-b flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cari resi, no paket, customer..." className="pl-9" value={search} onChange={(e) => handleSearch(e.target.value)} />
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
        {/* Mobile card view */}
        <CardContent className="p-0 md:hidden">
          {isLoading ? (
            <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">Memuat data...</div>
          ) : paginated && paginated.length > 0 ? (
            <div className="divide-y">
              {paginated.map((pkg) => (
                <div key={pkg.id} className="p-4 hover:bg-muted/20 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{pkg.customerName || "-"}</p>
                      <p className="text-xs font-mono text-muted-foreground truncate">{pkg.resiNumber || "-"}{(pkg as any).packageNumber ? ` · #${(pkg as any).packageNumber}` : ""}</p>
                    </div>
                    <StatusBadge status={pkg.status} />
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-1">
                    <span>{(pkg as any).serviceType?.replace("jastip ", "Jastip ") || "-"}</span>
                    <span>{formatDate((pkg as any).packageDate || pkg.createdAt)}</span>
                    {(pkg as any).usedWeight && <span>{(pkg as any).usedWeight} Kg</span>}
                  </div>
                  <span className="font-bold text-primary text-sm mt-1 block">{(pkg as any).totalShipping ? formatRp((pkg as any).totalShipping) : "-"}</span>
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
                {["Tanggal","No Resi","No Paket","Nama Konsumen","Jenis Jastip","Berat Real (Kg)","P (cm)","L (cm)","T (cm)","Berat Volume","Jenis Paking","Berat Digunakan","Ongkir/Kg","Total Berat","Total Ongkir","Status"].map(h => (
                  <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={16} className="h-24 text-center text-muted-foreground py-10">Memuat data...</td></tr>
              ) : paginated && paginated.length > 0 ? (
                paginated.map((pkg) => (
                  <tr key={pkg.id} className="border-b hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-3 whitespace-nowrap text-muted-foreground">{formatDate((pkg as any).packageDate || pkg.createdAt)}</td>
                    <td className="py-3 px-3 font-mono font-medium whitespace-nowrap">{pkg.resiNumber || "-"}</td>
                    <td className="py-3 px-3 font-mono whitespace-nowrap">{(pkg as any).packageNumber || "-"}</td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="font-medium">{pkg.customerName || "-"}</div>
                      <div className="text-xs text-muted-foreground">{pkg.customerPhone}</div>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-xs">{(pkg as any).serviceType?.replace("jastip ", "Jastip ") || "-"}</td>
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
