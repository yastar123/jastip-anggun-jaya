import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Camera, Upload, ScanLine, X, AlertCircle, Hash,
  CheckCircle2, XCircle, Package,
} from "lucide-react";
import { useLocation } from "wouter";
import QRCode from "qrcode";

function formatRp(n: any) {
  if (n === null || n === undefined || n === "") return "-";
  return `Rp ${Number(n).toLocaleString("id-ID")}`;
}
function formatDate(d: string | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function formatDateLong(d: string | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

const serviceLabel: Record<string, string> = {
  "jastip pesawat": "Jastip Pesawat",
  "jastip hemat+": "Jastip Hemat+",
  "jastip kargo": "Jastip Kargo",
  "jastip pelni": "Jastip Pelni",
};

function SmallQR({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvasRef.current && value) {
      QRCode.toCanvas(canvasRef.current, value, { width: 80, margin: 1 }).catch(() => {});
    }
  }, [value]);
  return <canvas ref={canvasRef} className="rounded" />;
}

type ScanState = "idle" | "camera" | "result";

export default function AdminScan() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [scanState, setScanState] = useState<ScanState>("idle");
  const [foundPackage, setFoundPackage] = useState<any>(null);
  const [groupPackages, setGroupPackages] = useState<any[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [notFoundMsg, setNotFoundMsg] = useState("");
  const [resiInput, setResiInput] = useState("");
  const [isLooking, setIsLooking] = useState(false);
  const [actioningIds, setActioningIds] = useState<Set<number>>(new Set());

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const SCANNER_ID = "admin-qr-scanner";

  async function lookupCode(code: string) {
    setIsLooking(true);
    setFoundPackage(null);
    setGroupPackages([]);
    setNotFound(false);
    try {
      const token = localStorage.getItem("jaj_token");

      // Try scan endpoint first
      const r = await fetch(`/api/packages/scan/${encodeURIComponent(code)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();

      let pkg: any = null;
      if (data.package) {
        pkg = data.package;
      } else {
        // Try searching by resi/barcode
        const r2 = await fetch(`/api/packages?search=${encodeURIComponent(code)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const packages = await r2.json();
        if (Array.isArray(packages) && packages.length > 0) {
          pkg = packages[0];
        }
      }

      if (!pkg) {
        setFoundPackage(null);
        setGroupPackages([]);
        setNotFound(true);
        setNotFoundMsg("Paket tidak ditemukan. Pastikan nomor resi atau barcode sudah benar.");
        setScanState("result");
        return;
      }

      // Fetch all packages to find sibling packages for same customer
      const allR = await fetch(`/api/packages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const allPkgs = await allR.json();
      const customerName = (pkg.customerName || "").trim().toLowerCase();
      const siblings: any[] = Array.isArray(allPkgs)
        ? allPkgs.filter((p: any) => (p.customerName || "").trim().toLowerCase() === customerName)
        : [pkg];

      setFoundPackage(pkg);
      setGroupPackages(siblings.length > 0 ? siblings : [pkg]);
      setNotFound(false);
      setScanState("result");
    } catch {
      setFoundPackage(null);
      setGroupPackages([]);
      setNotFound(true);
      setNotFoundMsg("Terjadi kesalahan saat mencari paket.");
      setScanState("result");
    } finally {
      setIsLooking(false);
    }
  }

  const handleScanSuccess = useCallback(async (code: string) => {
    await stopCamera();
    await lookupCode(code);
  }, []);

  async function startCamera() {
    setScanState("camera");
    try {
      const devices = await Html5Qrcode.getCameras();
      if (!devices.length) {
        toast({ variant: "destructive", title: "Kamera tidak tersedia" });
        setScanState("idle"); return;
      }
      const scanner = new Html5Qrcode(SCANNER_ID);
      scannerRef.current = scanner;
      await scanner.start(
        devices[devices.length - 1].id,
        { fps: 10, qrbox: { width: 250, height: 120 } },
        handleScanSuccess, undefined
      );
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal akses kamera", description: err?.message });
      setScanState("idle");
    }
  }

  async function stopCamera() {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
      scannerRef.current = null;
    }
  }

  useEffect(() => () => { stopCamera(); }, []);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const tempId = "admin-qr-temp-" + Date.now();
    const tempDiv = document.createElement("div");
    tempDiv.id = tempId;
    tempDiv.style.display = "none";
    document.body.appendChild(tempDiv);
    const scanner = new Html5Qrcode(tempId);
    scanner.scanFile(file, false)
      .then(async (code) => {
        scanner.clear(); document.body.removeChild(tempDiv);
        await lookupCode(code);
      })
      .catch(() => {
        scanner.clear(); document.body.removeChild(tempDiv);
        toast({ variant: "destructive", title: "Gagal membaca barcode", description: "Pastikan gambar berisi barcode yang jelas." });
      });
  }

  async function handleResiSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!resiInput.trim()) return;
    setScanState("result");
    await lookupCode(resiInput.trim());
    setResiInput("");
  }

  function reset() {
    setScanState("idle");
    setFoundPackage(null);
    setGroupPackages([]);
    setNotFound(false);
    setNotFoundMsg("");
    setResiInput("");
  }

  function updatePkgInGroup(updated: any) {
    setGroupPackages(prev => prev.map(p => p.id === updated.id ? updated : p));
    if (foundPackage?.id === updated.id) setFoundPackage(updated);
  }

  async function serahkanPaket(pkg: any) {
    setActioningIds(prev => new Set(prev).add(pkg.id));
    try {
      const token = localStorage.getItem("jaj_token");
      const r = await fetch(`/api/packages/${pkg.id}/serahkan`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!r.ok) throw new Error("Gagal menyerahkan paket");
      const updated = await r.json();
      updatePkgInGroup(updated);
      toast({ title: "Paket Diserahkan", description: `${pkg.resiNumber} berhasil diserahkan.` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message });
    } finally {
      setActioningIds(prev => { const s = new Set(prev); s.delete(pkg.id); return s; });
    }
  }

  async function tolakPaket(pkg: any) {
    setActioningIds(prev => new Set(prev).add(pkg.id));
    try {
      const token = localStorage.getItem("jaj_token");
      const r = await fetch(`/api/packages/${pkg.id}/tolak`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!r.ok) throw new Error("Gagal menolak paket");
      const updated = await r.json();
      updatePkgInGroup(updated);
      toast({ title: "Dikembalikan ke Pending", description: `${pkg.resiNumber} dikembalikan ke Pending.` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message });
    } finally {
      setActioningIds(prev => { const s = new Set(prev); s.delete(pkg.id); return s; });
    }
  }

  async function serahkanSemua() {
    const pending = groupPackages.filter(p => p.status !== "diserahkan");
    for (const p of pending) {
      await serahkanPaket(p);
    }
  }

  const isGroupView = groupPackages.length > 1;
  const totalWeight = groupPackages.reduce((s, p) => s + Number(p.usedWeight ?? p.realWeight ?? 0), 0);
  const totalShipping = groupPackages.reduce((s, p) => s + Number(p.totalShipping ?? 0), 0);
  const pendingCount = groupPackages.filter(p => p.status !== "diserahkan").length;
  const allDone = pendingCount === 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ScanLine className="h-7 w-7 text-primary" />Scan Barcode Paket
        </h1>
        <p className="text-muted-foreground mt-1">Scan, upload gambar, atau ketik nomor resi untuk menyerahkan paket.</p>
      </div>

      <div id={SCANNER_ID} className={scanState === "camera" ? "w-full rounded-xl overflow-hidden border" : "hidden"} />

      {scanState === "idle" && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Card className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all group" onClick={startCamera}>
              <CardContent className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Camera className="w-7 h-7 text-primary" />
                </div>
                <div><p className="font-semibold">Scan Kamera</p><p className="text-sm text-muted-foreground mt-1">Arahkan kamera ke barcode</p></div>
                <Button className="mt-1">Buka Kamera</Button>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg hover:border-primary/50 transition-all group">
              <CardContent className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                <div className="w-14 h-14 rounded-full bg-secondary/10 flex items-center justify-center group-hover:bg-secondary/20 transition-colors">
                  <Upload className="w-7 h-7 text-secondary" />
                </div>
                <div><p className="font-semibold">Upload Gambar</p><p className="text-sm text-muted-foreground mt-1">Upload foto barcode dari galeri</p></div>
                <Button className="mt-1 bg-secondary hover:bg-secondary/90" onClick={() => fileInputRef.current?.click()}>Pilih Gambar</Button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Hash className="h-4 w-4" />Input Nomor Resi / Barcode</CardTitle>
              <CardDescription>Ketik nomor resi, barcode, atau nomor paket secara manual</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleResiSearch} className="flex gap-2">
                <Input value={resiInput} onChange={e => setResiInput(e.target.value)} placeholder="Contoh: JAJ-ABC123 atau JNE123456789" className="font-mono" />
                <Button type="submit" disabled={!resiInput.trim() || isLooking}>{isLooking ? "Mencari..." : "Cari"}</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {scanState === "camera" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Camera className="h-4 w-4" />Kamera Aktif</CardTitle>
            <Button variant="outline" size="sm" onClick={() => { stopCamera(); setScanState("idle"); }}><X className="w-4 h-4 mr-1" />Tutup</Button>
          </CardHeader>
          <CardContent><p className="text-sm text-muted-foreground text-center">Arahkan kamera ke barcode paket...</p></CardContent>
        </Card>
      )}

      {scanState === "result" && (
        <div className="space-y-4">
          {isLooking ? (
            <Card><CardContent className="flex items-center justify-center py-12 text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3" />Mencari paket...
            </CardContent></Card>
          ) : notFound || !foundPackage ? (
            <Card className="border-destructive/50">
              <CardContent className="flex items-center gap-3 py-8 text-destructive">
                <AlertCircle className="w-6 h-6 shrink-0" />
                <div><p className="font-semibold">Paket tidak ditemukan</p><p className="text-sm text-muted-foreground mt-1">{notFoundMsg || "Pastikan nomor resi atau barcode sudah benar."}</p></div>
              </CardContent>
            </Card>
          ) : isGroupView ? (
            /* ========== GRUP VIEW ========== */
            <div className="space-y-4">
              {/* Group header */}
              <Card className={`border-2 ${allDone ? "border-green-400 bg-green-50" : "border-primary/40 bg-primary/5"}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-lg">{foundPackage.customerName}</p>
                      <p className="text-sm text-muted-foreground">
                        {groupPackages.length} paket · Berat {totalWeight.toFixed(3)} Kg · Total Ongkir {formatRp(totalShipping)}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-sm px-3 py-1 ${allDone ? "bg-green-100 text-green-800 border-green-300" : "bg-amber-100 text-amber-800 border-amber-300"}`}
                    >
                      {allDone ? "✓ Semua Diserahkan" : `${pendingCount} Pending`}
                    </Badge>
                  </div>

                  {!allDone && (
                    <Button
                      className="w-full mt-3 bg-green-600 hover:bg-green-700 gap-2"
                      onClick={serahkanSemua}
                      disabled={actioningIds.size > 0}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Serahkan Semua ({pendingCount} Paket)
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Individual packages */}
              {groupPackages.map((pkg: any, idx: number) => {
                const isDone = pkg.status === "diserahkan";
                const isActioning = actioningIds.has(pkg.id);
                return (
                  <Card key={pkg.id} className={`hover:shadow-md transition-shadow ${isDone ? "border-green-200" : ""}`}>
                    <CardContent className="pt-4 pb-3">
                      {/* Header */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className="shrink-0 text-center">
                          <SmallQR value={pkg.barcode || pkg.resiNumber || String(pkg.id)} />
                          <p className="text-xs text-muted-foreground mt-1 font-mono">#{idx + 1}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="font-mono font-bold text-sm">{pkg.barcode || "-"}</p>
                            <Badge
                              variant="outline"
                              className={`text-xs ${isDone ? "bg-green-100 text-green-800 border-green-300" : "bg-amber-100 text-amber-800 border-amber-300"}`}
                            >
                              {isDone ? "✓ Diserahkan" : "● Pending"}
                            </Badge>
                          </div>
                          <p className="text-sm font-semibold text-primary">{pkg.customerName || "-"}</p>
                        </div>
                      </div>

                      {/* All fields grid */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-xs border-t pt-3 mb-3">
                        <div>
                          <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">No Resi</p>
                          <p className="font-mono font-semibold">{pkg.resiNumber || "-"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">No Paket</p>
                          <p className="font-mono">{pkg.packageNumber || "-"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Tanggal</p>
                          <p>{formatDateLong(pkg.packageDate)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Jenis Jastip</p>
                          <p>{serviceLabel[pkg.serviceType] || pkg.serviceType || "-"}</p>
                        </div>
                        <div className="md:col-span-2">
                          <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Rute Pengiriman</p>
                          <p>{pkg.deliveryRoute || "-"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Jenis Paking</p>
                          <p>{pkg.packagingType || "-"}</p>
                        </div>
                        {(pkg.serviceType === "jastip kargo" || pkg.serviceType === "jastip pelni") && (
                          <div className="md:col-span-2">
                            <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Nama Barang</p>
                            <p>{pkg.itemName || "-"}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Berat Real</p>
                          <p className="font-semibold">{pkg.realWeight != null ? `${pkg.realWeight} Kg` : "-"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Berat Volume</p>
                          <p>{pkg.volumeWeight != null ? `${Number(pkg.volumeWeight).toFixed(3)} Kg` : "-"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Berat Digunakan</p>
                          <p className="font-semibold">{pkg.usedWeight != null ? `${pkg.usedWeight} Kg` : "-"}</p>
                        </div>
                        {(pkg.length || pkg.width || pkg.height) && (
                          <div>
                            <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Dimensi (cm)</p>
                            <p className="font-mono">{pkg.length || "?"} × {pkg.width || "?"} × {pkg.height || "?"}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Total Ongkir</p>
                          <p className="font-bold text-primary text-sm">{formatRp(pkg.totalShipping)}</p>
                        </div>
                        {pkg.pickedUpAt && (
                          <div>
                            <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Diserahkan Pada</p>
                            <p>{formatDate(pkg.pickedUpAt)}</p>
                          </div>
                        )}
                      </div>

                      {/* Action buttons per package */}
                      {!isDone ? (
                        <div className="flex gap-2 pt-1 border-t">
                          <Button
                            size="sm"
                            className="flex-1 bg-green-600 hover:bg-green-700 gap-1"
                            onClick={() => serahkanPaket(pkg)}
                            disabled={isActioning}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {isActioning ? "Memproses..." : "Serahkan"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 border-red-300 text-red-600 hover:bg-red-50 gap-1"
                            onClick={() => tolakPaket(pkg)}
                            disabled={isActioning}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Tolak
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 pt-2 border-t">
                          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                          <span className="text-sm font-medium text-green-700 flex-1">Sudah diserahkan</span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-amber-300 text-amber-700 hover:bg-amber-50"
                            onClick={() => tolakPaket(pkg)}
                            disabled={isActioning}
                          >
                            {isActioning ? "..." : "Kembalikan ke Pending"}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            /* ========== SINGLE PACKAGE VIEW ========== */
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ScanLine className="h-4 w-4 text-primary" />
                    Paket Ditemukan
                  </CardTitle>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${foundPackage.status === "diserahkan" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                    {foundPackage.status === "diserahkan" ? "✓ Diserahkan" : "● Pending"}
                  </span>
                </div>
                <CardDescription>
                  Konsumen: <span className="font-medium text-foreground">{foundPackage.customerName}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: "No. Barcode", value: foundPackage.barcode, mono: true },
                    { label: "No. Resi", value: foundPackage.resiNumber, mono: true },
                    { label: "No. Paket", value: foundPackage.packageNumber || "-", mono: true },
                    { label: "Tanggal", value: foundPackage.packageDate ? new Date(foundPackage.packageDate).toLocaleDateString("id-ID") : "-" },
                    { label: "Admin Input", value: foundPackage.adminName || "-" },
                    { label: "Nama / Jenis Barang", value: foundPackage.itemName || "-" },
                    { label: "Jenis Jastip", value: foundPackage.serviceType ? foundPackage.serviceType.replace("jastip ", "Jastip ") : "-" },
                    { label: "Rute Pengiriman", value: foundPackage.deliveryRoute || "-" },
                    { label: "Berat Real", value: foundPackage.realWeight != null ? `${foundPackage.realWeight} Kg` : "-" },
                    { label: "Berat Volume", value: foundPackage.volumeWeight != null ? `${foundPackage.volumeWeight} Kg` : "-" },
                    { label: "Berat Digunakan", value: foundPackage.usedWeight != null ? `${foundPackage.usedWeight} Kg` : "-" },
                    { label: "Jenis Paking", value: foundPackage.packagingType || "-" },
                    { label: "Tarif Ongkir/kg", value: formatRp(foundPackage.shippingRate) },
                    { label: "Total Ongkir", value: formatRp(foundPackage.totalShipping) },
                  ].map((item) => (
                    <div key={item.label} className="bg-muted/40 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-0.5">{item.label}</p>
                      <p className={`text-sm font-medium ${(item as any).mono ? "font-mono" : ""}`}>{item.value}</p>
                    </div>
                  ))}
                </div>

                {foundPackage.status !== "diserahkan" ? (
                  <div className="flex gap-3 pt-2">
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
                      onClick={() => serahkanPaket(foundPackage)}
                      disabled={actioningIds.has(foundPackage.id)}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {actioningIds.has(foundPackage.id) ? "Memproses..." : "Serahkan Paket"}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 border-red-300 text-red-600 hover:bg-red-50 gap-2"
                      onClick={() => tolakPaket(foundPackage)}
                      disabled={actioningIds.has(foundPackage.id)}
                    >
                      <XCircle className="w-4 h-4" />
                      Tolak
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 pt-2 p-3 bg-green-50 rounded-lg border border-green-200">
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-green-800">Paket sudah diserahkan</p>
                      {foundPackage.pickedUpAt && (
                        <p className="text-xs text-green-600">Diserahkan: {formatDate(foundPackage.pickedUpAt)}</p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-auto border-amber-300 text-amber-700 hover:bg-amber-50"
                      onClick={() => tolakPaket(foundPackage)}
                      disabled={actioningIds.has(foundPackage.id)}
                    >
                      Kembalikan ke Pending
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={reset}>Scan Lagi</Button>
            <Button variant="outline" className="flex-1" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" />Upload Gambar
            </Button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
          </div>
        </div>
      )}
    </div>
  );
}
