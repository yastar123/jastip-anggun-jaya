import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useListPackages } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import {
  Camera, Upload, ScanLine, X, CheckCircle2, XCircle,
  Users, Package, Hash, ShieldCheck, RotateCcw, Download,
} from "lucide-react";


interface PkgGroup {
  customerName: string;
  packages: any[];
}

function groupByName(packages: any[]): PkgGroup[] {
  const map: Record<string, any[]> = {};
  for (const p of packages) {
    if (!p.customerName) continue;
    if (!map[p.customerName]) map[p.customerName] = [];
    map[p.customerName].push(p);
  }
  return Object.entries(map).map(([customerName, pkgs]) => ({ customerName, packages: pkgs }));
}

type VerifyResult = "match" | "mismatch" | null;

export default function AdminVerify() {
  const { toast } = useToast();
  const { data: allPackages, isLoading } = useListPackages();

  const [selectedGroup, setSelectedGroup] = useState<PkgGroup | null>(null);
  const [scanMode, setScanMode] = useState<"idle" | "camera" | "manual">("idle");
  const [verifyResult, setVerifyResult] = useState<VerifyResult>(null);
  const [resultPkg, setResultPkg] = useState<any | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [scanHistory, setScanHistory] = useState<{ barcode: string; result: VerifyResult; pkg: any | null }[]>([]);
  const [searchGroup, setSearchGroup] = useState("");

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const SCANNER_ID = "verify-qr-scanner";

  const grupPackages = (allPackages || []).filter((p: any) => p.packageMode === "grup" || true);
  const allGroups = groupByName(grupPackages);
  const filteredGroups = allGroups.filter((g) =>
    !searchGroup || g.customerName.toLowerCase().includes(searchGroup.toLowerCase())
  );

  async function lookupAndVerify(code: string) {
    if (!selectedGroup) return;
    setIsSearching(true);
    setVerifyResult(null);
    setResultPkg(null);
    try {
      const token = localStorage.getItem("jaj_token");
      // Try scan endpoint first
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

      const isMatch = pkg.customerName?.toLowerCase().trim() === selectedGroup.customerName.toLowerCase().trim();
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

  function resetResult() {
    setVerifyResult(null);
    setResultPkg(null);
  }

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

  function formatTgl(val: any) {
    if (!val) return "";
    try { return new Date(val).toLocaleDateString("id-ID"); } catch { return String(val); }
  }

  function exportExcel() {
    const rows = (allPackages || []).map((p: any, i: number) => ({
      No: i + 1,
      "Tanggal Paket": formatTgl(p.packageDate),
      "Nama Penerima": p.customerName || "",
      "No Resi": p.resiNumber || "",
      "No Paket": p.packageNumber || "",
      Barcode: p.barcode || "",
      "Nama Barang": p.itemName || "",
      "Mode Paket": p.packageMode || "",
      "Jenis Jastip": p.serviceType || "",
      "Rute Pengiriman": p.deliveryRoute || "",
      "Berat Real (Kg)": p.realWeight ?? "",
      "Panjang (cm)": p.length ?? "",
      "Lebar (cm)": p.width ?? "",
      "Tinggi (cm)": p.height ?? "",
      "Berat Volume (Kg)": p.volumeWeight ?? "",
      "Berat Terpakai (Kg)": p.usedWeight ?? "",
      "Total Berat (Kg)": p.totalWeight ?? "",
      "Ongkir/Kg (Rp)": p.shippingRate ?? "",
      "Total Ongkir (Rp)": p.totalShipping ?? "",
      "Jenis Paking": p.packagingType || "",
      "Harga Barang (Rp)": p.price ?? "",
      Status: p.status === "diserahkan" ? "Diserahkan" : "Pending",
      Catatan: p.notes || "",
      "Tanggal Dibuat": formatTgl(p.createdAt),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Verifikasi Paket");
    XLSX.writeFile(wb, `verifikasi-paket-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-primary" /> Verifikasi Paket
          </h1>
          <p className="text-muted-foreground mt-1">
            Pilih nama penerima, lalu scan barcode paket satu per satu untuk memverifikasi kepemilikan.
          </p>
        </div>
        <div className="flex shrink-0">
          <Button
            variant="outline"
            onClick={exportExcel}
            disabled={!allPackages || allPackages.length === 0}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" /> Export Excel
          </Button>
        </div>
      </div>

      {!selectedGroup ? (
        /* STEP 1: Select group */
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama penerima..."
                className="pl-9"
                value={searchGroup}
                onChange={(e) => setSearchGroup(e.target.value)}
              />
            </div>
            <Badge variant="secondary">{allGroups.length} nama</Badge>
          </div>

          {isLoading ? (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="animate-pulse"><CardContent className="h-20 pt-4 bg-muted/20" /></Card>
              ))}
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">Belum ada data penerima</p>
              <p className="text-sm mt-1">Input paket terlebih dahulu untuk mulai verifikasi</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              {filteredGroups.map((group) => {
                const pending = group.packages.filter((p) => p.status !== "diserahkan").length;
                const done = group.packages.filter((p) => p.status === "diserahkan").length;
                return (
                  <Card
                    key={group.customerName}
                    className="cursor-pointer hover:shadow-md hover:border-primary/50 transition-all"
                    onClick={() => setSelectedGroup(group)}
                  >
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-base">{group.customerName}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{group.packages.length} paket</p>
                        </div>
                        <div className="text-right shrink-0">
                          {pending > 0 && <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300 block mb-1">{pending} pending</Badge>}
                          {done > 0 && <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300 block">{done} serahkan</Badge>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* STEP 2: Scan & Verify */
        <div className="space-y-4">
          {/* Selected group header */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-base">{selectedGroup.customerName}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedGroup.packages.length} paket · Scan barcode untuk verifikasi
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {scanHistory.length > 0 && (
                    <>
                      <Badge className="bg-green-600 text-white text-xs">{matchCount} ✓</Badge>
                      {mismatchCount > 0 && <Badge variant="destructive" className="text-xs">{mismatchCount} ✗</Badge>}
                    </>
                  )}
                  <Button variant="outline" size="sm" onClick={changeGroup}>Ganti</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Scan area */}
          <div id={SCANNER_ID} className={scanMode === "camera" ? "w-full rounded-xl overflow-hidden border" : "hidden"} />

          {/* Verify Result */}
          {verifyResult && !isSearching && (
            <Card className={`border-2 ${verifyResult === "match" ? "border-green-500 bg-green-50" : "border-red-400 bg-red-50"}`}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  {verifyResult === "match" ? (
                    <CheckCircle2 className="w-7 h-7 text-green-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-7 h-7 text-red-500 shrink-0 mt-0.5" />
                  )}
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
                            Paket ini milik <strong>{resultPkg.customerName || "tidak diketahui"}</strong>, bukan milik {selectedGroup.customerName}.
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
            <Card><CardContent className="flex items-center justify-center py-8 text-muted-foreground gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              Memverifikasi paket...
            </CardContent></Card>
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
                    {h.result === "match" ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                    )}
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

          {/* Package list for selected group */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" /> Daftar Paket — {selectedGroup.customerName}
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              {selectedGroup.packages.map((p: any) => {
                const wasScanned = scanHistory.find((h) => h.pkg?.id === p.id);
                return (
                  <div key={p.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${wasScanned ? "bg-green-50 border-green-200" : "bg-muted/30"}`}>
                    {wasScanned ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" /> : <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                    <span className="font-mono flex-1 truncate">{p.resiNumber || p.barcode}</span>
                    <Badge variant="outline" className={`text-xs shrink-0 ${p.status === "diserahkan" ? "bg-green-100 text-green-800 border-green-300" : "bg-amber-100 text-amber-800 border-amber-300"}`}>
                      {p.status === "diserahkan" ? "Diserahkan" : "Pending"}
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
