import { useState } from "react";
import { useListPackages } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/pagination";
import { ArrowLeft, Archive, Search, Users, Package } from "lucide-react";
import { useAuth } from "@/lib/auth";
import * as XLSX from "xlsx";
import { Download } from "lucide-react";

const PAGE_SIZE = 15;

function formatRp(n: any) {
  if (n == null) return "-";
  return `Rp ${Number(n).toLocaleString("id-ID")}`;
}

function formatTgl(val: any) {
  if (!val) return "";
  try { return new Date(val).toLocaleDateString("id-ID"); } catch { return String(val); }
}

export default function AdminArsip() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const base = user?.role === "owner" ? "/owner" : "/admin";
  const { data: packages, isLoading } = useListPackages();
  const [search, setSearch] = useState("");
  const [filterServiceType, setFilterServiceType] = useState<string>("all");
  const [page, setPage] = useState(1);

  const allPackages = packages || [];

  // Hanya tampilkan paket yang SUDAH_DIAMBIL
  const arsipPackages = allPackages.filter(
    (p: any) => p.statusPengambilan === "SUDAH_DIAMBIL" || p.status === "diserahkan"
  );

  const filtered = arsipPackages.filter(
    (p: any) =>
      (filterServiceType === "all" || (p.serviceType || "").toLowerCase() === filterServiceType) &&
      (
        !search ||
        (p.barcode || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.resiNumber || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.customerName || "").toLowerCase().includes(search.toLowerCase())
      )
  );

  // Group by customerName + serviceType + batchId
  const groupedByCustomer: { customerName: string; serviceType: string; batchId: number | null; pkgs: any[] }[] = [];
  {
    const map = new Map<string, any[]>();
    for (const p of filtered) {
      const key = [
        (p.customerName || "").trim().toLowerCase(),
        (p.serviceType || "").toLowerCase(),
        String(p.batchId ?? ""),
      ].join("|");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    for (const [, pkgs] of map) {
      groupedByCustomer.push({
        customerName: pkgs[0]?.customerName || "",
        serviceType: pkgs[0]?.serviceType || "",
        batchId: pkgs[0]?.batchId ?? null,
        pkgs,
      });
    }
  }

  const total = groupedByCustomer.length;
  const totalPackages = filtered.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const paginatedGroups = groupedByCustomer.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function exportExcel() {
    const rows = arsipPackages.map((p: any, i: number) => ({
      No: i + 1,
      "Tanggal Paket": formatTgl(p.packageDate),
      "Nama Penerima": p.customerName || "",
      "No Resi": p.resiNumber || "",
      "No Paket": p.packageNumber || "",
      "Jenis Jastip": p.serviceType || "",
      "Rute Pengiriman": p.deliveryRoute || "",
      "Berat Real (Kg)": p.realWeight ?? "",
      "Berat Digunakan (Kg)": p.usedWeight ?? "",
      "Total Ongkir (Rp)": p.totalShipping ?? "",
      "Status Pembayaran": p.statusPembayaran || "",
      "Tanggal Diambil": formatTgl(p.pickedUpAt),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Arsip Paket");
    XLSX.writeFile(wb, `arsip-paket-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setLocation(`${base}/barcode`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Archive className="h-7 w-7 text-green-600" /> Arsip Paket Sudah Diambil
            </h1>
            <p className="text-muted-foreground mt-1">
              Data paket yang telah diserahkan ke konsumen. Read-only — tidak dapat diubah.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={exportExcel}
          disabled={arsipPackages.length === 0}
          className="flex items-center gap-2 shrink-0"
        >
          <Download className="h-4 w-4" /> Export Excel
        </Button>
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Konsumen", value: groupedByCustomer.length, icon: Users, color: "text-blue-600" },
          { label: "Total Paket", value: arsipPackages.length, icon: Package, color: "text-green-600" },
          {
            label: "Total Ongkir",
            value: formatRp(arsipPackages.reduce((s: number, p: any) => s + (p.totalShipping ?? 0), 0)),
            icon: null,
            color: "text-primary",
          },
          {
            label: "Lunas",
            value: arsipPackages.filter((p: any) => p.statusPembayaran === "SUDAH_DIBAYAR").length + " paket",
            icon: null,
            color: "text-green-600",
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
              <p className={`text-xl font-bold mt-0.5 ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter jenis jastip */}
      <div className="flex flex-wrap gap-2">
        {[
          { value: "all", label: "Semua Jastip" },
          { value: "jastip pesawat", label: "Pesawat" },
          { value: "jastip hemat+", label: "Hemat+" },
          { value: "jastip kargo", label: "Kargo" },
          { value: "jastip pelni", label: "Pelni" },
        ].map((opt) => {
          const count = opt.value === "all"
            ? arsipPackages.length
            : arsipPackages.filter((p: any) => (p.serviceType || "").toLowerCase() === opt.value).length;
          return (
            <Button
              key={opt.value}
              size="sm"
              variant={filterServiceType === opt.value ? "default" : "outline"}
              onClick={() => { setFilterServiceType(opt.value); setPage(1); }}
              className="text-xs"
            >
              {opt.label}
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${filterServiceType === opt.value ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"}`}>
                {count}
              </span>
            </Button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama, resi, barcode..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Badge variant="secondary">{total} konsumen · {totalPackages} paket</Badge>
      </div>

      {isLoading ? (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse"><CardContent className="h-24 pt-4 bg-muted/20" /></Card>
          ))}
        </div>
      ) : total === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Archive className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">Belum ada paket yang diarsip</p>
          <p className="text-sm mt-1">Paket yang sudah diserahkan ke konsumen akan muncul di sini</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {paginatedGroups.map((group) => {
              const totalShipping = group.pkgs.reduce((s, p) => s + (p.totalShipping ?? 0), 0);
              const totalWeight = group.pkgs.reduce((s, p) => s + (p.usedWeight ?? p.realWeight ?? 0), 0);
              const lunas = group.pkgs.filter((p) => p.statusPembayaran === "SUDAH_DIBAYAR").length;
              const piutang = group.pkgs.filter((p) => p.statusPembayaran === "BELUM_DIBAYAR").length;
              const dp = group.pkgs.filter((p) => p.statusPembayaran === "DP").length;
              return (
                <Card key={`${group.customerName}|${group.serviceType}|${group.batchId ?? ""}`} className="border-green-200 bg-green-50/30">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-base">{group.customerName}</p>
                          {group.serviceType && (
                            <Badge variant="outline" className="text-xs capitalize bg-white">
                              {group.serviceType.replace("jastip ", "Jastip ")}
                            </Badge>
                          )}
                          <Badge className="text-xs bg-green-600 text-white">✓ Sudah Diambil</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {group.pkgs.length} paket · {totalWeight.toFixed(3)} Kg · {formatRp(totalShipping)}
                        </p>
                        {(lunas > 0 || piutang > 0 || dp > 0) && (
                          <div className="flex gap-1.5 mt-1.5 flex-wrap">
                            {lunas > 0 && <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">{lunas} lunas</Badge>}
                            {dp > 0 && <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300">{dp} DP</Badge>}
                            {piutang > 0 && <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-300">{piutang} piutang</Badge>}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Daftar resi */}
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {group.pkgs.map((p, i) => (
                        <div key={p.id} className="flex items-center justify-between text-xs text-muted-foreground bg-white rounded px-2 py-1 border border-green-100">
                          <span className="font-mono truncate max-w-[160px]">#{i + 1} {p.resiNumber || p.barcode || "-"}</span>
                          <span className="shrink-0 ml-2">
                            {p.usedWeight != null ? p.usedWeight + " Kg" : "-"}
                            {p.totalShipping != null && <span className="ml-1 text-primary font-semibold"> · {formatRp(p.totalShipping)}</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {totalPages > 1 && (
            <div className="border rounded-lg">
              <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
