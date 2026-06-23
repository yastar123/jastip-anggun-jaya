import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Camera, Upload, ScanLine, X, AlertCircle, Hash, CheckCircle2, XCircle } from "lucide-react";
import { useLocation } from "wouter";

function formatRp(n: any) {
  if (n === null || n === undefined || n === "") return "-";
  return `Rp ${Number(n).toLocaleString("id-ID")}`;
}
function formatDate(d: string | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
}

type ScanState = "idle" | "camera" | "result";

export default function AdminScan() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [scanState, setScanState] = useState<ScanState>("idle");
  const [foundPackage, setFoundPackage] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const [notFoundMsg, setNotFoundMsg] = useState("");
  const [resiInput, setResiInput] = useState("");
  const [isLooking, setIsLooking] = useState(false);
  const [isActioning, setIsActioning] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const SCANNER_ID = "admin-qr-scanner";

  async function lookupCode(code: string) {
    setIsLooking(true);
    setFoundPackage(null);
    setNotFound(false);
    try {
      const token = localStorage.getItem("jaj_token");
      const r = await fetch(`/api/packages/scan/${encodeURIComponent(code)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      if (data.package) {
        setFoundPackage(data.package);
        setNotFound(false);
        setScanState("result");
        return;
      }
      // Try searching packages by resi/packageNumber
      const r2 = await fetch(`/api/packages?search=${encodeURIComponent(code)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const packages = await r2.json();
      if (Array.isArray(packages) && packages.length > 0) {
        setFoundPackage(packages[0]);
        setNotFound(false);
        setScanState("result");
      } else {
        setFoundPackage(null);
        setNotFound(true);
        setNotFoundMsg("Paket tidak ditemukan. Pastikan nomor resi atau barcode sudah benar.");
        setScanState("result");
      }
    } catch {
      setFoundPackage(null);
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
    setNotFound(false);
    setNotFoundMsg("");
    setResiInput("");
  }

  async function serahkanPaket() {
    if (!foundPackage) return;
    setIsActioning(true);
    try {
      const token = localStorage.getItem("jaj_token");
      const r = await fetch(`/api/packages/${foundPackage.id}/serahkan`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!r.ok) throw new Error("Gagal menyerahkan paket");
      const updated = await r.json();
      setFoundPackage(updated);
      toast({ title: "Paket Diserahkan", description: `Paket ${foundPackage.resiNumber} berhasil diserahkan ke konsumen.` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message });
    } finally {
      setIsActioning(false);
    }
  }

  async function tolakPaket() {
    if (!foundPackage) return;
    setIsActioning(true);
    try {
      const token = localStorage.getItem("jaj_token");
      const r = await fetch(`/api/packages/${foundPackage.id}/tolak`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!r.ok) throw new Error("Gagal menolak paket");
      const updated = await r.json();
      setFoundPackage(updated);
      toast({ title: "Paket Ditolak", description: `Status paket ${foundPackage.resiNumber} dikembalikan ke Pending.` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message });
    } finally {
      setIsActioning(false);
    }
  }

  const pkg = foundPackage;
  const isDiserahkan = pkg?.status === "diserahkan";

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
          ) : notFound || !pkg ? (
            <Card className="border-destructive/50">
              <CardContent className="flex items-center gap-3 py-8 text-destructive">
                <AlertCircle className="w-6 h-6 shrink-0" />
                <div><p className="font-semibold">Paket tidak ditemukan</p><p className="text-sm text-muted-foreground mt-1">{notFoundMsg || "Pastikan nomor resi atau barcode sudah benar."}</p></div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ScanLine className="h-4 w-4 text-primary" />
                    Paket Ditemukan
                  </CardTitle>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isDiserahkan ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                    {isDiserahkan ? "✓ Diserahkan" : "● Pending"}
                  </span>
                </div>
                <CardDescription>
                  Konsumen: <span className="font-medium text-foreground">{pkg.customerName}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Package info grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: "No. Barcode", value: pkg.barcode, mono: true },
                    { label: "No. Resi", value: pkg.resiNumber, mono: true },
                    { label: "No. Paket", value: pkg.packageNumber || "-", mono: true },
                    { label: "Tanggal", value: pkg.packageDate ? new Date(pkg.packageDate).toLocaleDateString("id-ID") : "-" },
                    { label: "Mode Paket", value: pkg.packageMode === "grup" ? "Grup Paket" : pkg.packageMode === "single" ? "1 Paket" : "-" },
                    { label: "Admin Input", value: pkg.adminName || "-" },
                    { label: "Nama / Jenis Barang", value: pkg.itemName || "-" },
                    { label: "Jenis Jastip", value: pkg.serviceType ? pkg.serviceType.replace("jastip ", "Jastip ") : "-" },
                    { label: "Rute Pengiriman", value: pkg.deliveryRoute || "-" },
                    { label: "Berat Real", value: pkg.realWeight != null ? `${pkg.realWeight} Kg` : "-" },
                    { label: "Berat Volume", value: pkg.volumeWeight != null ? `${pkg.volumeWeight} Kg` : "-" },
                    { label: "Berat Digunakan", value: pkg.usedWeight != null ? `${pkg.usedWeight} Kg` : "-" },
                    { label: "Total Berat", value: pkg.totalWeight != null ? `${pkg.totalWeight} Kg` : "-" },
                    { label: "Jenis Paking", value: pkg.packagingType || "-" },
                    { label: "Tarif Ongkir/kg", value: formatRp(pkg.shippingRate) },
                    { label: "Total Ongkir", value: formatRp(pkg.totalShipping) },
                    { label: "Harga Barang", value: formatRp(pkg.price) },
                  ].map((item) => (
                    <div key={item.label} className="bg-muted/40 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-0.5">{item.label}</p>
                      <p className={`text-sm font-medium ${(item as any).mono ? "font-mono" : ""}`}>{item.value}</p>
                    </div>
                  ))}
                  {pkg.notes && (
                    <div className="col-span-2 md:col-span-3 bg-muted/40 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-0.5">Catatan</p>
                      <p className="text-sm font-medium">{pkg.notes}</p>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                {!isDiserahkan ? (
                  <div className="flex gap-3 pt-2">
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
                      onClick={serahkanPaket}
                      disabled={isActioning}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {isActioning ? "Memproses..." : "Serahkan Paket"}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 border-red-300 text-red-600 hover:bg-red-50 gap-2"
                      onClick={tolakPaket}
                      disabled={isActioning}
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
                      {pkg.pickedUpAt && (
                        <p className="text-xs text-green-600">
                          Diserahkan: {formatDate(pkg.pickedUpAt)}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-auto border-amber-300 text-amber-700 hover:bg-amber-50"
                      onClick={tolakPaket}
                      disabled={isActioning}
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
