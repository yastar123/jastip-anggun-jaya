import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { useToast } from "@/hooks/use-toast";
import { Camera, Upload, ScanLine, Hash, X, AlertCircle, ShieldAlert, CheckCircle2, PackageCheck } from "lucide-react";

function formatRp(n: any) {
  if (n === null || n === undefined || n === "") return "-";
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

type ScanState = "idle" | "camera" | "result";
type ResultState = { type: "success"; pkg: any } | { type: "not_owner" } | { type: "not_found" } | { type: "already_picked" };

export default function CustomerScan() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [scanState, setScanState] = useState<ScanState>("idle");
  const [result, setResult] = useState<ResultState | null>(null);
  const [resiInput, setResiInput] = useState("");
  const [isLooking, setIsLooking] = useState(false);
  const [isPickingUp, setIsPickingUp] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const SCANNER_ID = "customer-qr-scanner";

  async function lookupCode(code: string) {
    setIsLooking(true);
    setScanState("result");
    try {
      const token = localStorage.getItem("jaj_token");
      // Try barcode scan endpoint
      const r = await fetch(`/api/packages/scan/${encodeURIComponent(code)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();

      if (data.message === "Bukan barcode dari paket kamu" || data.message === "Paket ini bukan milik Anda") {
        setResult({ type: "not_owner" }); return;
      }
      if (data.message === "Paket sudah diambil sebelumnya") {
        setResult({ type: "already_picked" }); return;
      }
      if (data.valid && data.package) {
        setResult({ type: "success", pkg: data.package }); return;
      }

      // Fallback: search by resi/packageNumber among customer's packages
      const r2 = await fetch(`/api/packages?search=${encodeURIComponent(code)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const packages = await r2.json();
      if (Array.isArray(packages) && packages.length > 0) {
        const pkg = packages[0];
        if (pkg.customerId !== user?.id) {
          setResult({ type: "not_owner" });
        } else if (pkg.status === "picked_up") {
          setResult({ type: "already_picked" });
        } else {
          setResult({ type: "success", pkg });
        }
      } else {
        setResult({ type: "not_found" });
      }
    } catch {
      setResult({ type: "not_found" });
    } finally {
      setIsLooking(false);
    }
  }

  const handleScanSuccess = useCallback(async (code: string) => {
    await stopCamera();
    await lookupCode(code);
  }, [user]);

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
    const tempId = "cust-qr-temp-" + Date.now();
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
    const code = resiInput.trim();
    setResiInput("");
    await lookupCode(code);
  }

  async function handlePickup() {
    if (result?.type !== "success") return;
    setIsPickingUp(true);
    try {
      const token = localStorage.getItem("jaj_token");
      const r = await fetch(`/api/packages/${result.pkg.id}/customer-pickup`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Gagal mengambil paket");
      setResult({ type: "success", pkg: data });
      toast({ title: "Berhasil!", description: "Paket berhasil diambil. Status diperbarui menjadi Sudah Diambil." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message });
    } finally {
      setIsPickingUp(false);
    }
  }

  function reset() {
    setScanState("idle");
    setResult(null);
    setResiInput("");
  }

  const pkg = result?.type === "success" ? result.pkg : null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ScanLine className="h-7 w-7 text-primary" />Scan Paket Saya
        </h1>
        <p className="text-muted-foreground mt-1">Scan barcode, upload gambar, atau ketik nomor resi.</p>
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
                <div><p className="font-semibold">Scan Kamera</p><p className="text-sm text-muted-foreground mt-1">Arahkan kamera ke barcode paketmu</p></div>
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
              <CardTitle className="text-base flex items-center gap-2"><Hash className="h-4 w-4" />Input Nomor Resi</CardTitle>
              <CardDescription>Ketik nomor resi paketmu secara manual</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleResiSearch} className="flex gap-2">
                <Input value={resiInput} onChange={e => setResiInput(e.target.value)} placeholder="Contoh: JNE123456789" className="font-mono" autoFocus />
                <Button type="submit" disabled={isLooking || !resiInput.trim()}>{isLooking ? "Mencari..." : "Cari"}</Button>
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
          <CardContent><p className="text-sm text-muted-foreground text-center">Arahkan kamera ke barcode paketmu...</p></CardContent>
        </Card>
      )}

      {scanState === "result" && (
        <div className="space-y-4">
          {isLooking ? (
            <Card><CardContent className="flex items-center justify-center py-12 text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3" />Mencari paket...
            </CardContent></Card>
          ) : result?.type === "not_found" ? (
            <Card className="border-destructive/40">
              <CardContent className="flex items-center gap-3 py-8">
                <AlertCircle className="w-6 h-6 text-destructive shrink-0" />
                <div><p className="font-semibold text-destructive">Paket tidak ditemukan</p><p className="text-sm text-muted-foreground mt-1">Pastikan nomor resi atau barcode sudah benar.</p></div>
              </CardContent>
            </Card>
          ) : result?.type === "not_owner" ? (
            <Card className="border-orange-400">
              <CardContent className="flex items-center gap-3 py-8">
                <ShieldAlert className="w-6 h-6 text-orange-500 shrink-0" />
                <div><p className="font-semibold text-orange-700">Bukan barcode dari paket kamu</p><p className="text-sm text-muted-foreground mt-1">Barcode ini bukan milik akunmu. Hubungi admin jika ada pertanyaan.</p></div>
              </CardContent>
            </Card>
          ) : result?.type === "already_picked" ? (
            <Card className="border-gray-300">
              <CardContent className="flex items-center gap-3 py-8">
                <CheckCircle2 className="w-6 h-6 text-gray-400 shrink-0" />
                <div><p className="font-semibold">Paket sudah diambil</p><p className="text-sm text-muted-foreground mt-1">Paket ini sudah diambil sebelumnya.</p></div>
              </CardContent>
            </Card>
          ) : pkg ? (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base text-green-700 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" /> Paket Kamu Ditemukan!
                  </CardTitle>
                  <StatusBadge status={pkg.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-0">
                {/* Full Data Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[900px]">
                    <thead>
                      <tr className="border-y bg-muted/30">
                        {["Tanggal","No Resi","No Paket","Nama Konsumen","Berat Real (Kg)","P (cm)","L (cm)","T (cm)","Berat Volume","Jenis Paking","Berat Digunakan","Ongkir/Kg","Total Berat","Harga","Total Ongkir","Status"].map(h => (
                          <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-3 px-3 whitespace-nowrap text-muted-foreground">{formatDate(pkg.packageDate || pkg.createdAt)}</td>
                        <td className="py-3 px-3 font-mono font-medium whitespace-nowrap">{pkg.resiNumber || "-"}</td>
                        <td className="py-3 px-3 font-mono whitespace-nowrap">{pkg.packageNumber || "-"}</td>
                        <td className="py-3 px-3 whitespace-nowrap font-medium">{pkg.customerName || user?.name || "-"}</td>
                        <td className="py-3 px-3 whitespace-nowrap text-right">{pkg.realWeight ?? "-"}</td>
                        <td className="py-3 px-3 whitespace-nowrap text-right">{pkg.length ?? "-"}</td>
                        <td className="py-3 px-3 whitespace-nowrap text-right">{pkg.width ?? "-"}</td>
                        <td className="py-3 px-3 whitespace-nowrap text-right">{pkg.height ?? "-"}</td>
                        <td className="py-3 px-3 whitespace-nowrap text-right">{pkg.volumeWeight ?? "-"}</td>
                        <td className="py-3 px-3 whitespace-nowrap">{packagingLabel(pkg.packagingType)}</td>
                        <td className="py-3 px-3 whitespace-nowrap text-right font-medium">{pkg.usedWeight ?? "-"}</td>
                        <td className="py-3 px-3 whitespace-nowrap text-right">{formatRp(pkg.shippingRate)}</td>
                        <td className="py-3 px-3 whitespace-nowrap text-right">{pkg.totalWeight ?? "-"}</td>
                        <td className="py-3 px-3 whitespace-nowrap text-right">{formatRp(pkg.price)}</td>
                        <td className="py-3 px-3 whitespace-nowrap text-right font-semibold text-primary">{formatRp(pkg.totalShipping)}</td>
                        <td className="py-3 px-3 whitespace-nowrap"><StatusBadge status={pkg.status} /></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Ambil Paket Button */}
                {pkg.status !== "picked_up" && (
                  <div className="p-4 border-t bg-green-50">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <p className="font-semibold text-green-800">Paket siap diambil!</p>
                        <p className="text-sm text-green-700 mt-0.5">Total Ongkir: <span className="font-bold">{formatRp(pkg.totalShipping)}</span></p>
                      </div>
                      <Button
                        className="bg-green-600 hover:bg-green-700 text-white gap-2"
                        onClick={handlePickup}
                        disabled={isPickingUp}
                      >
                        <PackageCheck className="w-4 h-4" />
                        {isPickingUp ? "Memproses..." : "Ambil Paket"}
                      </Button>
                    </div>
                  </div>
                )}

                {pkg.status === "picked_up" && (
                  <div className="p-4 border-t bg-gray-50">
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      Paket ini sudah diambil.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

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
