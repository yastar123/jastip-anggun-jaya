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
  Camera, Upload, ScanLine, X, Hash, Trash2, CheckCircle2,
  ShoppingCart, RotateCcw, Banknote, CreditCard, Clock, ChevronDown, ChevronUp,
  AlertTriangle, Users,
} from "lucide-react";

function formatRp(n: number | string | null | undefined) {
  if (n == null || n === "") return "Rp 0";
  return `Rp ${Number(n).toLocaleString("id-ID")}`;
}
function formatDate(d: string | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const serviceLabel: Record<string, string> = {
  "jastip pesawat": "Jastip Pesawat",
  "jastip hemat+": "Jastip Hemat+",
  "jastip kargo": "Jastip Kargo",
  "jastip pelni": "Jastip Pelni",
};

interface ScannedItem {
  id: number;
  barcode: string;
  resiNumber: string;
  packageNumber?: string;
  customerName: string;
  serviceType: string;
  deliveryRoute?: string;
  packagingType?: string;
  itemName?: string;
  adminName?: string;
  packageDate?: string;
  realWeight?: number | null;
  volumeWeight?: number | null;
  usedWeight?: number | null;
  shippingRate?: number | null;
  totalShipping: number;
  length?: number | null;
  width?: number | null;
  height?: number | null;
}

type PaymentType = "tunai" | "transfer" | "piutang";

const PAYMENT_TYPES: { value: PaymentType; label: string; icon: any; desc: string; color: string }[] = [
  { value: "tunai", label: "Tunai", icon: Banknote, desc: "Bayar cash langsung", color: "green" },
  { value: "transfer", label: "Transfer", icon: CreditCard, desc: "Transfer bank / QRIS", color: "blue" },
  { value: "piutang", label: "Piutang", icon: Clock, desc: "Bayar nanti / hutang", color: "orange" },
];

function toItem(pkg: any): ScannedItem {
  return {
    id: pkg.id,
    barcode: pkg.barcode || "",
    resiNumber: pkg.resiNumber || "",
    packageNumber: pkg.packageNumber || "",
    customerName: pkg.customerName || "-",
    serviceType: pkg.serviceType || "",
    deliveryRoute: pkg.deliveryRoute || "",
    packagingType: pkg.packagingType || "",
    itemName: pkg.itemName || "",
    adminName: pkg.adminName || "",
    packageDate: pkg.packageDate || "",
    realWeight: pkg.realWeight != null ? Number(pkg.realWeight) : null,
    volumeWeight: pkg.volumeWeight != null ? Number(pkg.volumeWeight) : null,
    usedWeight: pkg.usedWeight != null ? Number(pkg.usedWeight) : null,
    shippingRate: pkg.shippingRate != null ? Number(pkg.shippingRate) : null,
    totalShipping: Number(pkg.totalShipping ?? 0),
    length: pkg.length != null ? Number(pkg.length) : null,
    width: pkg.width != null ? Number(pkg.width) : null,
    height: pkg.height != null ? Number(pkg.height) : null,
  };
}

export default function AdminScan() {
  const { toast } = useToast();

  const [scanMode, setScanMode] = useState<"idle" | "camera">("idle");
  const [manualInput, setManualInput] = useState("");
  const [isLooking, setIsLooking] = useState(false);
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [alreadyDelivered, setAlreadyDelivered] = useState<any>(null);

  const [showPayModal, setShowPayModal] = useState(false);
  const [uangDibayar, setUangDibayar] = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType>("tunai");
  const [isSaving, setIsSaving] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const manualRef = useRef<HTMLInputElement>(null);
  // ── Anti-spam refs ───────────────────────────────────────────────────────
  // lastScannedCodeRef: kode terakhir yang berhasil diproses.
  //   Selama kamera masih mengarah ke barcode yang sama, kode ini tidak berubah
  //   sehingga scan berikutnya langsung diabaikan — TANPA batas waktu.
  //   Hanya di-reset saat kamera dimatikan, atau ketika kode berbeda terdeteksi,
  //   atau ketika lookup gagal (agar user bisa coba ulang).
  const lastScannedCodeRef = useRef<string>("");
  // isScanProcessingRef: lock saat lookupAndAdd sedang berjalan (async).
  //   Mencegah callback kamera yang datang berturut-turut masuk bersamaan.
  const isScanProcessingRef = useRef<boolean>(false);
  // itemsRef: bayangan items state yang selalu up-to-date.
  //   Digunakan oleh handleScanSuccess (stable callback) agar bisa cek daftar
  //   terbaru tanpa terjebak stale closure.
  const itemsRef = useRef<ScannedItem[]>([]);
  // addedIdsRef: set ID paket yang sudah diklaim (ditambahkan atau sedang diproses).
  //   Di-update sinkron sebelum setItems → tidak ada race condition antar
  //   concurrent lookupAndAdd calls, bahkan kalau itemsRef belum di-sync.
  const addedIdsRef = useRef<Set<number>>(new Set());
  // ─────────────────────────────────────────────────────────────────────────
  const SCANNER_ID = "admin-scan-pos-scanner";

  // Sync itemsRef setiap kali items berubah agar callback scanner (stable) bisa cek data terbaru
  useEffect(() => { itemsRef.current = items; }, [items]);

  const totalTagihan = items.reduce((s, i) => s + i.totalShipping, 0);
  const uangNum = Number(uangDibayar.replace(/\D/g, "")) || 0;
  const kembalian = uangNum - totalTagihan;

  async function fetchJson(url: string) {
    const token = localStorage.getItem("jaj_token");
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    return r.json();
  }

  // Mengembalikan true = boleh coba lagi dengan kode yang sama (tidak ditemukan / error)
  //               false = lock tetap terpasang (berhasil / sudah ada / sudah diserahkan)
  async function lookupAndAdd(code: string): Promise<boolean> {
    const trimmed = code.trim();
    if (!trimmed) return true;
    setIsLooking(true);
    setAlreadyDelivered(null);
    try {
      let pkg: any = null;
      const data = await fetchJson(`/api/packages/scan/${encodeURIComponent(trimmed)}`);
      if (data.package) {
        pkg = data.package;
      } else {
        const list = await fetchJson(`/api/packages?search=${encodeURIComponent(trimmed)}`);
        if (Array.isArray(list) && list.length > 0) pkg = list[0];
      }

      if (!pkg) {
        toast({ variant: "destructive", title: "Paket tidak ditemukan", description: `Barcode: ${trimmed}` });
        return true; // unlock → user boleh coba scan ulang barcode yang sama
      }

      if (pkg.status === "diserahkan") {
        setAlreadyDelivered(pkg);
        toast({ title: "Sudah diserahkan sebelumnya", description: `${pkg.customerName} — ${pkg.resiNumber || pkg.barcode}` });
        return false; // tetap lock → tampilkan warning, jangan proses ulang
      }

      // Gunakan itemsRef (bukan state items) agar tidak terjebak stale closure
      // Deduplikasi atomik: cek & klaim ID secara sinkron via addedIdsRef.
      // addedIdsRef di-update SEBELUM await apapun, sehingga dua concurrent
      // lookupAndAdd calls tidak bisa sama-sama lolos — yang kedua akan melihat
      // ID sudah diklaim meski itemsRef belum di-sync ke state terbaru.
      if (addedIdsRef.current.has(pkg.id)) {
        toast({ title: "Sudah ditambahkan", description: `${pkg.resiNumber || pkg.barcode} sudah ada dalam daftar.` });
        return false; // tetap lock
      }
      addedIdsRef.current.add(pkg.id); // klaim ID — sinkron, tidak ada race

      const newItem = toItem(pkg);
      setItems((prev) => [...prev, newItem]);
      toast({
        title: "✓ Paket ditambahkan",
        description: `${pkg.customerName} — ${formatRp(newItem.totalShipping)}`,
      });
      return false; // tetap lock → sukses, jangan proses lagi selama kamera di sini
    } catch {
      toast({ variant: "destructive", title: "Gagal mencari paket" });
      return true; // unlock → biarkan coba ulang bila ini error sementara
    } finally {
      setIsLooking(false);
    }
  }

  const handleScanSuccess = useCallback(async (code: string) => {
    // ① Kode yang sama masih terbaca kamera → abaikan sepenuhnya (tidak ada batas waktu).
    //   Lock hanya dibuka bila kamera berpindah ke barcode berbeda, kamera dimatikan,
    //   atau bila lookup sebelumnya gagal (tidak ditemukan / error).
    if (code === lastScannedCodeRef.current) return;

    // ② lookupAndAdd sebelumnya masih berjalan (async) → abaikan callback masuk berikutnya.
    if (isScanProcessingRef.current) return;

    // Pasang lock segera sebelum operasi async
    isScanProcessingRef.current = true;
    lastScannedCodeRef.current = code;

    try {
      const allowRetry = await lookupAndAdd(code);
      if (allowRetry) {
        // Barcode tidak ditemukan atau error → hapus lock agar user bisa coba lagi
        lastScannedCodeRef.current = "";
      }
    } finally {
      // Pastikan processing lock SELALU dibuka, bahkan bila terjadi error tak terduga
      isScanProcessingRef.current = false;
    }
  }, []); // deps kosong: semua akses lewat ref / setState (stable), tidak ada stale closure

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
        { fps: 10, qrbox: { width: 220, height: 220 } },
        handleScanSuccess,
        undefined,
      );
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal akses kamera", description: err?.message });
      setScanMode("idle");
    }
  }

  function resetScanDebounce() {
    lastScannedCodeRef.current = "";
    isScanProcessingRef.current = false;
  }

  async function stopCamera() {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
      scannerRef.current = null;
    }
    resetScanDebounce();
    setScanMode("idle");
  }

  useEffect(() => () => { stopCamera(); }, []);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const tempId = "admin-scan-qr-temp-" + Date.now();
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
        toast({ variant: "destructive", title: "Gagal membaca barcode", description: "Pastikan gambar berisi barcode yang jelas." });
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
    setExpandedIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
    addedIdsRef.current.delete(id); // hapus klaim agar bisa scan ulang paket ini
  }

  function toggleExpand(id: number) {
    setExpandedIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }

  function resetAll() {
    setItems([]);
    setExpandedIds(new Set());
    setManualInput("");
    setUangDibayar("");
    setPaymentType("tunai");
    setAlreadyDelivered(null);
    addedIdsRef.current.clear(); // bersihkan semua klaim ID
    stopCamera();
  }

  function openPayModal() {
    setUangDibayar("");
    setPaymentType("tunai");
    setShowPayModal(true);
  }

  function handleUangInput(val: string) {
    const digits = val.replace(/\D/g, "");
    setUangDibayar(digits ? Number(digits).toLocaleString("id-ID") : "");
  }

  // Fungsi tolak sengaja dihapus — setelah SUDAH_DIAMBIL, status terkunci permanen (spec §4.2)

  async function handleKonfirmasiBayar() {
    setIsSaving(true);
    try {
      const token = localStorage.getItem("jaj_token");
      const body = {
        paymentType,
        totalAmount: totalTagihan,
        paidAmount: (paymentType === "tunai" || paymentType === "transfer") ? uangNum : null,
        changeAmount: (paymentType === "tunai" || paymentType === "transfer") ? kembalian : null,
        packageIds: items.map((i) => i.id),
        packageSummary: items.map((i) => ({
          id: i.id,
          resiNumber: i.resiNumber,
          packageNumber: i.packageNumber,
          customerName: i.customerName,
          serviceType: i.serviceType,
          deliveryRoute: i.deliveryRoute,
          packagingType: i.packagingType,
          realWeight: i.realWeight,
          usedWeight: i.usedWeight,
          totalShipping: i.totalShipping,
          packageDate: i.packageDate,
        })),
      };

      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Gagal menyimpan pembayaran");

      // Tandai semua paket sebagai diserahkan setelah pembayaran tercatat
      const results = await Promise.allSettled(
        items.map((i) =>
          fetch(`/api/packages/${i.id}/serahkan`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          }),
        ),
      );
      const failedCount = results.filter((r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok)).length;

      const typeLabel = PAYMENT_TYPES.find((t) => t.value === paymentType)?.label || paymentType;
      toast({
        title: "✓ Pembayaran & Serah Terima Selesai",
        description: `${typeLabel} — ${formatRp(totalTagihan)}${(paymentType === "tunai" || paymentType === "transfer") ? ` | Kembalian: ${formatRp(kembalian)}` : ""}${failedCount > 0 ? ` (${failedCount} paket gagal diupdate statusnya)` : ""}`,
      });
      setShowPayModal(false);
      resetAll();
    } catch {
      toast({ variant: "destructive", title: "Gagal menyimpan pembayaran", description: "Coba lagi." });
    } finally {
      setIsSaving(false);
    }
  }

  const canConfirm =
    paymentType === "piutang" ||
    ((paymentType === "tunai" || paymentType === "transfer") && uangNum >= totalTagihan);

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ScanLine className="h-7 w-7 text-primary" /> Scan Barcode dan Pembayaran
          </h1>
          <p className="text-muted-foreground mt-1">
            Scan barcode paket satu per satu (seperti kasir minimarket), lalu selesaikan pembayaran &amp; serah terima sekaligus.
          </p>
        </div>
        {items.length > 0 && (
          <Button variant="ghost" size="sm" onClick={resetAll} className="text-muted-foreground shrink-0">
            <RotateCcw className="h-4 w-4 mr-1" /> Reset
          </Button>
        )}
      </div>

      {alreadyDelivered && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-amber-900">
                Paket sudah diserahkan &amp; dikunci permanen
              </p>
              <p className="text-xs text-amber-700 truncate">
                {alreadyDelivered.customerName} — {alreadyDelivered.resiNumber || alreadyDelivered.barcode}
                {alreadyDelivered.pickedUpAt ? ` · Diserahkan: ${formatDate(alreadyDelivered.pickedUpAt)}` : ""}
              </p>
              <p className="text-xs text-amber-600 mt-0.5">Status tidak dapat diubah kembali.</p>
            </div>
            <Button size="icon" variant="ghost" className="shrink-0" onClick={() => setAlreadyDelivered(null)}>
              <X className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-5 gap-5">
        {/* LEFT: Scan controls */}
        <div className="lg:col-span-2 space-y-4">
          <div
            id={SCANNER_ID}
            className={scanMode === "camera" ? "w-full rounded-xl overflow-hidden border shadow-sm" : "hidden"}
          />

          {scanMode === "idle" ? (
            <Card className="cursor-pointer hover:shadow-md hover:border-primary/40 transition-all" onClick={startCamera}>
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
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Items list + total */}
        <div className="lg:col-span-3 space-y-4">
          <Card className={`border-2 ${items.length > 0 ? "border-primary/40 bg-primary/5" : "border-dashed"}`}>
            <CardContent className="py-4 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Total Tagihan</p>
                  <p className="text-3xl font-black text-primary mt-0.5">{formatRp(totalTagihan)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{items.length} paket discan</p>
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
                    Bayar &amp; Serahkan
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border-2 border-dashed rounded-xl">
              <ShoppingCart className="h-12 w-12 mb-3 opacity-20" />
              <p className="font-medium">Belum ada paket discan</p>
              <p className="text-sm mt-1">Scan barcode untuk menambahkan paket</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item, idx) => {
                const isExpanded = expandedIds.has(item.id);
                return (
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
                                {serviceLabel[item.serviceType]?.replace("Jastip ", "") || item.serviceType.replace("jastip ", "")}
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
                          className="shrink-0 text-muted-foreground h-7 w-7"
                          onClick={() => toggleExpand(item.id)}
                          title="Lihat detail"
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-muted-foreground hover:text-destructive h-7 w-7"
                          onClick={() => removeItem(item.id)}
                          title="Hapus dari daftar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {isExpanded && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-xs border-t mt-3 pt-3">
                          <div>
                            <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Tanggal</p>
                            <p>{item.packageDate ? new Date(item.packageDate).toLocaleDateString("id-ID") : "-"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Admin Input</p>
                            <p>{item.adminName || "-"}</p>
                          </div>
                          <div className="md:col-span-2">
                            <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Rute Pengiriman</p>
                            <p>{item.deliveryRoute || "-"}</p>
                          </div>
                          {item.itemName && (
                            <div>
                              <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Nama Barang</p>
                              <p>{item.itemName}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Berat Real</p>
                            <p className="font-semibold">{item.realWeight != null ? `${item.realWeight} Kg` : "-"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Berat Volume</p>
                            <p>{item.volumeWeight != null ? `${item.volumeWeight} Kg` : "-"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Berat Digunakan</p>
                            <p className="font-semibold">{item.usedWeight != null ? `${item.usedWeight} Kg` : "-"}</p>
                          </div>
                          {(item.length || item.width || item.height) && (
                            <div>
                              <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Dimensi (cm)</p>
                              <p className="font-mono">{item.length || "?"} × {item.width || "?"} × {item.height || "?"}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Tarif Ongkir/kg</p>
                            <p>{formatRp(item.shippingRate)}</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              <div className="flex items-center justify-between px-4 py-2 bg-muted/50 rounded-lg border">
                <span className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> {items.length} paket
                </span>
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
              <ScanLine className="h-5 w-5 text-primary" /> Pembayaran &amp; Serah Terima
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

            {/* Payment type */}
            <div>
              <p className="text-sm font-semibold mb-2">Jenis Pembayaran</p>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_TYPES.map((pt) => {
                  const Icon = pt.icon;
                  const isSelected = paymentType === pt.value;
                  const colorMap: Record<string, string> = {
                    green: isSelected ? "border-green-500 bg-green-50 text-green-700" : "hover:border-green-300",
                    blue: isSelected ? "border-blue-500 bg-blue-50 text-blue-700" : "hover:border-blue-300",
                    orange: isSelected ? "border-orange-500 bg-orange-50 text-orange-700" : "hover:border-orange-300",
                  };
                  return (
                    <button
                      key={pt.value}
                      type="button"
                      onClick={() => setPaymentType(pt.value)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${colorMap[pt.color]} ${!isSelected ? "border-muted" : ""}`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-xs font-bold">{pt.label}</span>
                      <span className="text-[10px] text-muted-foreground leading-tight">{pt.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {(paymentType === "tunai" || paymentType === "transfer") && (
              <>
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

                <div className={`rounded-xl p-4 border-2 ${
                  uangNum === 0 ? "border-dashed bg-muted/30"
                    : kembalian >= 0 ? "border-green-400 bg-green-50"
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
              </>
            )}

            {paymentType === "piutang" && (
              <div className="rounded-xl p-4 border-2 border-orange-200 bg-orange-50 text-orange-800 text-sm text-center">
                <Clock className="w-6 h-6 mx-auto mb-1" />
                <p className="font-semibold">Piutang / Bayar Nanti</p>
                <p className="text-xs text-orange-600 mt-1">Tercatat sebagai hutang customer. Paket tetap diserahkan sekarang.</p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPayModal(false)} disabled={isSaving}>Batal</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 flex-1 gap-2"
              disabled={!canConfirm || isSaving}
              onClick={handleKonfirmasiBayar}
            >
              {isSaving ? (
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Konfirmasi Bayar &amp; Serahkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
