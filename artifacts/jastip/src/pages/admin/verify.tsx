import { useState } from "react";
import { useListPackages, useListBatches } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/pagination";
import * as XLSX from "xlsx";
import {
  ShieldCheck, Ship, CheckCircle2, Lock, Archive,
  Search, Download, Package, ChevronRight, Clock,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

const PAGE_SIZE = 10;

function formatTgl(val: any) {
  if (!val) return "";
  try { return new Date(val).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return String(val); }
}

function batchStatusColor(status: string) {
  if (status === "OPEN") return "bg-green-100 text-green-800 border-green-200";
  if (status === "CLOSED") return "bg-yellow-100 text-yellow-800 border-yellow-200";
  return "bg-gray-100 text-gray-600 border-gray-200";
}
function batchStatusIcon(status: string) {
  if (status === "OPEN") return <CheckCircle2 className="w-3 h-3" />;
  if (status === "CLOSED") return <Lock className="w-3 h-3" />;
  return <Archive className="w-3 h-3" />;
}
function batchStatusLabel(status: string) {
  if (status === "OPEN") return "Aktif";
  if (status === "CLOSED") return "Ditutup";
  return "Arsip";
}

export default function AdminVerify() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const base = user?.role === "owner" ? "/owner" : "/admin";

  const { data: packages, isLoading: pkgLoading } = useListPackages();
  const { data: batches, isLoading: batchLoading } = useListBatches();
  const isLoading = pkgLoading || batchLoading;

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const allPackages = packages || [];
  const allBatches = batches || [];

  // Per batch: hitung verified / unverified / total (hanya paket aktif, belum diambil)
  type BatchStat = {
    batch: any;
    total: number;
    verified: number;
    unverified: number;
  };

  const batchStats: BatchStat[] = allBatches
    .map((batch: any) => {
      const bPkgs = allPackages.filter(
        (p: any) => p.batchId === batch.id && p.statusPengambilan !== "SUDAH_DIAMBIL" && p.status !== "diserahkan"
      );
      const verified = bPkgs.filter((p: any) => p.statusVerifikasi === "SUDAH_DIVERIFIKASI").length;
      return {
        batch,
        total: bPkgs.length,
        verified,
        unverified: bPkgs.length - verified,
      };
    })
    .filter((s: BatchStat) => s.total > 0);

  // Paket aktif tanpa batch
  const noBatchPkgs = allPackages.filter(
    (p: any) => p.batchId == null && p.statusPengambilan !== "SUDAH_DIAMBIL" && p.status !== "diserahkan"
  );
  const noBatchVerified = noBatchPkgs.filter((p: any) => p.statusVerifikasi === "SUDAH_DIVERIFIKASI").length;

  const filteredStats = batchStats.filter((s: BatchStat) =>
    !search ||
    (s.batch.namaKapal || "").toLowerCase().includes(search.toLowerCase()) ||
    (s.batch.kotaAsal || "").toLowerCase().includes(search.toLowerCase()) ||
    (s.batch.tujuan || "").toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredStats.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filteredStats.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const totalActive = allPackages.filter(
    (p: any) => p.statusPengambilan !== "SUDAH_DIAMBIL" && p.status !== "diserahkan"
  ).length;
  const totalVerified = allPackages.filter(
    (p: any) => p.statusVerifikasi === "SUDAH_DIVERIFIKASI"
  ).length;

  function exportExcel() {
    const rows = (allPackages || []).map((p: any, i: number) => ({
      No: i + 1,
      "Tanggal Paket": formatTgl(p.packageDate),
      "Nama Penerima": p.customerName || "",
      "No Resi": p.resiNumber || "",
      "No Paket": p.packageNumber || "",
      Barcode: p.barcode || "",
      "Jenis Jastip": p.serviceType || "",
      "Rute Pengiriman": p.deliveryRoute || "",
      "Berat Real (Kg)": p.realWeight ?? "",
      "Berat Terpakai (Kg)": p.usedWeight ?? "",
      "Total Ongkir (Rp)": p.totalShipping ?? "",
      Status: p.statusPengambilan === "SUDAH_DIAMBIL" ? "Diserahkan" : "Pending",
      Verifikasi: p.statusVerifikasi === "SUDAH_DIVERIFIKASI" ? "Sudah" : "Belum",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Verifikasi Paket");
    XLSX.writeFile(wb, `verifikasi-paket-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-primary" /> Verifikasi Paket
          </h1>
          <p className="text-muted-foreground mt-1">
            Pilih batch pengiriman, lalu pilih nama penerima untuk scan dan verifikasi paket.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={exportExcel}
          disabled={allPackages.length === 0}
          className="flex items-center gap-2 shrink-0"
        >
          <Download className="h-4 w-4" /> Export Excel
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground font-medium">Total Batch</p>
            <p className="text-xl font-bold mt-0.5 text-blue-600">{allBatches.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground font-medium">Paket Aktif</p>
            <p className="text-xl font-bold mt-0.5 text-foreground">{totalActive}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground font-medium">Sudah Diverifikasi</p>
            <p className="text-xl font-bold mt-0.5 text-green-600">{totalVerified}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground font-medium">Belum Diverifikasi</p>
            <p className="text-xl font-bold mt-0.5 text-amber-600">{totalActive - totalVerified}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari nama batch, kota..."
          className="pl-9"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {/* Batch list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-28 pt-4 bg-muted/20" />
            </Card>
          ))}
        </div>
      ) : filteredStats.length === 0 && noBatchPkgs.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <ShieldCheck className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">
            {allBatches.length === 0 ? "Belum ada batch" : "Tidak ada batch yang cocok"}
          </p>
          <p className="text-sm mt-1">
            {allBatches.length === 0 ? "Buat batch pengiriman terlebih dahulu" : "Coba ubah kata kunci pencarian"}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {paginated.map(({ batch, total, verified, unverified }) => {
              const pct = total > 0 ? Math.round((verified / total) * 100) : 0;
              return (
                <Card
                  key={batch.id}
                  className="border-2 cursor-pointer hover:shadow-md hover:border-primary/40 transition-all"
                  onClick={() => setLocation(`${base}/verify/batch/${batch.id}`)}
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${batch.statusBatch === "OPEN" ? "bg-blue-100" : "bg-gray-100"}`}>
                        <Ship className={`w-5 h-5 ${batch.statusBatch === "OPEN" ? "text-blue-700" : "text-gray-500"}`} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-base">{batch.namaKapal}</span>
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${batchStatusColor(batch.statusBatch)}`}>
                            {batchStatusIcon(batch.statusBatch)}
                            {batchStatusLabel(batch.statusBatch)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {batch.kotaAsal} → {batch.tujuan}
                          &nbsp;·&nbsp; ETD: {formatTgl(batch.etd)}
                          &nbsp;·&nbsp; Closing: {formatTgl(batch.periodeClosingMulai)} – {formatTgl(batch.periodeClosingSelesai)}
                        </p>

                        {/* Verification counts */}
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            {verified} terverifikasi
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3" />
                            {unverified} belum
                          </span>
                          <span className="text-xs text-muted-foreground">{total} total paket</span>
                        </div>

                        {/* Progress bar */}
                        {total > 0 && (
                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500 rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">{pct}% selesai</span>
                          </div>
                        )}
                      </div>

                      <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 mt-1" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Tanpa batch */}
            {noBatchPkgs.length > 0 && !search && (
              <Card
                className="border-2 border-dashed border-gray-300 cursor-pointer hover:shadow-md hover:border-primary/40 transition-all"
                onClick={() => setLocation(`${base}/verify/batch/no-batch`)}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-gray-100 shrink-0 mt-0.5">
                      <Package className="w-5 h-5 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base">Paket Tanpa Batch</span>
                        <Badge variant="outline" className="text-xs">Tidak ada batch</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> {noBatchVerified} terverifikasi
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          <Clock className="w-3 h-3" /> {noBatchPkgs.length - noBatchVerified} belum
                        </span>
                        <span className="text-xs text-muted-foreground">{noBatchPkgs.length} total</span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <Pagination
            page={safePage}
            totalPages={totalPages}
            total={filteredStats.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
