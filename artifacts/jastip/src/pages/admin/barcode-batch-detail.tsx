import { useEffect, useRef, useState } from "react";
import { useListPackages, useListBatches, getListPackagesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Printer, Download, Ship, CheckCircle2, Lock, Archive,
  QrCode, Pencil, Trash2, Search,
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

const deliveryRouteOptions: Record<string, { value: string; label: string }[]> = {
  "jastip pesawat": [{ value: "Jakarta → Manokwari", label: "Jakarta → Manokwari" }],
  "jastip hemat+": [{ value: "Surabaya → Manokwari", label: "Surabaya → Manokwari" }],
  "jastip kargo": [{ value: "Jakarta/Surabaya → Manokwari", label: "Jakarta/Surabaya → Manokwari" }],
  "jastip pelni": [
    { value: "Jakarta → Manokwari", label: "Jakarta → Manokwari" },
    { value: "Surabaya → Manokwari", label: "Surabaya → Manokwari" },
  ],
};

interface EditForm {
  resiNumber: string;
  packageNumber: string;
  customerName: string;
  itemName: string;
  serviceType: string;
  deliveryRoute: string;
  packagingType: string;
  packageDate: string;
  realWeight: string;
  length: string;
  width: string;
  height: string;
}

// ── SmallQR ───────────────────────────────────────────────────────────────────

function SmallQR({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvasRef.current && value) {
      QRCode.toCanvas(canvasRef.current, value, { width: 96, margin: 2 }).catch(() => {});
    }
  }, [value]);
  return <canvas ref={canvasRef} className="rounded" />;
}

// ── PackageBarcodeCard ────────────────────────────────────────────────────────

function PackageBarcodeCard({
  pkg,
  batchLabel,
  onEdit,
  onDelete,
}: {
  pkg: any;
  batchLabel: string;
  onEdit: (pkg: any) => void;
  onDelete: (pkg: any) => void;
}) {
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
    const html = `<!DOCTYPE html>
<html><head>
  <title>Label Paket - ${pkg.resiNumber || pkg.barcode}</title>
  <style>
    @page { size: 100mm 100mm; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; width: 100mm; height: 100mm; overflow: hidden; background: #fff; }
    .wrap { width: 100mm; height: 100mm; display: flex; flex-direction: column; }
    .header { background: #cc0000; color: #fff; padding: 3mm 4mm 2.5mm; flex-shrink: 0; }
    .h-title { font-size: 13pt; font-weight: 900; letter-spacing: 1px; line-height: 1; }
    .h-sub { font-size: 4.5pt; opacity: 0.9; margin-top: 0.8mm; }
    .body { flex: 1; display: flex; min-height: 0; }
    .left { width: 31mm; border-right: 0.5px solid #ddd; display: flex; flex-direction: column; align-items: center; padding: 3mm 2mm 2mm; flex-shrink: 0; }
    .scan-label { background: #cc0000; color: #fff; font-size: 5.5pt; font-weight: 900; padding: 1mm 2.5mm; border-radius: 2px; letter-spacing: 0.5px; margin-bottom: 2.5mm; }
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
    .fv.red { color: #cc0000; font-size: 8.5pt; }
    .footer { border-top: 0.5px solid #eee; background: #f9f9f9; padding: 1mm 3mm; font-size: 3.8pt; color: #bbb; text-align: center; flex-shrink: 0; }
  </style>
</head><body>
  <div class="wrap">
    <div class="header">
      <div class="h-title">JASTIP ANGGUN JAYA</div>
      <div class="h-sub">Layanan Pengiriman Paket — Jakarta · Surabaya → Manokwari, Papua</div>
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
          <div class="field"><div class="fl">Tanggal</div><div class="fv">${pkgDate}</div></div>
          <div class="field"><div class="fl">Jenis Jastip</div><div class="fv">${svcType}</div></div>
          <div class="field full"><div class="fl">Batch Pengiriman</div><div class="fv" style="color:#1d4ed8;">${batchLabel}</div></div>
          <div class="field"><div class="fl">Berat Real</div><div class="fv">${pkg.realWeight != null ? pkg.realWeight + " Kg" : "-"}</div></div>
          <div class="field"><div class="fl">Berat Digunakan</div><div class="fv">${pkg.usedWeight != null ? pkg.usedWeight + " Kg" : "-"}</div></div>
          <div class="field full"><div class="fl">Total Ongkir</div><div class="fv red">${ongkir}</div></div>
        </div>
      </div>
    </div>
    <div class="footer">Jastip Anggun Jaya · +62 812-4500-8384 · Jln Merpati Sp 4 jlr 8 (Depan SMKN 4), Manokwari</div>
  </div>
  <script>window.onload = () => { window.print(); window.close(); }<\/script>
</body></html>`;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4 pb-3">
        {/* Top: name + status */}
        <div className="flex items-start justify-between mb-2 gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate">{pkg.customerName || "-"}</p>
            <p className="font-mono text-xs text-muted-foreground truncate">{pkg.resiNumber || "-"}</p>
            {pkg.serviceType && (
              <p className="text-xs text-muted-foreground capitalize mt-0.5">{pkg.serviceType}</p>
            )}
          </div>
          <Badge
            variant="outline"
            className={`text-xs shrink-0 ${
              pkg.status === "diserahkan"
                ? "bg-green-100 text-green-800 border-green-300"
                : "bg-amber-100 text-amber-800 border-amber-300"
            }`}
          >
            {pkg.status === "diserahkan" ? "Diserahkan" : "Pending"}
          </Badge>
        </div>

        {/* QR Code */}
        <div className="flex justify-center bg-white border rounded-lg p-2 mb-2">
          <SmallQR value={qrValue} />
        </div>
        <p className="text-center font-mono text-[10px] text-muted-foreground mb-2 truncate">{qrValue}</p>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-muted-foreground mb-2">
          {pkg.usedWeight != null && <span>Berat: <span className="font-semibold text-foreground">{pkg.usedWeight} Kg</span></span>}
          {pkg.totalShipping != null && <span className="col-span-2 font-semibold text-primary">{formatRp(pkg.totalShipping)}</span>}
        </div>

        {/* Actions */}
        <div className="flex gap-1.5 mb-1.5">
          <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={printSingle}>
            <Printer className="w-3 h-3 mr-1" /> Cetak
          </Button>
        </div>
        <div className="flex gap-1.5">
          <Button
            size="sm" variant="outline"
            className="flex-1 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
            onClick={() => onEdit(pkg)}
          >
            <Pencil className="w-3 h-3 mr-1" /> Edit
          </Button>
          <Button
            size="sm" variant="outline"
            className="flex-1 text-xs border-red-300 text-red-600 hover:bg-red-50"
            onClick={() => onDelete(pkg)}
          >
            <Trash2 className="w-3 h-3 mr-1" /> Hapus
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BarcodeBatchDetail({ params }: { params: { id: string } }) {
  const batchId = Number(params?.id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const base = user?.role === "owner" ? "/owner" : "/admin";

  const [search, setSearch] = useState("");
  const [filterServiceType, setFilterServiceType] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedServiceType, setSelectedServiceType] = useState<string | null>(null);

  const { data: batches } = useListBatches();
  const { data: packages, isLoading } = useListPackages();

  const batch = (batches || []).find((b: any) => b.id === batchId);
  const batchLabel = batch ? (batch.namaKapal || `Batch #${batchId}`) : `Batch #${batchId}`;

  const batchPkgs = (packages || []).filter(
    (p: any) =>
      p.batchId === batchId &&
      p.statusPengambilan !== "SUDAH_DIAMBIL" &&
      p.status !== "diserahkan"
  );

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
      const pkgs = batchPkgs.filter((p: any) => (p.serviceType || "").toLowerCase() === def.key);
      if (!pkgs.length) return null;
      return { ...def, count: pkgs.length, weight: pkgs.reduce((s: number, p: any) => s + Number(p.realWeight || 0), 0), ongkir: pkgs.reduce((s: number, p: any) => s + Number(p.totalShipping || 0), 0) };
    }).filter(Boolean),
    (() => { const pkgs = batchPkgs.filter((p: any) => !knownSvcKeys.includes((p.serviceType || "").toLowerCase())); return pkgs.length ? { key: "lainnya", label: "Lainnya", emoji: "📋", border: "border-gray-200", bg: "bg-gray-50/60", num: "text-gray-700", count: pkgs.length, weight: pkgs.reduce((s: number, p: any) => s + Number(p.realWeight || 0), 0), ongkir: pkgs.reduce((s: number, p: any) => s + Number(p.totalShipping || 0), 0) } : null; })(),
  ].filter(Boolean) as { key: string; label: string; emoji: string; border: string; bg: string; num: string; count: number; weight: number; ongkir: number }[];

  const selectedSvcDef = SVC_DEFS.find(d => d.key === selectedServiceType);
  const selectedSvcLabel = selectedSvcDef?.label ?? (selectedServiceType === "lainnya" ? "Lainnya" : "");

  const effectiveFilter = selectedServiceType ?? filterServiceType;

  const filtered = batchPkgs.filter((p: any) =>
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

  const totalWeight = batchPkgs.reduce((s: number, p: any) => s + Number(p.realWeight || 0), 0);
  const totalShipping = batchPkgs.reduce((s: number, p: any) => s + Number(p.totalShipping || 0), 0);

  function handleSearch(v: string) { setSearch(v); setPage(1); }
  function handleFilter(v: string) { setFilterServiceType(v); setPage(1); }

  // ── Edit state ──────────────────────────────────────────────────────────────
  const [editPkg, setEditPkg] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    resiNumber: "", packageNumber: "", customerName: "", itemName: "",
    serviceType: "", deliveryRoute: "", packagingType: "", packageDate: "",
    realWeight: "", length: "", width: "", height: "",
  });
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [deletePkg, setDeletePkg] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  function openEdit(pkg: any) {
    setEditPkg(pkg);
    setEditForm({
      resiNumber: pkg.resiNumber || "",
      packageNumber: pkg.packageNumber || "",
      customerName: pkg.customerName || "",
      itemName: pkg.itemName || "",
      serviceType: pkg.serviceType || "",
      deliveryRoute: pkg.deliveryRoute || "",
      packagingType: pkg.packagingType || "",
      packageDate: pkg.packageDate ? pkg.packageDate.split("T")[0] : "",
      realWeight: pkg.realWeight != null ? String(pkg.realWeight) : "",
      length: pkg.length != null ? String(pkg.length) : "",
      width: pkg.width != null ? String(pkg.width) : "",
      height: pkg.height != null ? String(pkg.height) : "",
    });
  }

  async function saveEdit() {
    if (!editPkg) return;
    setIsEditSaving(true);
    try {
      const token = localStorage.getItem("jaj_token");
      const r = await fetch(`/api/packages/${editPkg.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          resiNumber: editForm.resiNumber,
          packageNumber: editForm.packageNumber || null,
          customerName: editForm.customerName,
          itemName: editForm.itemName || null,
          serviceType: editForm.serviceType || null,
          deliveryRoute: editForm.deliveryRoute || null,
          packagingType: editForm.packagingType || null,
          packageDate: editForm.packageDate || null,
          realWeight: editForm.realWeight ? Number(editForm.realWeight) : null,
          length: editForm.length ? Number(editForm.length) : null,
          width: editForm.width ? Number(editForm.width) : null,
          height: editForm.height ? Number(editForm.height) : null,
        }),
      });
      if (!r.ok) throw new Error("Gagal menyimpan perubahan");
      await queryClient.invalidateQueries({ queryKey: getListPackagesQueryKey() });
      toast({ title: "Berhasil", description: "Data paket berhasil diperbarui." });
      setEditPkg(null);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message });
    } finally {
      setIsEditSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deletePkg) return;
    setIsDeleting(true);
    try {
      const token = localStorage.getItem("jaj_token");
      const r = await fetch(`/api/packages/${deletePkg.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error("Gagal menghapus paket");
      await queryClient.invalidateQueries({ queryKey: getListPackagesQueryKey() });
      toast({ title: "Berhasil", description: `Paket ${deletePkg.resiNumber} dihapus.` });
      setDeletePkg(null);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message });
    } finally {
      setIsDeleting(false);
    }
  }

  // ── Print All ────────────────────────────────────────────────────────────────
  async function printAll() {
    if (!batchPkgs.length) return;
    const pages: string[] = [];
    for (const pkg of batchPkgs) {
      const qrValue = pkg.barcode || pkg.resiNumber || String(pkg.id);
      let qrDataUrl = "";
      try {
        qrDataUrl = await QRCode.toDataURL(qrValue, { width: 400, margin: 3 });
      } catch { continue; }
      const pkgDate = pkg.packageDate
        ? new Date(pkg.packageDate).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })
        : "-";
      pages.push(`
        <div class="page">
          <div class="label">
            <div class="header">
              <div class="brand-name">JASTIP ANGGUN JAYA</div>
              <div class="brand-sub">Layanan Pengiriman Paket — Jakarta · Surabaya → Manokwari, Papua</div>
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
                  <div class="info-item"><span class="info-label">Tanggal</span><span class="info-value">${pkgDate}</span></div>
                  <div class="info-item"><span class="info-label">Jenis Jastip</span><span class="info-value">${pkg.serviceType ? pkg.serviceType.replace("jastip ", "Jastip ") : "-"}</span></div>
                  <div class="info-item"><span class="info-label">Rute</span><span class="info-value">${pkg.deliveryRoute || "-"}</span></div>
                  <div class="info-item"><span class="info-label">Berat Real</span><span class="info-value">${pkg.realWeight != null ? pkg.realWeight + " Kg" : "-"}</span></div>
                  <div class="info-item"><span class="info-label">Berat Digunakan</span><span class="info-value">${pkg.usedWeight != null ? pkg.usedWeight + " Kg" : "-"}</span></div>
                  <div class="info-item"><span class="info-label">Jenis Paking</span><span class="info-value">${pkg.packagingType || "-"}</span></div>
                  <div class="info-item"><span class="info-label">Total Ongkir</span><span class="info-value red">${pkg.totalShipping != null ? "Rp " + Number(pkg.totalShipping).toLocaleString("id-ID") : "-"}</span></div>
                </div>
              </div>
            </div>
            <div class="footer">Jastip Anggun Jaya · +62 812-4500-8384 · Jln Merpati Sp 4 jlr 8 (Depan SMKN 4), Manokwari</div>
          </div>
        </div>
      `);
    }
    if (!pages.length) return;
    const html = `<!DOCTYPE html>
<html><head>
  <title>Print Barcode — ${batchLabel}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #fff; }
    .page { width: 100%; height: calc(297mm - 24mm); display: flex; align-items: stretch; page-break-after: always; break-after: page; }
    .page:last-child { page-break-after: avoid; break-after: avoid; }
    .label { border: 3px solid #222; border-radius: 10px; width: 100%; display: flex; flex-direction: column; overflow: hidden; }
    .header { background: #c00; color: #fff; padding: 14px 20px; }
    .brand-name { font-size: 26px; font-weight: 900; letter-spacing: 2px; }
    .brand-sub { font-size: 11px; opacity: 0.85; margin-top: 2px; }
    .body-wrap { flex: 1; display: flex; flex-direction: row; align-items: stretch; }
    .qr-wrap { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px 20px; border-right: 2px dashed #ddd; min-width: 180px; }
    .qr-wrap img { width: 150px; height: 150px; display: block; }
    .qr-label { font-size: 8px; color: #999; margin-top: 6px; font-family: monospace; text-align: center; word-break: break-all; max-width: 150px; }
    .info-section { flex: 1; padding: 16px 20px; }
    .customer { font-size: 20px; font-weight: 900; color: #111; margin-bottom: 4px; }
    .batch-tag { font-size: 10px; font-weight: 700; color: #1d4ed8; margin-bottom: 10px; border-bottom: 1.5px solid #eee; padding-bottom: 8px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; }
    .info-item { display: flex; flex-direction: column; gap: 2px; }
    .info-label { font-size: 8px; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-value { font-size: 12px; font-weight: 700; color: #111; line-height: 1.3; }
    .info-value.mono { font-family: monospace; font-size: 11px; }
    .info-value.red { color: #c00; font-size: 14px; }
    .footer { background: #f8f8f8; border-top: 1px solid #eee; padding: 8px 20px; font-size: 9px; color: #aaa; text-align: center; }
  </style>
</head><body>
  ${pages.join("")}
  <script>window.onload = () => { window.print(); window.close(); }<\/script>
</body></html>`;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  }

  const editRouteOpts = deliveryRouteOptions[editForm.serviceType] || [];

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="outline" size="icon" onClick={() => setLocation(`${base}/barcode`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className={`p-1.5 rounded-lg ${batch?.statusBatch === "OPEN" ? "bg-blue-100" : "bg-gray-100"}`}>
              <Ship className={`w-5 h-5 ${batch?.statusBatch === "OPEN" ? "text-blue-700" : "text-gray-500"}`} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{batch?.namaKapal || batchLabel}</h1>
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
          <p className="text-sm text-muted-foreground mt-0.5">
            <span className="font-semibold text-foreground">{batchPkgs.length} paket</span>
            &nbsp;·&nbsp; Berat {totalWeight.toFixed(3)} Kg
            &nbsp;·&nbsp; Total Ongkir {formatRp(totalShipping)}
          </p>
        </div>
        <Button onClick={printAll} disabled={batchPkgs.length === 0} className="gap-2 shrink-0">
          <Printer className="h-4 w-4" /> Cetak Semua
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
            <p className="font-semibold">Belum ada paket dalam batch ini</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {svcStats.map(svc => (
              <Card
                key={svc.key}
                className={`cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all border-2 ${svc.border} ${svc.bg}`}
                onClick={() => { setSelectedServiceType(svc.key); setSearch(""); setPage(1); }}
              >
                <CardContent className="pt-5 pb-4">
                  <p className={`text-sm font-bold leading-snug ${svc.num}`}>{svc.label}</p>
                  <div className="mt-3 space-y-1">
                    <div>
                      <span className={`text-3xl font-black ${svc.num}`}>{svc.count}</span>
                      <span className="text-sm text-muted-foreground ml-1">paket</span>
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
            <span className="text-base font-bold">{selectedSvcLabel}</span>
            <Badge variant="secondary">{filtered.length} paket</Badge>
          </div>

          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari resi, barcode, nama..."
              className="pl-9"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>

          {isLoading ? (
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {[1,2,3,4,5].map(i => <Card key={i} className="animate-pulse"><CardContent className="h-64 pt-4 bg-muted/20" /></Card>)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <QrCode className="w-14 h-14 mx-auto mb-4 opacity-20" />
              <p className="font-semibold text-base">Tidak ada paket yang cocok</p>
              {search && <p className="text-sm mt-1">Coba ubah kata kunci pencarian</p>}
            </div>
          ) : (
            <>
              <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {paginated.map((pkg: any) => (
                  <PackageBarcodeCard
                    key={pkg.id}
                    pkg={pkg}
                    batchLabel={batchLabel}
                    onEdit={openEdit}
                    onDelete={setDeletePkg}
                  />
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

      {/* Edit Dialog */}
      <Dialog open={!!editPkg} onOpenChange={(o) => { if (!o) setEditPkg(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Paket — {editPkg?.barcode || editPkg?.resiNumber}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">No Resi *</label>
              <Input value={editForm.resiNumber} onChange={e => setEditForm(f => ({ ...f, resiNumber: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">No Paket</label>
              <Input value={editForm.packageNumber} onChange={e => setEditForm(f => ({ ...f, packageNumber: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nama Konsumen *</label>
              <Input value={editForm.customerName} onChange={e => setEditForm(f => ({ ...f, customerName: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tanggal</label>
              <Input type="date" value={editForm.packageDate} onChange={e => setEditForm(f => ({ ...f, packageDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Jenis Jastip</label>
              <Select value={editForm.serviceType} onValueChange={v => setEditForm(f => ({
                ...f, serviceType: v,
                deliveryRoute: deliveryRouteOptions[v]?.[0]?.value || "",
              }))}>
                <SelectTrigger><SelectValue placeholder="Pilih jenis" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="jastip pesawat">Jastip Pesawat</SelectItem>
                  <SelectItem value="jastip hemat+">Jastip Hemat+</SelectItem>
                  <SelectItem value="jastip kargo">Jastip Kargo</SelectItem>
                  <SelectItem value="jastip pelni">Jastip Pelni</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Rute Pengiriman</label>
              {editRouteOpts.length <= 1 ? (
                <div className="flex items-center h-10 px-3 rounded-md border border-input bg-muted/40 text-sm">
                  {editForm.deliveryRoute || "-"}
                </div>
              ) : (
                <Select value={editForm.deliveryRoute} onValueChange={v => setEditForm(f => ({ ...f, deliveryRoute: v }))}>
                  <SelectTrigger><SelectValue placeholder="Pilih rute" /></SelectTrigger>
                  <SelectContent>
                    {editRouteOpts.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            {(editForm.serviceType === "jastip kargo" || editForm.serviceType === "jastip pelni") && (
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-medium">Nama Barang</label>
                <Input value={editForm.itemName} onChange={e => setEditForm(f => ({ ...f, itemName: e.target.value }))} placeholder="Contoh: Pakaian, Elektronik..." />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Berat Real (Kg)</label>
              <Input type="number" step="0.001" value={editForm.realWeight} onChange={e => setEditForm(f => ({ ...f, realWeight: e.target.value }))} placeholder="0.000" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Panjang (cm)</label>
              <Input type="number" step="0.1" value={editForm.length} onChange={e => setEditForm(f => ({ ...f, length: e.target.value }))} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Lebar (cm)</label>
              <Input type="number" step="0.1" value={editForm.width} onChange={e => setEditForm(f => ({ ...f, width: e.target.value }))} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tinggi (cm)</label>
              <Input type="number" step="0.1" value={editForm.height} onChange={e => setEditForm(f => ({ ...f, height: e.target.value }))} placeholder="0" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Berat volume, berat digunakan, tarif, dan total ongkir akan dihitung ulang otomatis.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPkg(null)}>Batal</Button>
            <Button onClick={saveEdit} disabled={isEditSaving || !editForm.resiNumber || !editForm.customerName}>
              {isEditSaving ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletePkg} onOpenChange={(o) => { if (!o) setDeletePkg(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Paket?</AlertDialogTitle>
            <AlertDialogDescription>
              Paket <strong>{deletePkg?.resiNumber}</strong> akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Menghapus..." : "Ya, Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
