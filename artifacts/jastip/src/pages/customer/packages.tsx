import { useListPackages } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Pagination } from "@/components/pagination";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PackageOpen, Eye } from "lucide-react";
import { useLocation } from "wouter";

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
  const map: Record<string, string> = { karton:"Karton", plastik:"Plastik", kayu:"Kayu", bubble_wrap:"Bubble Wrap", sack:"Karung", lainnya:"Lainnya" };
  return t ? (map[t] || t) : "-";
}

export default function CustomerPackages() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const { data: packages, isLoading } = useListPackages({ customerId: user?.id });

  const filteredPackages = packages?.filter(pkg => {
    if (filter === "all") return true;
    if (filter === "picked_up") return pkg.status === "diserahkan";
    if (filter === "pending") return pkg.status !== "diserahkan";
    return true;
  });

  const total = filteredPackages?.length || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const paginated = filteredPackages?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleFilter(v: string) { setFilter(v); setPage(1); }

  const headers = [
    "Tanggal", "No Resi", "No Paket", "Nama Konsumen",
    "Berat Real (Kg)", "P (cm)", "L (cm)", "T (cm)",
    "Berat Volume", "Jenis Paking", "Berat Digunakan",
    "Ongkir/Kg", "Total Berat", "Harga", "Total Ongkir",
    "Status", "Aksi"
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Paket Saya</h1>
        <p className="text-muted-foreground mt-1">Pantau status seluruh paket Anda.</p>
      </div>

      <Tabs defaultValue="all" value={filter} onValueChange={handleFilter}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">Semua</TabsTrigger>
          <TabsTrigger value="pending">Belum Diambil</TabsTrigger>
          <TabsTrigger value="picked_up">Sudah Diambil</TabsTrigger>
        </TabsList>

        <Card>
          {/* Mobile card view */}
          <CardContent className="p-0 md:hidden">
            {isLoading ? (
              <div className="h-24 flex items-center justify-center text-muted-foreground animate-pulse text-sm">Memuat data paket...</div>
            ) : paginated && paginated.length > 0 ? (
              <div className="divide-y">
                {paginated.map((pkg) => (
                  <div
                    key={pkg.id}
                    className="p-4 cursor-pointer hover:bg-muted/20 active:bg-muted/30 transition-colors"
                    onClick={() => setLocation(`/customer/packages/${pkg.id}`)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{pkg.customerName || user?.name || "-"}</p>
                        <p className="text-xs font-mono text-muted-foreground truncate">{pkg.resiNumber || "-"}{(pkg as any).packageNumber ? ` · #${(pkg as any).packageNumber}` : ""}</p>
                      </div>
                      <StatusBadge status={pkg.status} />
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-1">
                      <span>{formatDate((pkg as any).packageDate || pkg.createdAt)}</span>
                      {(pkg as any).usedWeight && <span>Berat: {(pkg as any).usedWeight} Kg</span>}
                      {(pkg as any).serviceType && <span>{(pkg as any).serviceType.replace("jastip ", "Jastip ")}</span>}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-bold text-primary text-sm">{(pkg as any).totalShipping ? formatRp((pkg as any).totalShipping) : "-"}</span>
                      <span className="text-xs text-primary font-medium flex items-center gap-1"><Eye className="w-3 h-3" /> Detail</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-40 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <PackageOpen className="w-10 h-10 opacity-30" />
                <p className="text-sm">Tidak ada paket dalam kategori ini.</p>
              </div>
            )}
          </CardContent>
          {/* Desktop table */}
          <CardContent className="p-0 overflow-x-auto hidden md:block">
            <table className="w-full text-sm min-w-[1400px]">
              <thead>
                <tr className="border-b bg-muted/30">
                  {headers.map(h => (
                    <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={17} className="h-24 text-center text-muted-foreground py-10 animate-pulse">Memuat data paket...</td></tr>
                ) : paginated && paginated.length > 0 ? (
                  paginated.map((pkg) => (
                    <tr key={pkg.id} className="border-b hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setLocation(`/customer/packages/${pkg.id}`)}>
                      <td className="py-3 px-3 whitespace-nowrap text-muted-foreground">{formatDate((pkg as any).packageDate || pkg.createdAt)}</td>
                      <td className="py-3 px-3 font-mono font-medium whitespace-nowrap">{pkg.resiNumber || "-"}</td>
                      <td className="py-3 px-3 font-mono whitespace-nowrap">{(pkg as any).packageNumber || "-"}</td>
                      <td className="py-3 px-3 whitespace-nowrap font-medium">{pkg.customerName || user?.name || "-"}</td>
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
                      <td className="py-3 px-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" onClick={() => setLocation(`/customer/packages/${pkg.id}`)}>
                          <Eye className="w-3.5 h-3.5 mr-1" />Detail
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={17} className="h-40">
                      <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                        <PackageOpen className="w-10 h-10 opacity-30" />
                        <p>Tidak ada paket dalam kategori ini.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
          <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </Card>
      </Tabs>
    </div>
  );
}
