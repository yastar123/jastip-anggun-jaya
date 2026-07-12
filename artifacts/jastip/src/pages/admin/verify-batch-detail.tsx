import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useListPackages, useListBatches, useVerifyPackage } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Camera, Upload, ScanLine, X, CheckCircle2, XCircle,
  Users, Package, Hash, ShieldCheck, RotateCcw, Ship, Lock, Archive,
  Search, Clock,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

const GROUP_PAGE_SIZE = 15;

interface PkgGroup {
  customerName: string;
  serviceType: string;
  batchId: number | null;
  packages: any[];
}

function groupPackages(pkgs: any[]): PkgGroup[] {
  const map: Record<string, any[]> = {};
  for (const p of pkgs) {
    if (!p.customerName) continue;
    if (p.statusPengambilan === "SUDAH_DIAMBIL" || p.status === "diserahkan") continue;
    const key = [
      p.customerName.trim().toLowerCase(),
      (p.serviceType || "").toLowerCase(),
    ].join("|");
    if (!map[key]) map[key] = [];
    map[key].push(p);
  }
  return Object.entries(map).map(([, pkgs]) => ({
    customerName: pkgs[0].customerName,
    serviceType: pkgs[0].serviceType || "",
    batchId: pkgs[0].batchId ?? null,
    packages: pkgs,
  }));
}

type VerifyResult = "match" | "mismatch" | null;

function formatTgl(val: any) {
  if (!val) return "";
  try { return new Date(val).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return String(val); }
}

function batchStatusColor(s: string) {
  if (s === "OPEN") return "bg-green-100 text-green-800 border-green-200";
  if (s === "CLOSED") return "bg-yellow-100 text-yellow-800 border-yellow-200";
  return "bg-gray-100 text-gray-600 border-gray-200";
}
function batchStatusIcon(s: string) {
  if (s === "OPEN") return <CheckCircle2 className="w-3 h-3" />;
  if (s === "CLOSED") return <Lock className="w-3 h-3" />;
  return <Archive className="w-3 h-3" />;
}
function batchStatusLabel(s: string) {
  if (s === "OPEN") return "Aktif";
  if (s === "CLOSED") return "Ditutup";
  return "Arsip";
}

export default function VerifyBatchDetail({ params }: { params: { id: string } }) {
  const isNoBatch = params?.id === "no-batch";
  const batchId = isNoBatch ? null : Number(params?.id);

  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const base = user?.role === "owner" ? "/owner" : "/admin";

  const { data: allPackages, isLoading: pkgLoading, refetch: refetchPackages } = useListPackages();
  const { data: batches } = useListBatches();
  const verifyMutation = useVerifyPackage();

  // ── Filters (Step 1) ────────────────────────────────────────────────────────
  const [searchGroup, setSearchGroup] = useState("");
  const [filterServiceType, setFilterServiceType] = useState("all");
  const [filterVerified, setFilterVerified] = useState("all"); // "all" | "verified" | "unverified"
  const [groupPage, setGroupPage] = useState(1);

  // ── Verify (Step 2) ─────────────────────────────────────────────────────────
  const [selectedGroup, setSelectedGroup] = useState<PkgGroup | null>(null);
  const [scanMode, setScanMode] = useState<"idle" | "camera" | "manual">("idle");
  const [verifyResult, setVerifyResult] = useState<VerifyResult>(null);
  const [resultPkg, setResultPkg] = useState<any | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [scanHistory, setScanHistory] = useState<{ barcode: string; result: VerifyResult; pkg: any | null }[]>([]);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const SCANNER_ID = "verify-qr-scanner";

  // ── Derived data ─────────────────────────────────────────────────────────────
  const batch = isNoBatch ? null : (batches || []).find((b: any) => b.id === batchId);
  const batchLabel = isNoBatch ? "Paket Tanpa Batch" : (batch?.namaKapal || `Batch #${batchId}`);

  // Packages for this batch (active only)
  const batchPkgs = (allPackages || []).filter((p: any) =>
    isNoBatch ? p.batchId == null : p.batchId === batchId
  );

  const allGroups = groupPackages(batchPkgs);

  // Counts for summary
  const totalPkgs = batchPkgs.filter(
    (p: any) => p.statusPengambilan !== "SUDAH_DIAMBIL" && p.status !== "diserahkan"
  ).length;
  const totalVerified = batchPkgs.filter((p: any) => p.statusVerifikasi === "SUDAH_DIVERIFIKASI").length;

  // Live-update selectedGroup when data refetches
  useEffect(() => {
    if (!selectedGroup || !allPackages) return;
    const fresh = (allPackages || []).filter(
      (p: any) =>
        (isNoBatch ? p.batchId == null : p.batchId === batchId) &&
        p.statusPengambilan !== "SUDAH_DIAMBIL" &&
        p.status !== "diserahkan" &&
        p.customerName?.toLowerCase().trim() === selectedGroup.customerName.toLowerCase().trim() &&
        (p.serviceType || "").toLowerCase() === selectedGroup.serviceType.toLowerCase()
    );
    if (fresh.length > 0) {
      setSelectedGroup((prev) => prev ? { ...prev, packages: fresh } : prev);
    }
  }, [allPackages]);

  // Filter groups
  const filteredGroups = allGroups.filter((g) => {
    if (filterServiceType !== "all" && (g.serviceType || "").toLowerCase() !== filterServiceType) return false;
    if (filterVerified === "verified" && g.packages.some((p) => p.statusVerifikasi !== "SUDAH_DIVERIFIKASI")) {
      // keep only if ALL are verified
      if (!g.packages.every((p) => p.statusVerifikasi === "SUDAH_DIVERIFIKASI")) return false;
    }
    if (filterVerified === "unverified" && g.packages.every((p) => p.statusVerifikasi === "SUDAH_DIVERIFIKASI")) return false;
    if (searchGroup && !g.customerName.toLowerCase().includes(searchGroup.toLowerCase())) return false;
    return true;
  });

  const totalGroupPages = Math.max(1, Math.ceil(filteredGroups.length / GROUP_PAGE_SIZE));
  const safePage = Math.min(groupPage, totalGroupPages);
  const paginated = filteredGroups.slice((safePage - 1) * GROUP_PAGE_SIZE, safePage * GROUP_PAGE_SIZE);

  // ── Verify logic ─────────────────────────────────────────────────────────────
  async function lookupAndVerify(code: string) {
    if (!selectedGroup) return;
    setIsSearching(true);
    setVerifyResult(null);
    setResultPkg(null);
    try {
      const token = localStorage.getItem("jaj_token");
      const r = await fetch(`/api/packages/scan/${encodeURIComponent(code)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      let pkg = data.package || null;

      if (!pkg) {
        const r2 = await fetch(`/api/packages?search=${encodeURIComponent(code)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const list = await r2.json();
        if (Array.isArray(list) && list.length > 0) pkg = list[0];
      }

      if (!pkg) {
        setVerifyResult("mismatch");
        setResultPkg(null);
        setScanHistory((h) => [{ barcode: code, result: "mismatch", pkg: null }, ...h]);
        return;
      }

      const isMatch =
        pkg.customerName?.toLowerCase().trim() === selectedGroup.customerName.toLowerCase().trim() &&
        (pkg.serviceType || "").toLowerCase() === selectedGroup.serviceType.toLowerCase();

      if (isMatch && pkg.statusVerifikasi !== "SUDAH_DIVERIFIKASI") {
        try {
          const verified = await verifyMutation.mutateAsync({ id: pkg.id });
          pkg = verified;
        } catch {
          toast({ variant: "destructive", title: "Gagal menyimpan status verifikasi" });
        }
        refetchPackages();
      }

      setVerifyResult(isMatch ? "match" : "mismatch");
      setResultPkg(pkg);
      setScanHistory((h) => [{ barcode: code, result: isMatch ? "match" : "mismatch", pkg }, ...h]);
    } catch {
      toast({ variant: "destructive", title: "Gagal mencari paket" });
    } finally {
      setIsSearching(false);
    }
  }

  const handleScanSuccess = useCallback(async (code: string) => {
    await stopCamera();
    await lookupAndVerify(code);
  }, [selectedGroup]);

  async function startCamera() {
    setScanMode("camera");
    try {
      const devices = await Html5Qrcode.getCameras();
      if (!devices.length) {
        toast({ variant: "destructive", title: "Kamera tidak tersedia" });
        setScanMode("idle"); return;
      }
      const scanner = new Html5Qrcode(SCANNER_ID);
      scannerRef.current = scanner;
      await scanner.start(
        devices[devices.length - 1].id,
        { fps: 10, qrbox: { width: 260, height: 120 } },
        handleScanSuccess, undefined
      );
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal akses kamera", description: err?.message });
      setScanMode("idle");
    }
  }

  async function stopCamera() {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
      scannerRef.current = null;
    }
    setScanMode("idle");
  }

  useEffect(() => () => { stopCamera(); }, []);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const tempId = "verify-qr-temp-" + Date.now();
    const tempDiv = document.createElement("div");
    tempDiv.id = tempId; tempDiv.style.display = "none";
    document.body.appendChild(tempDiv);
    const scanner = new Html5Qrcode(tempId);
    scanner.scanFile(file, false)
      .then(async (code) => {
        scanner.clear(); document.body.removeChild(tempDiv);
        await lookupAndVerify(code);
      })
      .catch(() => {
        scanner.clear(); document.body.removeChild(tempDiv);
        toast({ variant: "destructive", title: "Gagal membaca barcode" });
      });
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manualInput.trim()) return;
    await lookupAndVerify(manualInput.trim());
    setManualInput("");
  }

  function resetResult() { setVerifyResult(null); setResultPkg(null); }

  function changeGroup() {
    stopCamera();
    setSelectedGroup(null);
    setScanHistory([]);
    setVerifyResult(null);
    setResultPkg(null);
    setScanMode("idle");
  }

  const matchCount = scanHistory.filter((h) => h.result === "match").length;
  const mismatchCount = scanHistory.filter((h) => h.result === "mismatch").length;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="outline" size="icon" onClick={() => { changeGroup(); setLocation(`${base}/verify`); }}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            {isNoBatch ? (
              <div className="p-1.5 rounded-lg bg-gray-100">
                <Package className="w-5 h-5 text-gray-500" />
              </div>
            ) : (
              <div className={`p-1.5 rounded-lg ${batch?.statusBatch === "OPEN" ? "bg-blue-100" : "bg-gray-100"}`}>
                <Ship className={`w-5 h-5 ${batch?.statusBatch === "OPEN" ? "text-blue-700" : "text-gray-500"}`} />
              </div>
            )}
            <h1 className="text-2xl font-bold tracking-tight">{batchLabel}</h1>
            {batch && (
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${batchStatusColor(batch.statusBatch)}`}>
                {batchStatusIcon(batch.statusBatch)}
                {batchStatusLabel(batch.statusBatch)}
              </span>
            )}
          </div>
          {batch && (
            <p className="text-sm text-muted-foreground mt-1">
              {batch.kotaAsal} → {batch.tujuan}
              &nbsp;·&nbsp; ETD: {formatTgl(batch.etd)}
              &nbsp;·&nbsp; Closing: {formatTgl(batch.periodeClosingMulai)} – {formatTgl(batch.periodeClosingSelesai)}
            </p>
          )}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-green-700">
              <CheckCircle2 className="w-4 h-4" /> {totalVerified} terverifikasi
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700">
              <Clock className="w-4 h-4" /> {totalPkgs - totalVerified} belum
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-sm text-muted-foreground">{allGroups.length} penerima</span>
          </div>
        </div>
      </div>

      {/* ── STEP 1: pilih penerima ─────────────────────────────────────────────── */}
      {!selectedGroup ? (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama penerima..."
                className="pl-9"
                value={searchGroup}
                onChange={(e) => { setSearchGroup(e.target.value); setGroupPage(1); }}
              />
            </div>

            {/* Filter jenis jastip */}
            <Select value={filterServiceType} onValueChange={(v) => { setFilterServiceType(v); setGroupPage(1); }}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Semua Jenis Jastip" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Jenis Jastip</SelectItem>
                <SelectItem value="jastip pesawat">Jastip Pesawat</SelectItem>
                <SelectItem value="jastip hemat+">Jastip Hemat+</SelectItem>
                <SelectItem value="jastip kargo">Jastip Kargo</SelectItem>
                <SelectItem value="jastip pelni">Jastip Pelni</SelectItem>
              </SelectContent>
            </Select>

            {/* Filter status verifikasi */}
            <Select value={filterVerified} onValueChange={(v) => { setFilterVerified(v); setGroupPage(1); }}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="unverified">⏳ Belum Diverifikasi</SelectItem>
                <SelectItem value="verified">✓ Sudah Diverifikasi</SelectItem>
              </SelectContent>
            </Select>

            <Badge variant="secondary">{filteredGroups.length} penerima</Badge>
          </div>

          {/* Group cards */}
          {pkgLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <Card key={i} className="animate-pulse"><CardContent className="h-24 pt-4 bg-muted/20" /></Card>
              ))}
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">
                {allGroups.length === 0 ? "Tidak ada paket aktif dalam batch ini" : "Tidak ada penerima yang cocok"}
              </p>
              <p className="text-sm mt-1">
                {allGroups.length === 0 ? "Paket mungkin sudah diserahkan semua" : "Coba ubah filter atau kata kunci"}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {paginated.map((group) => {
                  const belum = group.packages.filter((p) => p.statusVerifikasi !== "SUDAH_DIVERIFIKASI").length;
                  const sudah = group.packages.filter((p) => p.statusVerifikasi === "SUDAH_DIVERIFIKASI").length;
                  const allDone = belum === 0;
                  return (
                    <Card
                      key={`${group.customerName}|${group.serviceType}`}
                      className={`cursor-pointer hover:shadow-md transition-all ${allDone ? "border-green-300 bg-green-50/30" : "hover:border-primary/50"}`}
                      onClick={() => setSelectedGroup(group)}
                    >
                      <CardContent className="pt-4 pb-3">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-start justify-between gap-1">
                            <p className="font-semibold text-sm leading-tight flex-1 min-w-0">{group.customerName}</p>
                            {allDone && <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />}
                          </div>
                          {group.serviceType && (
                            <Badge variant="outline" className="text-xs w-fit capitalize">
                              {group.serviceType.replace("jastip ", "")}
                            </Badge>
                          )}
                          <p className="text-xs text-muted-foreground">{group.packages.length} paket</p>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {belum > 0 && (
                              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300">
                                {belum} belum
                              </Badge>
                            )}
                            {sudah > 0 && (
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                                {sudah} ✓
                              </Badge>
                            )}
                          </div>
                          {/* Mini progress */}
                          {group.packages.length > 0 && (
                            <div className="h-1 bg-gray-200 rounded-full overflow-hidden mt-0.5">
                              <div
                                className="h-full bg-green-500 rounded-full"
                                style={{ width: `${Math.round((sudah / group.packages.length) * 100)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              <Pagination
                page={safePage}
                totalPages={totalGroupPages}
                total={filteredGroups.length}
                pageSize={GROUP_PAGE_SIZE}
                onPageChange={setGroupPage}
              />
            </>
          )}
        </div>
      ) : (
        /* ── STEP 2: scan & verifikasi ─────────────────────────────────────────── */
        <div className="space-y-4">
          {/* Selected group card */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-base">{selectedGroup.customerName}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedGroup.packages.length} paket
                    {selectedGroup.serviceType ? " · " + selectedGroup.serviceType.replace("jastip ", "Jastip ") : ""}
                    {" · "}Scan barcode untuk verifikasi
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {scanHistory.length > 0 && (
                    <>
                      <Badge className="bg-green-600 text-white text-xs">{matchCount} ✓</Badge>
                      {mismatchCount > 0 && <Badge variant="destructive" className="text-xs">{mismatchCount} ✗</Badge>}
                    </>
                  )}
                  <Button variant="outline" size="sm" onClick={changeGroup}>← Ganti</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Camera scanner */}
          <div id={SCANNER_ID} className={scanMode === "camera" ? "w-full rounded-xl overflow-hidden border" : "hidden"} />

          {/* Verify result */}
          {verifyResult && !isSearching && (
            <Card className={`border-2 ${verifyResult === "match" ? "border-green-500 bg-green-50" : "border-red-400 bg-red-50"}`}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  {verifyResult === "match"
                    ? <CheckCircle2 className="w-7 h-7 text-green-600 shrink-0 mt-0.5" />
                    : <XCircle className="w-7 h-7 text-red-500 shrink-0 mt-0.5" />}
                  <div className="flex-1">
                    {verifyResult === "match" ? (
                      <>
                        <p className="font-bold text-green-800 text-lg">✓ COCOK — Paket milik {selectedGroup.customerName}</p>
                        {resultPkg && (
                          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-2 text-sm text-green-700">
                            <span>Resi: <strong className="font-mono">{resultPkg.resiNumber}</strong></span>
                            <span>Berat: {resultPkg.realWeight != null ? resultPkg.realWeight + " Kg" : "-"}</span>
                            <span>Jastip: {resultPkg.serviceType || "-"}</span>
                            <span>Status: {resultPkg.status === "diserahkan" ? "Diserahkan" : "Pending"}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="font-bold text-red-700 text-lg">✗ TIDAK COCOK</p>
                        {resultPkg ? (
                          <p className="text-sm text-red-600 mt-1">
                            Paket ini milik <strong>{resultPkg.customerName || "tidak diketahui"}</strong>, bukan {selectedGroup.customerName}.
                          </p>
                        ) : (
                          <p className="text-sm text-red-600 mt-1">Barcode tidak ditemukan dalam sistem.</p>
                        )}
                      </>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" onClick={resetResult} className="shrink-0">
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {isSearching && (
            <Card>
              <CardContent className="flex items-center justify-center py-8 text-muted-foreground gap-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                Memverifikasi paket...
              </CardContent>
            </Card>
          )}

          {/* Scan controls */}
          <div className="grid sm:grid-cols-2 gap-3">
            {scanMode !== "camera" ? (
              <Card className="cursor-pointer hover:shadow-md hover:border-primary/40 transition-all" onClick={startCamera}>
                <CardContent className="flex items-center gap-3 py-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Camera className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Scan Kamera</p>
                    <p className="text-xs text-muted-foreground">Arahkan ke barcode</p>
                  </div>
                  <Button size="sm" className="ml-auto">Buka</Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-primary/50">
                <CardContent className="flex items-center gap-3 py-4">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Camera className="w-5 h-5 text-primary animate-pulse" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-primary">Kamera Aktif</p>
                    <p className="text-xs text-muted-foreground">Arahkan ke barcode paket</p>
                  </div>
                  <Button size="sm" variant="outline" className="ml-auto" onClick={stopCamera}>
                    <X className="w-3 h-3 mr-1" /> Tutup
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="flex items-center gap-3 py-4">
                <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Upload Gambar</p>
                  <p className="text-xs text-muted-foreground">Foto barcode dari galeri</p>
                </div>
                <Button size="sm" className="ml-auto bg-secondary hover:bg-secondary/90" onClick={() => fileInputRef.current?.click()}>Pilih</Button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </CardContent>
            </Card>
          </div>

          {/* Manual input */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Hash className="h-4 w-4" />Input Manual</CardTitle>
              <CardDescription className="text-xs">Ketik nomor resi atau barcode secara manual</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleManualSubmit} className="flex gap-2">
                <Input
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Contoh: JAJ-ABC123 atau JNE123456789"
                  className="font-mono"
                />
                <Button type="submit" disabled={!manualInput.trim() || isSearching}>Verifikasi</Button>
              </form>
            </CardContent>
          </Card>

          {/* Scan history */}
          {scanHistory.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <ScanLine className="h-4 w-4" /> Riwayat Scan — {scanHistory.length} item
                <Button variant="ghost" size="sm" className="ml-auto text-xs h-6" onClick={() => setScanHistory([])}>Hapus</Button>
              </p>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {scanHistory.map((h, i) => (
                  <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-sm ${h.result === "match" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                    {h.result === "match"
                      ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      : <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                    <span className="font-mono flex-1 truncate">{h.pkg?.barcode || h.pkg?.resiNumber || h.barcode}</span>
                    {h.result === "match" ? (
                      <Badge className="bg-green-600 text-white text-xs shrink-0">✓ Cocok</Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs shrink-0">
                        {h.pkg ? `Milik ${h.pkg.customerName}` : "Tidak ditemukan"}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daftar paket */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" /> Daftar Paket — {selectedGroup.customerName}
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              {selectedGroup.packages.map((p: any) => {
                const isVerified = p.statusVerifikasi === "SUDAH_DIVERIFIKASI";
                return (
                  <div key={p.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${isVerified ? "bg-green-50 border-green-200" : "bg-muted/30"}`}>
                    {isVerified
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                      : <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                    <span className="font-mono flex-1 truncate">{p.resiNumber || p.barcode}</span>
                    <Badge variant="outline" className={`text-xs shrink-0 ${isVerified ? "bg-green-100 text-green-800 border-green-300" : "bg-amber-100 text-amber-800 border-amber-300"}`}>
                      {isVerified ? "✓ Diverifikasi" : "Belum"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
