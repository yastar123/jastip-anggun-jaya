import { useEffect, useRef, useState } from "react";
import { useListPackages, useListBatches } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Printer, Ship, CheckCircle2, Lock, Archive,
  QrCode, Search, Clock, Package, Eye,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Pagination } from "@/components/pagination";

const PAGE_SIZE = 15;

// ── helpers ───────────────────────────────────────────────────────────────────

function formatRp(n: any) {
  if (n == null) return "-";
  return `Rp ${Number(n).toLocaleString("id-ID")}`;
}

function fmtDate(d: string) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
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

function paymentBadge(status: string) {
  if (status === "SUDAH_DIBAYAR") return <Badge className="text-xs bg-green-600 text-white">Lunas</Badge>;
  if (status === "DP") return <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300">DP</Badge>;
  return <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-300">Piutang</Badge>;
}

// ── SmallQR / LargeQR ────────────────────────────────────────────────────────

function SmallQR({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvasRef.current && value) {
      QRCode.toCanvas(canvasRef.current, value, { width: 96, margin: 2 }).catch(() => {});
    }
  }, [value]);
  return <canvas ref={canvasRef} className="rounded" />;
}

function LargeQR({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvasRef.current && value) {
      QRCode.toCanvas(canvasRef.current, value, { width: 200, margin: 2 }).catch(() => {});
    }
  }, [value]);
  return <canvas ref={canvasRef} className="rounded" />;
}

// ── DetailRow helper ──────────────────────────────────────────────────────────

function DetailRow({ label, value, mono = false, green = false }: {
  label: string; value: any; mono?: boolean; green?: boolean;
}) {
  if (value == null || value === "" || value === "-") return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className={`text-sm font-semibold ${mono ? "font-mono" : ""} ${green ? "text-green-700" : "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}

// ── ArsipPackageCard ──────────────────────────────────────────────────────────

function ArsipPackageCard({ pkg, batchLabel }: { pkg: any; batchLabel: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const qrValue = pkg.barcode || pkg.resiNumber || String(pkg.id);

  async function printSingle() {
    let qrDataUrl = "";
    try {
      qrDataUrl = await QRCode.toDataURL(qrValue, { width: 400, margin: 3 });
    } catch { return; }
    const pkgDate = pkg.packageDate
      ? new Date(pkg.packageDate).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })
      : "-";
    const svcType = pkg.serviceType ? pkg.serviceType.replace("jastip ", "Jastip ") : "-";
    const ongkir = pkg.totalShipping != null ? "Rp " + Number(pkg.totalShipping).toLocaleString("id-ID") : "-";
    const pickedAt = pkg.pickedUpAt
      ? new Date(pkg.pickedUpAt).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })
      : "-";
    const html = `<!DOCTYPE html>
<html><head>
  <title>Label Arsip - ${pkg.resiNumber || pkg.barcode}</title>
  <style>
    @page { size: 100mm 100mm; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; width: 100mm; height: 100mm; overflow: hidden; background: #fff; }
    .wrap { width: 100mm; height: 100mm; display: flex; flex-direction: column; }
    .header { background: #16a34a; color: #fff; padding: 3mm 4mm 2.5mm; flex-shrink: 0; }
    .h-title { font-size: 13pt; font-weight: 900; letter-spacing: 1px; line-height: 1; }
    .h-sub { font-size: 4.5pt; opacity: 0.9; margin-top: 0.8mm; }
    .body { flex: 1; display: flex; min-height: 0; }
    .left { width: 31mm; border-right: 0.5px solid #ddd; display: flex; flex-direction: column; align-items: center; padding: 3mm 2mm 2mm; flex-shrink: 0; }
    .scan-label { background: #16a34a; color: #fff; font-size: 5.5pt; font-weight: 900; padding: 1mm 2.5mm; border-radius: 2px; letter-spacing: 0.5px; margin-bottom: 2.5mm; }
    .qr-img { width: 23mm; height: 23mm; display: block; }
    .qr-txt { font-size: 3.2pt; color: #888; font-family: monospace; text-align: center; margin-top: 2mm; word-break: break-all; max-width: 27mm; line-height: 1.3; }
    .right { flex: 1; padding: 2.5mm 3mm; overflow: hidden; }
    .cust { font-size: 14pt; font-weight: 900; color: #111; margin-bottom: 2mm; border-bottom: 0.5px solid #eee; padding-bottom: 1.5mm; line-height: 1.1; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm 2.5mm; }
    .field { display: flex; flex-direction: column; gap: 0.3mm; }
    .full { grid-column: 1 / -1; }
    .fl { font-size: 4pt; font-weight: 700; color: #aaa; text-transform: uppercase; letter-spacing: 0.4px; }
    .fv { font-size: 7pt; font-weight: 700; color: #222; line-height: 1.2; }
    .fv.mono { font-family: monospace; font-size: 6.5pt; }
    .fv.green { color: #16a34a; }
    .footer { border-top: 0.5px solid #eee; background: #f9f9f9; padding: 1mm 3mm; font-size: 3.8pt; color: #bbb; text-align: center; flex-shrink: 0; }
  </style>
</head><body>
  <div class="wrap">
    <div class="header">
      <div class="h-title">JASTIP ANGGUN JAYA — ARSIP</div>
      <div class="h-sub">Paket sudah diserahkan ke konsumen · ${batchLabel}</div>
    </div>
    <div class="body">
      <div class="left">
        <div class="scan-label">SCAN RESI</div>
        <img class="qr-img" src="${qrDataUrl}" />
        <div class="qr-txt">${qrValue}</div>
      </div>
      <div class="right">
        <div class="cust">${pkg.customerName || "-"}</div>
        <div class="grid">
          <div class="field"><div class="fl">No. Resi</div><div class="fv mono">${pkg.resiNumber || "-"}</div></div>
          <div class="field"><div class="fl">No. Paket</div><div class="fv mono">${pkg.packageNumber || "-"}</div></div>
          <div class="field"><div class="fl">Tanggal Paket</div><div class="fv">${pkgDate}</div></div>
          <div class="field"><div class="fl">Tanggal Diambil</div><div class="fv green">${pickedAt}</div></div>
          <div class="field"><div class="fl">Jenis Jastip</div><div class="fv">${svcType}</div></div>
          <div class="field"><div class="fl">Berat Digunakan</div><div class="fv">${pkg.usedWeight != null ? pkg.usedWeight + " Kg" : "-"}</div></div>
          <div class="field full"><div class="fl">Total Ongkir</div><div class="fv green">${ongkir}</div></div>
        </div>
      </div>
    </div>
    <div class="footer">Jastip Anggun Jaya · +62 812-4500-8384 · Jln Merpati Sp 4 jlr 8 (Depan SMKN 4), Manokwari</div>
  </div>
  <script>window.onload = () => { window.print(); window.close(); }<\/script>
</body></html>`;
    const win = window.open("", "_blank");
    if (!win) { toast({ variant: "destructive", title: "Popup diblokir", description: "Izinkan popup untuk mencetak." }); return; }
    win.document.write(html);
    win.document.close();
  }

  const svcTypeLabel = pkg.serviceType ? pkg.serviceType.replace("jastip ", "Jastip ") : null;
  const volWeight = (pkg.length && pkg.width && pkg.height)
    ? ((pkg.length * pkg.width * pkg.height) / 6000).toFixed(3)
    : null;

  return (
    <>
      {/* ── Card ── */}
      <Card
        className="hover:shadow-md transition-shadow border-green-200 bg-green-50/20 cursor-pointer"
        onClick={() => setOpen(true)}
      >
        <CardContent className="pt-4 pb-3">
          {/* Top */}
          <div className="flex items-start justify-between mb-2 gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">{pkg.customerName || "-"}</p>
              <p className="font-mono text-xs text-muted-foreground truncate">{pkg.resiNumber || "-"}</p>
              {pkg.serviceType && (
                <p className="text-xs text-muted-foreground capitalize mt-0.5">{pkg.serviceType}</p>
              )}
            </div>
            <Badge className="text-xs shrink-0 bg-green-600 text-white">✓ Diserahkan</Badge>
          </div>

          {/* QR */}
          <div className="flex justify-center bg-white border border-green-100 rounded-lg p-2 mb-2">
            <SmallQR value={qrValue} />
          </div>
          <p className="text-center font-mono text-[10px] text-muted-foreground mb-2 truncate">{qrValue}</p>

          {/* Stats */}
          <div className="space-y-0.5 text-xs text-muted-foreground mb-3">
            {pkg.usedWeight != null && (
              <p>Berat: <span className="font-semibold text-foreground">{pkg.usedWeight} Kg</span></p>
            )}
            {pkg.totalShipping != null && (
              <p className="font-semibold text-green-700">{formatRp(pkg.totalShipping)}</p>
            )}
            {pkg.pickedUpAt && (
              <p>Diambil: <span className="font-medium">{fmtDate(pkg.pickedUpAt)}</span></p>
            )}
            {pkg.statusPembayaran && (
              <div className="mt-1">{paymentBadge(pkg.statusPembayaran)}</div>
            )}
          </div>

          {/* Buttons */}
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              size="sm" variant="outline"
              className="text-xs"
              onClick={(e) => { e.stopPropagation(); setOpen(true); }}
            >
              <Eye className="w-3 h-3 mr-1" /> Lihat Detail
            </Button>
            <Button
              size="sm" variant="outline"
              className="text-xs border-green-300 text-green-700 hover:bg-green-50"
              onClick={(e) => { e.stopPropagation(); printSingle(); }}
            >
              <Printer className="w-3 h-3 mr-1" /> Cetak
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Detail Dialog ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Archive className="w-4 h-4 text-green-600" />
              Detail Paket — Arsip
            </DialogTitle>
          </DialogHeader>

          {/* QR besar + kode */}
          <div className="flex flex-col items-center gap-2 py-3 bg-green-50 border border-green-100 rounded-xl">
            <LargeQR value={qrValue} />
            <p className="font-mono text-xs text-muted-foreground text-center break-all px-4">{qrValue}</p>
            <Badge className="bg-green-600 text-white text-xs">✓ Sudah Diserahkan</Badge>
          </div>

          {/* Data paket */}
          <div className="space-y-4">
            {/* Identitas */}
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 border-b pb-1">Identitas Paket</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <DetailRow label="Nama Penerima" value={pkg.customerName} />
                <DetailRow label="No. Resi" value={pkg.resiNumber} mono />
                <DetailRow label="No. Paket" value={pkg.packageNumber} mono />
                <DetailRow label="Barcode" value={pkg.barcode} mono />
                <DetailRow label="Nama Barang" value={pkg.itemName} />
                <DetailRow label="Tanggal Paket" value={pkg.packageDate ? fmtDate(pkg.packageDate) : null} />
              </div>
            </div>

            {/* Layanan */}
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 border-b pb-1">Layanan &amp; Rute</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <DetailRow label="Jenis Jastip" value={svcTypeLabel} />
                <DetailRow label="Rute Pengiriman" value={pkg.deliveryRoute} />
                <DetailRow label="Jenis Paking" value={pkg.packagingType} />
                <DetailRow label="Batch" value={batchLabel} />
              </div>
            </div>

            {/* Berat & Dimensi */}
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 border-b pb-1">Berat &amp; Dimensi</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <DetailRow label="Berat Real" value={pkg.realWeight != null ? `${pkg.realWeight} Kg` : null} />
                <DetailRow label="Berat Digunakan" value={pkg.usedWeight != null ? `${pkg.usedWeight} Kg` : null} />
                {volWeight && (
                  <DetailRow label="Berat Volume" value={`${volWeight} Kg`} />
                )}
                {(pkg.length || pkg.width || pkg.height) && (
                  <DetailRow
                    label="Dimensi (P×L×T)"
                    value={`${pkg.length ?? "?"} × ${pkg.width ?? "?"} × ${pkg.height ?? "?"} cm`}
                  />
                )}
              </div>
            </div>

            {/* Pembayaran */}
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 border-b pb-1">Pembayaran &amp; Pengambilan</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <DetailRow
                  label="Total Ongkir"
                  value={pkg.totalShipping != null ? formatRp(pkg.totalShipping) : null}
                  green
                />
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Status Pembayaran</span>
                  {pkg.statusPembayaran ? paymentBadge(pkg.statusPembayaran) : <span className="text-sm text-muted-foreground">-</span>}
                </div>
                <DetailRow label="Tanggal Diserahkan" value={pkg.pickedUpAt ? fmtDate(pkg.pickedUpAt) : null} green />
                <DetailRow label="Catatan" value={pkg.notes} />
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex gap-2 pt-2 border-t">
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2"
              onClick={() => { printSingle(); }}
            >
              <Printer className="w-4 h-4" /> Cetak Label
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ArsipBatchDetail({ params }: { params: { id: string } }) {
  const isNoBatch = params?.id === "no-batch";
  const batchId = isNoBatch ? null : Number(params?.id);

  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const base = user?.role === "owner" ? "/owner" : "/admin";

  const [search, setSearch] = useState("");
  const [filterServiceType, setFilterServiceType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("diserahkan"); // "semua" | "diserahkan" | "pending"
  const [page, setPage] = useState(1);
  const [selectedServiceType, setSelectedServiceType] = useState<string | null>(null);

  const { data: batches } = useListBatches();
  const { data: packages, isLoading } = useListPackages();

  const batch = isNoBatch ? null : (batches || []).find((b: any) => b.id === batchId);
  const batchLabel = isNoBatch
    ? "Paket Tanpa Batch"
    : (batch ? (batch.namaKapal || `Batch #${batchId}`) : `Batch #${batchId}`);

  // All packages in this batch
  const allBatchPkgs = (packages || []).filter((p: any) =>
    isNoBatch ? p.batchId == null : p.batchId === batchId
  );

  const diserahkanPkgs = allBatchPkgs.filter(
    (p: any) => p.statusPengambilan === "SUDAH_DIAMBIL" || p.status === "diserahkan"
  );
  const pendingPkgs = allBatchPkgs.filter(
    (p: any) => p.statusPengambilan !== "SUDAH_DIAMBIL" && p.status !== "diserahkan"
  );

  const basePkgs = filterStatus === "diserahkan"
    ? diserahkanPkgs
    : filterStatus === "pending"
      ? pendingPkgs
      : allBatchPkgs;

  const effectiveFilter = selectedServiceType ?? filterServiceType;

  const filtered = basePkgs.filter((p: any) =>
    (effectiveFilter === "all" || (p.serviceType || "").toLowerCase() === effectiveFilter) &&
    (!search ||
      (p.barcode || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.resiNumber || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.packageNumber || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.customerName || "").toLowerCase().includes(search.toLowerCase()))
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const totalOngkir = diserahkanPkgs.reduce((s: number, p: any) => s + Number(p.totalShipping || 0), 0);

  // ── Service type stats ────────────────────────────────────────────────────────
  const SVC_DEFS = [
    { key: "jastip pesawat", label: "Jastip Pesawat", emoji: "✈️", border: "border-blue-200", bg: "bg-blue-50/60", num: "text-blue-700" },
    { key: "jastip hemat+",  label: "Jastip Hemat+",  emoji: "📦", border: "border-emerald-200", bg: "bg-emerald-50/60", num: "text-emerald-700" },
    { key: "jastip kargo",   label: "Jastip Kargo",   emoji: "🚛", border: "border-orange-200", bg: "bg-orange-50/60", num: "text-orange-700" },
    { key: "jastip pelni",   label: "Jastip Pelni",   emoji: "🚢", border: "border-indigo-200", bg: "bg-indigo-50/60", num: "text-indigo-700" },
  ];
  const knownSvcKeys = SVC_DEFS.map(d => d.key);
  const svcStats = [
    ...SVC_DEFS.map(def => {
      const pkgs = allBatchPkgs.filter((p: any) => (p.serviceType || "").toLowerCase() === def.key);
      if (!pkgs.length) return null;
      const dsr = pkgs.filter((p: any) => p.statusPengambilan === "SUDAH_DIAMBIL" || p.status === "diserahkan").length;
      return { ...def, count: pkgs.length, diserahkan: dsr, pending: pkgs.length - dsr, ongkir: pkgs.reduce((s: number, p: any) => s + Number(p.totalShipping || 0), 0) };
    }).filter(Boolean),
    (() => { const pkgs = allBatchPkgs.filter((p: any) => !knownSvcKeys.includes((p.serviceType || "").toLowerCase())); if (!pkgs.length) return null; const dsr = pkgs.filter((p: any) => p.statusPengambilan === "SUDAH_DIAMBIL" || p.status === "diserahkan").length; return { key: "lainnya", label: "Lainnya", emoji: "📋", border: "border-gray-200", bg: "bg-gray-50/60", num: "text-gray-700", count: pkgs.length, diserahkan: dsr, pending: pkgs.length - dsr, ongkir: pkgs.reduce((s: number, p: any) => s + Number(p.totalShipping || 0), 0) }; })(),
  ].filter(Boolean) as { key: string; label: string; emoji: string; border: string; bg: string; num: string; count: number; diserahkan: number; pending: number; ongkir: number }[];
  const selectedSvcLabel = SVC_DEFS.find(d => d.key === selectedServiceType)?.label ?? (selectedServiceType === "lainnya" ? "Lainnya" : "");

  function handleSearch(v: string) { setSearch(v); setPage(1); }
  function handleFilter(v: string) { setFilterServiceType(v); setPage(1); }
  function handleStatus(v: string) { setFilterStatus(v); setPage(1); }

  // Print all diserahkan in this batch
  async function printAll() {
    const pkgs = diserahkanPkgs;
    if (!pkgs.length) return;
    const pages: string[] = [];
    for (const pkg of pkgs) {
      const qrValue = pkg.barcode || pkg.resiNumber || String(pkg.id);
      let qrDataUrl = "";
      try { qrDataUrl = await QRCode.toDataURL(qrValue, { width: 400, margin: 3 }); }
      catch { continue; }
      const pkgDate = pkg.packageDate
        ? new Date(pkg.packageDate).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }) : "-";
      pages.push(`
        <div class="page">
          <div class="label">
            <div class="header">
              <div class="brand-name">JASTIP ANGGUN JAYA — ARSIP</div>
              <div class="brand-sub">Paket sudah diserahkan · ${batchLabel}</div>
            </div>
            <div class="body-wrap">
              <div class="qr-wrap">
                <img src="${qrDataUrl}" alt="QR Code" />
                <div class="qr-label">${qrValue}</div>
              </div>
              <div class="info-section">
                <div class="customer">${pkg.customerName || "-"}</div>
                <div class="batch-tag">📦 ${batchLabel}</div>
                <div class="info-grid">
                  <div class="info-item"><span class="info-label">No. Resi</span><span class="info-value mono">${pkg.resiNumber || "-"}</span></div>
                  <div class="info-item"><span class="info-label">No. Paket</span><span class="info-value mono">${pkg.packageNumber || "-"}</span></div>
                  <div class="info-item"><span class="info-label">Tanggal Paket</span><span class="info-value">${pkgDate}</span></div>
                  <div class="info-item"><span class="info-label">Tanggal Diambil</span><span class="info-value green">${pkg.pickedUpAt ? new Date(pkg.pickedUpAt).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }) : "-"}</span></div>
                  <div class="info-item"><span class="info-label">Jenis Jastip</span><span class="info-value">${pkg.serviceType ? pkg.serviceType.replace("jastip ", "Jastip ") : "-"}</span></div>
                  <div class="info-item"><span class="info-label">Rute</span><span class="info-value">${pkg.deliveryRoute || "-"}</span></div>
                  <div class="info-item"><span class="info-label">Berat Real</span><span class="info-value">${pkg.realWeight != null ? pkg.realWeight + " Kg" : "-"}</span></div>
                  <div class="info-item"><span class="info-label">Berat Digunakan</span><span class="info-value">${pkg.usedWeight != null ? pkg.usedWeight + " Kg" : "-"}</span></div>
                  <div class="info-item"><span class="info-label">Total Ongkir</span><span class="info-value green">${pkg.totalShipping != null ? "Rp " + Number(pkg.totalShipping).toLocaleString("id-ID") : "-"}</span></div>
                </div>
              </div>
            </div>
            <div class="footer">Jastip Anggun Jaya · +62 812-4500-8384 · Jln Merpati Sp 4 jlr 8 (Depan SMKN 4), Manokwari</div>
          </div>
        </div>`);
    }
    if (!pages.length) return;
    const html = `<!DOCTYPE html>
<html><head>
  <title>Arsip — ${batchLabel}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #fff; }
    .page { width: 100%; height: calc(297mm - 24mm); display: flex; align-items: stretch; page-break-after: always; break-after: page; }
    .page:last-child { page-break-after: avoid; break-after: avoid; }
    .label { border: 3px solid #16a34a; border-radius: 10px; width: 100%; display: flex; flex-direction: column; overflow: hidden; }
    .header { background: #16a34a; color: #fff; padding: 14px 20px; }
    .brand-name { font-size: 22px; font-weight: 900; letter-spacing: 2px; }
    .brand-sub { font-size: 10px; opacity: 0.85; margin-top: 2px; }
    .body-wrap { flex: 1; display: flex; flex-direction: row; align-items: stretch; }
    .qr-wrap { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px 20px; border-right: 2px dashed #ddd; min-width: 180px; }
    .qr-wrap img { width: 150px; height: 150px; display: block; }
    .qr-label { font-size: 8px; color: #999; margin-top: 6px; font-family: monospace; text-align: center; word-break: break-all; max-width: 150px; }
    .info-section { flex: 1; padding: 16px 20px; }
    .customer { font-size: 20px; font-weight: 900; color: #111; margin-bottom: 4px; }
    .batch-tag { font-size: 10px; font-weight: 700; color: #16a34a; margin-bottom: 10px; border-bottom: 1.5px solid #eee; padding-bottom: 8px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; }
    .info-item { display: flex; flex-direction: column; gap: 2px; }
    .info-label { font-size: 8px; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-value { font-size: 12px; font-weight: 700; color: #111; line-height: 1.3; }
    .info-value.mono { font-family: monospace; font-size: 11px; }
    .info-value.green { color: #16a34a; font-size: 13px; }
    .footer { background: #f8f8f8; border-top: 1px solid #eee; padding: 8px 20px; font-size: 9px; color: #aaa; text-align: center; }
  </style>
</head><body>
  ${pages.join("")}
  <script>window.onload = () => { window.print(); window.close(); }<\/script>
</body></html>`;
    const win = window.open("", "_blank");
    if (!win) { toast({ variant: "destructive", title: "Popup diblokir", description: "Izinkan popup untuk mencetak." }); return; }
    win.document.write(html);
    win.document.close();
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="outline" size="icon" onClick={() => setLocation(`${base}/arsip`)}>
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
              &nbsp;·&nbsp; ETD: {fmtDate(batch.etd)}
              &nbsp;·&nbsp; Closing: {fmtDate(batch.periodeClosingMulai)} – {fmtDate(batch.periodeClosingSelesai)}
            </p>
          )}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-green-700">
              <CheckCircle2 className="w-4 h-4" /> {diserahkanPkgs.length} diserahkan
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700">
              <Clock className="w-4 h-4" /> {pendingPkgs.length} belum diserahkan
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-sm text-muted-foreground">Total Ongkir Diserahkan: <span className="font-semibold text-foreground">{formatRp(totalOngkir)}</span></span>
          </div>
        </div>
        <Button
          onClick={printAll}
          disabled={diserahkanPkgs.length === 0}
          className="gap-2 shrink-0 bg-green-600 hover:bg-green-700 text-white"
        >
          <Printer className="h-4 w-4" /> Cetak Semua Arsip
        </Button>
      </div>

      {!selectedServiceType ? (
        /* ── Pilih Jenis Jastip ───────────────────────────────────────────────── */
        isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <Card key={i} className="animate-pulse"><CardContent className="h-40 pt-4 bg-muted/20" /></Card>)}
          </div>
        ) : svcStats.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <QrCode className="w-14 h-14 mx-auto mb-4 opacity-20" />
            <p className="font-semibold">Tidak ada paket dalam batch ini</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {svcStats.map(svc => (
              <Card
                key={svc.key}
                className={`cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all border-2 ${svc.border} ${svc.bg}`}
                onClick={() => { setSelectedServiceType(svc.key); setSearch(""); setPage(1); setFilterStatus("semua"); }}
              >
                <CardContent className="pt-5 pb-4">
                  <div className="text-4xl mb-2">{svc.emoji}</div>
                  <p className={`text-sm font-bold leading-snug ${svc.num}`}>{svc.label}</p>
                  <div className="mt-3 space-y-1.5">
                    <div>
                      <span className={`text-3xl font-black ${svc.num}`}>{svc.count}</span>
                      <span className="text-sm text-muted-foreground ml-1">paket</span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-xs text-green-700 font-semibold">
                        <CheckCircle2 className="w-3 h-3" /> {svc.diserahkan} diserahkan
                      </span>
                      {svc.pending > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                          <Clock className="w-3 h-3" /> {svc.pending} belum
                        </span>
                      )}
                    </div>
                    {svc.ongkir > 0 && <p className="text-xs font-semibold text-primary">{formatRp(svc.ongkir)}</p>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : (
        /* ── Barcode grid (per jenis jastip) ─────────────────────────────────── */
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => { setSelectedServiceType(null); setSearch(""); setPage(1); }}>
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Jenis Jastip
            </Button>
            <span className="text-base font-bold">{svcStats.find(s => s.key === selectedServiceType)?.emoji} {selectedSvcLabel}</span>
            <Badge variant="secondary">{filtered.length} paket</Badge>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari resi, barcode, nama..."
                className="pl-9"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
            <Select value={filterStatus} onValueChange={handleStatus}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="diserahkan">✓ Sudah Diserahkan</SelectItem>
                <SelectItem value="pending">⏳ Belum Diserahkan</SelectItem>
                <SelectItem value="semua">Semua Paket</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {[1,2,3,4,5].map(i => <Card key={i} className="animate-pulse"><CardContent className="h-64 pt-4 bg-muted/20" /></Card>)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <QrCode className="w-14 h-14 mx-auto mb-4 opacity-20" />
              <p className="font-semibold text-base">
                {diserahkanPkgs.length === 0 && filterStatus === "diserahkan"
                  ? "Belum ada paket yang diserahkan"
                  : "Tidak ada paket yang cocok"}
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {paginated.map((pkg: any) => (
                  <ArsipPackageCard key={pkg.id} pkg={pkg} batchLabel={batchLabel} />
                ))}
              </div>
              <Pagination
                page={safePage}
                totalPages={totalPages}
                total={filtered.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
