import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Calculator, Camera, X, Hash, Trash2, ScanLine, CheckCircle2,
  ShoppingCart, Upload, RotateCcw,
} from "lucide-react";

function formatRp(n: number | string | null | undefined) {
  if (n == null || n === "") return "Rp 0";
  return `Rp ${Number(n).toLocaleString("id-ID")}`;
}

interface ScannedItem {
  id: number;
  barcode: string;
  resiNumber: string;
  customerName: string;
  serviceType: string;
  totalShipping: number;
  packageNumber?: string;
}

export default function KalkulatorScan() {
  const { toast } = useToast();

  const [scanMode, setScanMode] = useState<"idle" | "camera">("idle");
  const [manualInput, setManualInput] = useState("");
  const [isLooking, setIsLooking] = useState(false);
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [showPayModal, setShowPayModal] = useState(false);
  const [uangDibayar, setUangDibayar] = useState("");
  const [lastScanCode, setLastScanCode] = useState("");

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const manualRef = useRef<HTMLInputElement>(null);
  const SCANNER_ID = "kalkulator-qr-scanner";

  const totalTagihan = items.reduce((s, i) => s + i.totalShipping, 0);
  const uangNum = Number(uangDibayar.replace(/\D/g, "")) || 0;
  const kembalian = uangNum - totalTagihan;

  async function lookupAndAdd(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    setIsLooking(true);
    setLastScanCode(trimmed);
    try {
      const token = localStorage.getItem("jaj_token");
      let pkg: any = null;

      const r = await fetch(`/api/packages/scan/${encodeURIComponent(trimmed)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      if (data.package) {
        pkg = data.package;
      } else {
        const r2 = await fetch(`/api/packages?search=${encodeURIComponent(trimmed)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const list = await r2.json();
        if (Array.isArray(list) && list.length > 0) pkg = list[0];
      }

      if (!pkg) {
        toast({ variant: "destructive", title: "Paket tidak ditemukan", description: `Barcode: ${trimmed}` });
        return;
      }

      const alreadyAdded = items.some((i) => i.id === pkg.id);
      if (alreadyAdded) {
        toast({ title: "Sudah ditambahkan", description: `${pkg.resiNumber || pkg.barcode} sudah ada dalam daftar.` });
        return;
      }

      const newItem: ScannedItem = {
        id: pkg.id,
        barcode: pkg.barcode || "",
        resiNumber: pkg.resiNumber || "",
        customerName: pkg.customerName || "-",
        serviceType: pkg.serviceType || "",
        totalShipping: Number(pkg.totalShipping ?? 0),
        packageNumber: pkg.packageNumber || "",
      };
      setItems((prev) => [...prev, newItem]);
      toast({
        title: "✓ Paket ditambahkan",
        description: `${pkg.customerName} — ${formatRp(pkg.totalShipping)}`,
      });
    } catch {
      toast({ variant: "destructive", title: "Gagal mencari paket" });
    } finally {
      setIsLooking(false);
    }
  }

  const handleScanSuccess = useCallback(async (code: string) => {
    await lookupAndAdd(code);
  }, [items]);

  async function startCamera() {
    setScanMode("camera");
    try {
      const devices = await Html5Qrcode.getCameras();
      if (!devices.length) {
        toast({ variant: "destructive", title: "Kamera tidak tersedia" });
        setScanMode("idle");
        return;
      }
      const scanner = new Html5Qrcode(SCANNER_ID);
      scannerRef.current = scanner;
      await scanner.start(
        devices[devices.length - 1].id,
        { fps: 10, qrbox: { width: 260, height: 120 } },
        handleScanSuccess,
        undefined
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
    const tempId = "kalkulator-qr-temp-" + Date.now();
    const tempDiv = document.createElement("div");
    tempDiv.id = tempId;
    tempDiv.style.display = "none";
    document.body.appendChild(tempDiv);
    const scanner = new Html5Qrcode(tempId);
    scanner.scanFile(file, false)
      .then(async (code) => {
        scanner.clear();
        document.body.removeChild(tempDiv);
        await lookupAndAdd(code);
      })
      .catch(() => {
        scanner.clear();
        document.body.removeChild(tempDiv);
        toast({ variant: "destructive", title: "Gagal membaca barcode" });
      });
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manualInput.trim()) return;
    const val = manualInput.trim();
    setManualInput("");
    await lookupAndAdd(val);
    manualRef.current?.focus();
  }

  function removeItem(id: number) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function resetAll() {
    setItems([]);
    setManualInput("");
    setUangDibayar("");
    setLastScanCode("");
    stopCamera();
  }

  function openPayModal() {
    setUangDibayar("");
    setShowPayModal(true);
  }

  function handleUangInput(val: string) {
    const digits = val.replace(/\D/g, "");
    setUangDibayar(digits ? Number(digits).toLocaleString("id-ID") : "");
  }

  const quickAmounts = [
    50000, 100000, 150000, 200000, 300000, 500000, 1000000,
  ].filter((a) => a >= totalTagihan - 10000);

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Calculator className="h-7 w-7 text-primary" /> Kalkulator Scan
          </h1>
          <p className="text-muted-foreground mt-1">
            Scan barcode paket satu per satu, lalu tekan Selesai untuk kalkulasi pembayaran.
          </p>
        </div>
        {items.length > 0 && (
          <Button variant="ghost" size="sm" onClick={resetAll} className="text-muted-foreground shrink-0">
            <RotateCcw className="h-4 w-4 mr-1" /> Reset
          </Button>
        )}
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        {/* LEFT: Scan controls */}
        <div className="lg:col-span-2 space-y-4">
          {/* Camera scanner area */}
          <div
            id={SCANNER_ID}
            className={scanMode === "camera" ? "w-full rounded-xl overflow-hidden border shadow-sm" : "hidden"}
          />

          {/* Camera toggle */}
          {scanMode === "idle" ? (
            <Card
              className="cursor-pointer hover:shadow-md hover:border-primary/40 transition-all"
              onClick={startCamera}
            >
              <CardContent className="flex items-center gap-3 py-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Camera className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">Scan Kamera</p>
                  <p className="text-xs text-muted-foreground">Terus scan tanpa berhenti</p>
                </div>
                <Button size="sm">Buka</Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-primary/50">
              <CardContent className="flex items-center gap-3 py-4">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Camera className="w-5 h-5 text-primary animate-pulse" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-primary">Kamera Aktif</p>
                  <p className="text-xs text-muted-foreground">Arahkan ke barcode...</p>
                </div>
                <Button size="sm" variant="outline" onClick={stopCamera}>
                  <X className="w-3 h-3 mr-1" /> Tutup
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Upload image */}
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                <Upload className="w-5 h-5 text-secondary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">Upload Gambar</p>
                <p className="text-xs text-muted-foreground">Foto barcode dari galeri</p>
              </div>
              <Button size="sm" className="bg-secondary hover:bg-secondary/90" onClick={() => fileInputRef.current?.click()}>
                Pilih
              </Button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </CardContent>
          </Card>

          {/* Manual input */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Hash className="h-4 w-4" /> Input Manual
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <form onSubmit={handleManualSubmit} className="flex gap-2">
                <Input
                  ref={manualRef}
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="No resi / barcode..."
                  className="font-mono text-sm"
                  disabled={isLooking}
                />
                <Button type="submit" size="sm" disabled={!manualInput.trim() || isLooking}>
                  {isLooking ? "..." : "Tambah"}
                </Button>
              </form>
              {lastScanCode && (
                <p className="text-xs text-muted-foreground mt-2 font-mono truncate">
                  Terakhir: {lastScanCode}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Items list + total */}
        <div className="lg:col-span-3 space-y-4">
          {/* Running total bar */}
          <Card className={`border-2 ${items.length > 0 ? "border-primary/40 bg-primary/5" : "border-dashed"}`}>
            <CardContent className="py-4 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Total Tagihan</p>
                  <p className="text-3xl font-black text-primary mt-0.5">{formatRp(totalTagihan)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {items.length} paket discan
                  </p>
                </div>
                <div className="text-right">
                  {isLooking && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                      Mencari...
                    </div>
                  )}
                  <Button
                    size="lg"
                    className="bg-green-600 hover:bg-green-700 gap-2 text-base font-bold"
                    disabled={items.length === 0}
                    onClick={openPayModal}
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    Selesai Scan
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Scanned items list */}
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border-2 border-dashed rounded-xl">
              <ShoppingCart className="h-12 w-12 mb-3 opacity-20" />
              <p className="font-medium">Belum ada paket discan</p>
              <p className="text-sm mt-1">Scan barcode untuk menambahkan paket</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item, idx) => (
                <Card key={item.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm truncate">{item.customerName}</p>
                          {item.serviceType && (
                            <Badge variant="outline" className="text-xs capitalize shrink-0">
                              {item.serviceType.replace("jastip ", "")}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                          {item.resiNumber || item.barcode}
                          {item.packageNumber ? ` · #${item.packageNumber}` : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-primary text-sm">{formatRp(item.totalShipping)}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground hover:text-destructive h-7 w-7"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Bottom total row */}
              <div className="flex items-center justify-between px-4 py-2 bg-muted/50 rounded-lg border">
                <span className="text-sm font-semibold text-muted-foreground">{items.length} paket</span>
                <span className="font-black text-primary">{formatRp(totalTagihan)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      <Dialog open={showPayModal} onOpenChange={setShowPayModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Calculator className="h-5 w-5 text-primary" /> Pembayaran
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Bill summary */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Jumlah Paket</span>
                <span className="font-semibold text-foreground">{items.length} paket</span>
              </div>
              {items.map((item) => (
                <div key={item.id} className="flex justify-between text-xs text-muted-foreground">
                  <span className="truncate max-w-[180px]">{item.customerName} ({item.resiNumber || item.barcode})</span>
                  <span className="shrink-0 ml-2">{formatRp(item.totalShipping)}</span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between items-center">
                <span className="font-bold text-base">Total Tagihan</span>
                <span className="font-black text-xl text-primary">{formatRp(totalTagihan)}</span>
              </div>
            </div>

            {/* Quick amounts */}
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-medium">Nominal Cepat</p>
              <div className="flex flex-wrap gap-1.5">
                {quickAmounts.slice(0, 6).map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    className="text-xs px-2.5 py-1 rounded-md border hover:bg-primary hover:text-white hover:border-primary transition-colors font-medium"
                    onClick={() => setUangDibayar(amt.toLocaleString("id-ID"))}
                  >
                    {formatRp(amt)}
                  </button>
                ))}
                <button
                  type="button"
                  className="text-xs px-2.5 py-1 rounded-md border hover:bg-primary hover:text-white hover:border-primary transition-colors font-medium"
                  onClick={() => setUangDibayar(totalTagihan.toLocaleString("id-ID"))}
                >
                  Pas
                </button>
              </div>
            </div>

            {/* Uang diterima */}
            <div>
              <label className="text-sm font-semibold block mb-1.5">Uang Diterima dari Customer</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">Rp</span>
                <Input
                  className="pl-9 text-lg font-bold"
                  placeholder="0"
                  value={uangDibayar}
                  onChange={(e) => handleUangInput(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            {/* Kembalian */}
            <div className={`rounded-xl p-4 border-2 ${
              uangNum === 0
                ? "border-dashed bg-muted/30"
                : kembalian >= 0
                  ? "border-green-400 bg-green-50"
                  : "border-red-400 bg-red-50"
            }`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Kembalian</p>
              {uangNum === 0 ? (
                <p className="text-2xl font-black text-muted-foreground">—</p>
              ) : kembalian >= 0 ? (
                <p className="text-2xl font-black text-green-700">{formatRp(kembalian)}</p>
              ) : (
                <div>
                  <p className="text-2xl font-black text-red-600">{formatRp(kembalian)}</p>
                  <p className="text-xs text-red-500 mt-1">Uang kurang {formatRp(Math.abs(kembalian))}</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPayModal(false)}>Batal</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 flex-1 gap-2"
              disabled={uangNum < totalTagihan}
              onClick={() => {
                setShowPayModal(false);
                toast({ title: "✓ Pembayaran Selesai", description: `Kembalian: ${formatRp(kembalian)}` });
                resetAll();
              }}
            >
              <CheckCircle2 className="h-4 w-4" /> Konfirmasi Bayar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
