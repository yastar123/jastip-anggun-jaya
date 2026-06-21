import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useScanPackage } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { useToast } from "@/hooks/use-toast";
import { Camera, Upload, ScanLine, Hash, CheckCircle2, AlertCircle, X, ShieldAlert } from "lucide-react";

type ScanResult = {
  valid: boolean;
  message: string;
  isOwner?: boolean;
  package?: any;
};

export default function CustomerScan() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [mode, setMode] = useState<"idle" | "camera" | "result">("idle");
  const [resiInput, setResiInput] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scannerDivId = "customer-qr-scanner";

  const { refetch: fetchScan } = useScanPackage("", { query: { enabled: false, retry: false } });

  async function lookupResi(code: string) {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/scan/${encodeURIComponent(code)}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("jaj_token")}` },
      });
      const data = await res.json();

      if (!res.ok || !data.valid) {
        return { valid: false, message: data.message || "Paket tidak ditemukan", isOwner: false };
      }

      const pkg = data.package;
      const isOwner = pkg?.customerId === user?.id;

      if (!isOwner) {
        return {
          valid: false,
          message: "Bukan barcode dari paket kamu",
          isOwner: false,
          package: null,
        };
      }

      return { valid: true, message: "Paket kamu ditemukan!", isOwner: true, package: pkg };
    } catch {
      return { valid: false, message: "Terjadi kesalahan saat mencari paket", isOwner: false };
    } finally {
      setIsLoading(false);
    }
  }

  const handleCodeFound = useCallback(async (code: string) => {
    stopCamera();
    setMode("result");
    const result = await lookupResi(code);
    setScanResult(result);
    toast({
      title: result.valid ? "Paket Ditemukan!" : result.message,
      variant: result.valid ? "default" : "destructive",
    });
  }, [user]);

  async function startCamera() {
    setMode("camera");
    try {
      const deviceList = await Html5Qrcode.getCameras();
      if (deviceList.length === 0) {
        toast({ variant: "destructive", title: "Kamera tidak tersedia" });
        setMode("idle"); return;
      }
      const scanner = new Html5Qrcode(scannerDivId);
      scannerRef.current = scanner;
      const cameraId = deviceList[deviceList.length - 1].id;
      await scanner.start(cameraId, { fps: 10, qrbox: { width: 250, height: 120 } }, handleCodeFound, undefined);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal akses kamera", description: err?.message || "Izinkan akses kamera." });
      setMode("idle");
    }
  }

  async function stopCamera() {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
      scannerRef.current = null;
    }
  }

  useEffect(() => { return () => { stopCamera(); }; }, []);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const tempId = "qr-temp-" + Date.now();
    const tempDiv = document.createElement("div");
    tempDiv.id = tempId;
    tempDiv.style.display = "none";
    document.body.appendChild(tempDiv);

    const scanner = new Html5Qrcode(tempId);
    scanner.scanFile(file, false)
      .then((code) => {
        scanner.clear();
        document.body.removeChild(tempDiv);
        handleCodeFound(code);
      })
      .catch(() => {
        scanner.clear();
        document.body.removeChild(tempDiv);
        toast({ variant: "destructive", title: "Gagal membaca barcode", description: "Pastikan gambar berisi barcode yang jelas." });
      });
  }

  async function handleResiSearch(e: React.FormEvent) {
    e.preventDefault();
    const code = resiInput.trim();
    if (!code) return;
    setMode("result");
    const result = await lookupResi(code);
    setScanResult(result);
  }

  function reset() {
    setMode("idle");
    setScanResult(null);
    setResiInput("");
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ScanLine className="h-7 w-7 text-primary" />Scan Paket
        </h1>
        <p className="text-muted-foreground mt-1">Scan barcode, upload gambar, atau input nomor resi paket kamu.</p>
      </div>

      <div id={scannerDivId} className={mode === "camera" ? "w-full rounded-xl overflow-hidden border" : "hidden"} />

      {mode === "idle" && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Kamera */}
            <Card className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all group" onClick={startCamera}>
              <CardContent className="flex flex-col items-center justify-center py-10 text-center gap-3">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Camera className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">Scan Kamera</p>
                  <p className="text-sm text-muted-foreground mt-1">Arahkan kamera ke barcode paketmu</p>
                </div>
                <Button className="mt-1">Buka Kamera</Button>
              </CardContent>
            </Card>

            {/* Upload */}
            <Card className="hover:shadow-lg hover:border-primary/50 transition-all group">
              <CardContent className="flex flex-col items-center justify-center py-10 text-center gap-3">
                <div className="w-14 h-14 rounded-full bg-secondary/10 flex items-center justify-center group-hover:bg-secondary/20 transition-colors">
                  <Upload className="w-7 h-7 text-secondary" />
                </div>
                <div>
                  <p className="font-semibold">Upload Gambar</p>
                  <p className="text-sm text-muted-foreground mt-1">Upload foto barcode dari galeri</p>
                </div>
                <Button className="mt-1 bg-secondary hover:bg-secondary/90" onClick={() => fileInputRef.current?.click()}>
                  Pilih Gambar
                </Button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </CardContent>
            </Card>
          </div>

          {/* Input Nomor Resi */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Hash className="h-4 w-4" />Input Nomor Resi
              </CardTitle>
              <CardDescription>Ketik nomor resi paketmu secara manual</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleResiSearch} className="flex gap-2">
                <Input
                  value={resiInput}
                  onChange={(e) => setResiInput(e.target.value)}
                  placeholder="Contoh: JNE123456789"
                  className="font-mono"
                  autoFocus
                />
                <Button type="submit" disabled={isLoading || !resiInput.trim()}>
                  {isLoading ? "Mencari..." : "Cari"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {mode === "camera" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="h-4 w-4" />Kamera Aktif
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => { stopCamera(); setMode("idle"); }}>
              <X className="w-4 h-4 mr-1" /> Tutup
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center">Arahkan kamera ke barcode paketmu...</p>
          </CardContent>
        </Card>
      )}

      {mode === "result" && (
        <div className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3" />
                Mencari paket...
              </CardContent>
            </Card>
          ) : scanResult ? (
            <Card className={`border-l-4 ${scanResult.valid ? "border-l-green-500" : scanResult.message === "Bukan barcode dari paket kamu" ? "border-l-orange-500" : "border-l-destructive"}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  {scanResult.valid ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : scanResult.message === "Bukan barcode dari paket kamu" ? (
                    <ShieldAlert className="w-5 h-5 text-orange-500" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-destructive" />
                  )}
                  <CardTitle className={
                    scanResult.valid
                      ? "text-green-700"
                      : scanResult.message === "Bukan barcode dari paket kamu"
                      ? "text-orange-700"
                      : "text-destructive"
                  }>
                    {scanResult.message}
                  </CardTitle>
                </div>
              </CardHeader>
              {scanResult.valid && scanResult.package && (
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <div className="text-sm text-muted-foreground">Nomor Resi</div>
                      <div className="font-mono font-medium">{scanResult.package.resiNumber}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Status</div>
                      <div className="mt-1"><StatusBadge status={scanResult.package.status} /></div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-sm text-muted-foreground">Nama Barang</div>
                      <div className="font-medium">{scanResult.package.itemName}</div>
                    </div>
                    {scanResult.package.totalShipping && (
                      <div>
                        <div className="text-sm text-muted-foreground">Total Ongkir</div>
                        <div className="font-semibold">Rp {Number(scanResult.package.totalShipping).toLocaleString("id-ID")}</div>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
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
