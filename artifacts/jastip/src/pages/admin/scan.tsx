import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Camera, Upload, ScanLine, CheckCircle2, X, AlertCircle } from "lucide-react";
import { useListPackages } from "@workspace/api-client-react";
import { useLocation } from "wouter";

export default function AdminScan() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { data: packages } = useListPackages();

  const [mode, setMode] = useState<"idle" | "camera" | "result">("idle");
  const [scannedCode, setScannedCode] = useState("");
  const [foundPackage, setFoundPackage] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameras, setCameras] = useState<any[]>([]);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerDivId = "html5-qr-code-scanner";

  const lookupCode = useCallback((code: string) => {
    if (!packages) return null;
    return packages.find((p: any) =>
      p.resiNumber === code ||
      p.packageNumber === code ||
      p.id.toString() === code
    ) || null;
  }, [packages]);

  const handleScanSuccess = useCallback((decodedText: string) => {
    setScannedCode(decodedText);
    const found = lookupCode(decodedText);
    setFoundPackage(found);
    stopCamera();
    setMode("result");
    toast({
      title: found ? "Paket Ditemukan!" : "Kode Dipindai",
      description: found
        ? `No Resi: ${found.resiNumber} — ${found.customerName || "Customer"}`
        : `Kode: ${decodedText} — tidak ditemukan dalam sistem`,
      variant: found ? "default" : "destructive",
    });
  }, [lookupCode, toast]);

  async function startCamera() {
    setMode("camera");
    setIsScanning(true);
    try {
      const deviceList = await Html5Qrcode.getCameras();
      setCameras(deviceList);
      if (deviceList.length === 0) {
        toast({ variant: "destructive", title: "Kamera tidak tersedia", description: "Pastikan izin kamera sudah diberikan." });
        setMode("idle");
        setIsScanning(false);
        return;
      }
      const scanner = new Html5Qrcode(scannerDivId);
      scannerRef.current = scanner;
      const cameraId = deviceList[deviceList.length - 1].id;
      await scanner.start(
        cameraId,
        { fps: 10, qrbox: { width: 250, height: 120 } },
        handleScanSuccess,
        undefined
      );
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal akses kamera", description: err?.message || "Izinkan akses kamera di browser." });
      setMode("idle");
      setIsScanning(false);
    }
  }

  async function stopCamera() {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {}
      scannerRef.current = null;
    }
    setIsScanning(false);
  }

  useEffect(() => {
    return () => { stopCamera(); };
  }, []);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const scanner = new Html5Qrcode("html5-qr-file-scanner");
    scanner.scanFile(file, false)
      .then((code) => {
        handleScanSuccess(code);
        scanner.clear();
      })
      .catch(() => {
        toast({ variant: "destructive", title: "Gagal membaca barcode", description: "Pastikan gambar berisi barcode yang jelas." });
        scanner.clear();
      });
  }

  function reset() {
    setMode("idle");
    setScannedCode("");
    setFoundPackage(null);
  }

  const statusColor: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    transit: "bg-blue-100 text-blue-800",
    arrived: "bg-green-100 text-green-800",
    picked_up: "bg-gray-100 text-gray-700",
    returned: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ScanLine className="h-7 w-7 text-primary" />
          Scan Barcode
        </h1>
        <p className="text-muted-foreground mt-1">Scan atau upload gambar barcode paket untuk melihat detailnya.</p>
      </div>

      {/* Hidden divs for scanner */}
      <div id={scannerDivId} className={mode === "camera" ? "w-full rounded-xl overflow-hidden border" : "hidden"} />
      <div id="html5-qr-file-scanner" className="hidden" />

      {mode === "idle" && (
        <div className="grid sm:grid-cols-2 gap-4">
          <Card
            className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all group"
            onClick={startCamera}
          >
            <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Camera className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-base">Scan dengan Kamera</p>
                <p className="text-sm text-muted-foreground mt-1">Gunakan kamera perangkat untuk scan barcode secara langsung</p>
              </div>
              <Button className="mt-2">Buka Kamera</Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg hover:border-primary/50 transition-all group">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center group-hover:bg-secondary/20 transition-colors">
                <Upload className="w-8 h-8 text-secondary" />
              </div>
              <div>
                <p className="font-semibold text-base">Upload Gambar Barcode</p>
                <p className="text-sm text-muted-foreground mt-1">Upload foto barcode dari galeri atau file perangkat</p>
              </div>
              <label className="cursor-pointer">
                <Button className="mt-2 bg-secondary hover:bg-secondary/90 pointer-events-none">
                  Pilih Gambar
                </Button>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </label>
            </CardContent>
          </Card>
        </div>
      )}

      {mode === "camera" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Kamera Aktif
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => { stopCamera(); setMode("idle"); }}>
              <X className="w-4 h-4 mr-1" /> Tutup Kamera
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center">Arahkan kamera ke barcode paket...</p>
          </CardContent>
        </Card>
      )}

      {mode === "result" && (
        <div className="space-y-4">
          <Card className={foundPackage ? "border-green-400" : "border-red-400"}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                {foundPackage ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                )}
                {foundPackage ? "Paket Ditemukan" : "Paket Tidak Ditemukan"}
              </CardTitle>
              <CardDescription>Kode dipindai: <span className="font-mono font-medium text-foreground">{scannedCode}</span></CardDescription>
            </CardHeader>
            {foundPackage && (
              <CardContent>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase">No Resi</p>
                    <p className="font-semibold">{foundPackage.resiNumber || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase">No Paket</p>
                    <p className="font-semibold">{foundPackage.packageNumber || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Customer</p>
                    <p className="font-semibold">{foundPackage.customerName || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Status</p>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[foundPackage.status] || "bg-gray-100 text-gray-700"}`}>
                      {foundPackage.status || "pending"}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Total Berat</p>
                    <p className="font-semibold">{foundPackage.usedWeight ? `${foundPackage.usedWeight} Kg` : "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Total Ongkir</p>
                    <p className="font-semibold">
                      {foundPackage.totalShipping
                        ? `Rp ${Number(foundPackage.totalShipping).toLocaleString("id-ID")}`
                        : "-"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="outline" onClick={() => setLocation(`/admin/packages/${foundPackage.id}`)}>
                    Lihat Detail
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={reset}>
              Scan Lagi
            </Button>
            <label className="flex-1 cursor-pointer">
              <Button variant="outline" className="w-full pointer-events-none">
                <Upload className="w-4 h-4 mr-2" /> Upload Gambar
              </Button>
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
