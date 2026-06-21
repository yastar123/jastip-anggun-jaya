import { useListPackages, PackageStatus } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { useState } from "react";
import { useLocation } from "wouter";
import { Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function formatRp(n: any) {
  if (!n) return "-";
  return `Rp ${Number(n).toLocaleString("id-ID")}`;
}
function formatDate(d: string | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function packagingLabel(t: string | null | undefined) {
  const map: Record<string, string> = { karton:"Karton", plastik:"Plastik", kayu:"Kayu", bubble_wrap:"Bubble Wrap", sack:"Karung", lainnya:"Lainnya" };
  return t ? (map[t] || t) : "-";
}

export default function OwnerPackages() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [, setLocation] = useLocation();

  const { data: packages, isLoading } = useListPackages({
    search: search || undefined,
    status: status === "all" ? undefined : (status as PackageStatus),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Monitor Paket</h1>
        <p className="text-muted-foreground mt-1">Pantau seluruh data paket dalam sistem.</p>
      </div>

      <Card>
        <div className="p-4 border-b flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cari resi, no paket, customer..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Filter Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_transit">Transit</SelectItem>
              <SelectItem value="ready">Siap Diambil</SelectItem>
              <SelectItem value="picked_up">Sudah Diambil</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[1400px]">
            <thead>
              <tr className="border-b bg-muted/30">
                {["Tanggal","No Resi","No Paket","Nama Konsumen","Berat Real (Kg)","P (cm)","L (cm)","T (cm)","Berat Volume","Jenis Paking","Berat Digunakan","Ongkir/Kg","Total Berat","Harga","Total Ongkir","Status"].map(h => (
                  <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={16} className="h-24 text-center text-muted-foreground py-10">Memuat data...</td></tr>
              ) : packages && packages.length > 0 ? (
                packages.map((pkg) => (
                  <tr key={pkg.id} className="border-b hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-3 whitespace-nowrap text-muted-foreground">{formatDate((pkg as any).packageDate || pkg.createdAt)}</td>
                    <td className="py-3 px-3 font-mono font-medium whitespace-nowrap">{pkg.resiNumber || "-"}</td>
                    <td className="py-3 px-3 font-mono whitespace-nowrap">{(pkg as any).packageNumber || "-"}</td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="font-medium">{pkg.customerName || "-"}</div>
                      <div className="text-xs text-muted-foreground">{pkg.customerPhone}</div>
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
                    <td className="py-3 px-3 whitespace-nowrap text-right">{(pkg as any).price ? formatRp((pkg as any).price) : "-"}</td>
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
      </Card>
    </div>
  );
}
