import { useEffect, useRef, useState } from "react";
import { useListPackages, getListPackagesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/pagination";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Download, Printer, Search, ArrowLeft, QrCode, CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

const PAGE_SIZE = 12;

function formatRp(n: any) {
  if (n == null) return "-";
  return `Rp ${Number(n).toLocaleString("id-ID")}`;
}

const serviceLabel: Record<string, string> = {
  "jastip pesawat": "Jastip Pesawat",
  "jastip hemat+": "Jastip Hemat+",
  "jastip kargo": "Jastip Kargo",
  "jastip pelni": "Jastip Pelni",
};

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

function BarcodeItem({
  pkg,
  onEdit,
  onDelete,
}: {
  pkg: any;
  onEdit: (pkg: any) => void;
  onDelete: (pkg: any) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, pkg.barcode || pkg.resiNumber || pkg.id.toString(), {
        width: 160,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      }).catch(() => {});
    }
  }, [pkg]);

  async function printBarcode() {
    const qrValue = pkg.barcode || pkg.resiNumber || pkg.id.toString();
    let qrDataUrl = "";
    try {
      qrDataUrl = await QRCode.toDataURL(qrValue, {
        width: 400,
        margin: 3,
        color: { dark: "#000000", light: "#ffffff" },
      });
    } catch {
      return;
    }
    const win = window.open("", "_blank");
    if (!win) return;

    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Label Paket - ${pkg.resiNumber || pkg.barcode}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Arial', sans-serif; background: #fff; height: calc(297mm - 24mm); display: flex; align-items: stretch; }
    .label { border: 3px solid #222; border-radius: 10px; width: 100%; display: flex; flex-direction: column; overflow: hidden; }
    .header { background: #c00; color: #fff; padding: 14px 20px; }
    .brand-name { font-size: 26px; font-weight: 900; letter-spacing: 2px; }
    .brand-sub { font-size: 11px; opacity: 0.85; margin-top: 2px; }
    .body-wrap { flex: 1; display: flex; flex-direction: row; align-items: stretch; }
    .qr-wrap { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px 20px; border-right: 2px dashed #ddd; min-width: 180px; }
    .qr-wrap img { width: 150px; height: 150px; display: block; }
    .qr-label { font-size: 8px; color: #999; margin-top: 6px; font-family: monospace; text-align:center; word-break:break-all; max-width:150px; }
    .info-section { flex: 1; padding: 16px 20px; }
    .customer { font-size: 20px; font-weight: 900; color: #111; margin-bottom: 12px; border-bottom: 1.5px solid #eee; padding-bottom: 10px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; }
    .info-item { display: flex; flex-direction: column; gap: 2px; }
    .info-label { font-size: 8px; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-value { font-size: 12px; font-weight: 700; color: #111; line-height: 1.3; }
    .info-value.mono { font-family: monospace; font-size: 11px; }
    .info-value.red { color: #c00; font-size: 14px; }
    .full { grid-column: 1 / -1; }
    .status { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 700; background: ${pkg.status === "diserahkan" ? "#dcfce7" : "#fef9c3"}; color: ${pkg.status === "diserahkan" ? "#166534" : "#713f12"}; }
    .footer { background: #f8f8f8; border-top: 1px solid #eee; padding: 8px 20px; font-size: 9px; color: #aaa; text-align: center; }
  </style>
</head>
<body>
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
        <div class="info-grid">
          <div class="info-item"><span class="info-label">No. Resi</span><span class="info-value mono">${pkg.resiNumber || "-"}</span></div>
          <div class="info-item"><span class="info-label">No. Paket</span><span class="info-value mono">${pkg.packageNumber || "-"}</span></div>
          <div class="info-item"><span class="info-label">Tanggal</span><span class="info-value">${pkg.packageDate ? new Date(pkg.packageDate).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }) : "-"}</span></div>
          <div class="info-item"><span class="info-label">Status</span><span class="info-value"><span class="status">${pkg.status === "diserahkan" ? "✓ Diserahkan" : "● Pending"}</span></span></div>
          <div class="info-item"><span class="info-label">Jenis Jastip</span><span class="info-value">${pkg.serviceType ? pkg.serviceType.replace("jastip ", "Jastip ") : "-"}</span></div>
          <div class="info-item"><span class="info-label">Rute</span><span class="info-value">${pkg.deliveryRoute || "-"}</span></div>
          <div class="info-item"><span class="info-label">Berat Real</span><span class="info-value">${pkg.realWeight != null ? pkg.realWeight + " Kg" : "-"}</span></div>
          <div class="info-item"><span class="info-label">Berat Digunakan</span><span class="info-value">${pkg.usedWeight != null ? pkg.usedWeight + " Kg" : "-"}</span></div>
          <div class="info-item"><span class="info-label">Jenis Paking</span><span class="info-value">${pkg.packagingType || "-"}</span></div>
          ${pkg.serviceType === "jastip kargo" ? `<div class="info-item"><span class="info-label">Jenis Barang</span><span class="info-value">${pkg.itemName || "-"}</span></div>` : ""}
          <div class="info-item"><span class="info-label">Total Ongkir</span><span class="info-value red">${pkg.totalShipping != null ? "Rp " + Number(pkg.totalShipping).toLocaleString("id-ID") : "-"}</span></div>
        </div>
      </div>
    </div>
    <div class="footer">Jastip Anggun Jaya · +62 812-4500-8384 · Jln Merpati Sp 4 jlr 8 (Depan SMKN 4), Manokwari</div>
  </div>
  <script>window.onload = () => { window.print(); window.close(); }</script>
</body>
</html>`);
    win.document.close();
  }

  function downloadBarcode() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.download = `qr-${pkg.barcode || pkg.resiNumber || pkg.id}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate font-mono">{pkg.barcode || pkg.resiNumber || "No Barcode"}</p>
            <p className="text-xs text-muted-foreground">No Resi: {pkg.resiNumber || "-"}</p>
            <p className="text-xs text-muted-foreground">Konsumen: {pkg.customerName || "-"}</p>
            {pkg.serviceType && (
              <p className="text-xs text-muted-foreground capitalize">{pkg.serviceType}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 ml-2 shrink-0">
            <Badge
              variant="outline"
              className={`text-xs ${pkg.status === "diserahkan" ? "bg-green-100 text-green-800 border-green-300" : "bg-amber-100 text-amber-800 border-amber-300"}`}
            >
              {pkg.status === "diserahkan" ? "Diserahkan" : "Pending"}
            </Badge>
          </div>
        </div>
        <div className="flex justify-center bg-white border rounded-lg p-2 mb-3">
          <canvas ref={canvasRef} />
        </div>
        <div className="grid grid-cols-2 gap-1 mb-2 text-xs text-muted-foreground">
          {pkg.usedWeight != null && <span>Berat: {pkg.usedWeight} Kg</span>}
          {pkg.totalShipping != null && <span>Ongkir: {formatRp(pkg.totalShipping)}</span>}
        </div>
        <div className="flex gap-1.5 mb-1.5">
          <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={printBarcode}>
            <Printer className="w-3 h-3 mr-1" /> Cetak
          </Button>
          <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={downloadBarcode}>
            <Download className="w-3 h-3 mr-1" /> Unduh
          </Button>
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" className="flex-1 text-xs border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => onEdit(pkg)}>
            <Pencil className="w-3 h-3 mr-1" /> Edit
          </Button>
          <Button size="sm" variant="outline" className="flex-1 text-xs border-red-300 text-red-600 hover:bg-red-50" onClick={() => onDelete(pkg)}>
            <Trash2 className="w-3 h-3 mr-1" /> Hapus
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminBarcode() {
  const [location, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data: packages, isLoading } = useListPackages();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const base = user?.role === "owner" ? "/owner" : "/admin";

  const [editPkg, setEditPkg] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    resiNumber: "", packageNumber: "", customerName: "", itemName: "",
    serviceType: "", deliveryRoute: "", packagingType: "", packageDate: "",
    realWeight: "", length: "", width: "", height: "",
  });
  const [isEditSaving, setIsEditSaving] = useState(false);

  const [deletePkg, setDeletePkg] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const idsParam = new URLSearchParams(location.split("?")[1] || "").get("ids");
  const highlightIds = idsParam ? idsParam.split(",").map(Number).filter(Boolean) : null;

  const allPackages = packages || [];

  const filtered = (highlightIds
    ? allPackages.filter((p: any) => highlightIds.includes(p.id))
    : allPackages
  ).filter(
    (p: any) =>
      !search ||
      (p.barcode || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.resiNumber || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.packageNumber || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.customerName || "").toLowerCase().includes(search.toLowerCase()),
  );

  const total = filtered.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleSearch(v: string) { setSearch(v); setPage(1); }

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
      toast({ title: "Berhasil", description: `Paket ${deletePkg.resiNumber} berhasil dihapus.` });
      setDeletePkg(null);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message });
    } finally {
      setIsDeleting(false);
    }
  }

  const editIsKargo = editForm.serviceType === "jastip kargo";
  const editRouteOpts = deliveryRouteOptions[editForm.serviceType] || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => setLocation(`${base}/packages`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <QrCode className="h-7 w-7 text-primary" />
            Label Barcode Paket
          </h1>
          <p className="text-muted-foreground mt-1">Cetak, unduh, edit, atau hapus barcode paket.</p>
        </div>
      </div>

      {highlightIds && highlightIds.length > 0 && (
        <Card className="border-green-500 bg-green-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-green-800">Barcode siap — {highlightIds.length} paket dalam sesi Grup ini</p>
                <p className="text-sm text-green-700 mt-0.5">Silakan cetak atau unduh barcode di bawah.</p>
              </div>
              <Button size="sm" variant="outline" className="border-green-400 text-green-700" onClick={() => setLocation(`${base}/barcode`)}>
                Lihat Semua
              </Button>
            </div>
          </CardContent>
        </Card>
      )}


      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari barcode, no resi, konsumen..."
            className="pl-9"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <Badge variant="secondary">{total} paket</Badge>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="animate-pulse"><CardContent className="pt-4 h-48 bg-muted/20 rounded-xl" /></Card>
          ))}
        </div>
      ) : total === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <QrCode className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">Belum ada paket</p>
          <p className="text-sm mt-1">Tambah paket terlebih dahulu untuk membuat barcode</p>
          <Button className="mt-4" onClick={() => setLocation(`${base}/packages/type`)}>Input Paket Baru</Button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {paginated.map((pkg: any) => (
              <BarcodeItem key={pkg.id} pkg={pkg} onEdit={openEdit} onDelete={setDeletePkg} />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="border rounded-lg">
              <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
            </div>
          )}
        </>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editPkg} onOpenChange={(o) => { if (!o) setEditPkg(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Paket — {editPkg?.barcode}</DialogTitle>
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
                ...f,
                serviceType: v,
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
            {editIsKargo && (
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-medium">Jenis Barang (Kargo)</label>
                <Input value={editForm.itemName} onChange={e => setEditForm(f => ({ ...f, itemName: e.target.value }))} placeholder="Contoh: Elektronik, Mesin..." />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Berat Real (Kg)</label>
              <Input type="number" step="0.001" value={editForm.realWeight} onChange={e => setEditForm(f => ({ ...f, realWeight: e.target.value }))} placeholder="0.000" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Jenis Paking</label>
              <Input value={editForm.packagingType} onChange={e => setEditForm(f => ({ ...f, packagingType: e.target.value }))} placeholder="Karton, Plastik, Kayu..." />
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
          <p className="text-xs text-muted-foreground">Berat volume, berat digunakan, tarif, dan total ongkir akan dihitung ulang otomatis saat disimpan.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPkg(null)}>Batal</Button>
            <Button onClick={saveEdit} disabled={isEditSaving || !editForm.resiNumber || !editForm.customerName}>
              {isEditSaving ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Single Package Confirmation */}
      <AlertDialog open={!!deletePkg} onOpenChange={(o) => { if (!o) setDeletePkg(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Paket?</AlertDialogTitle>
            <AlertDialogDescription>
              Paket <strong>{deletePkg?.resiNumber}</strong> — {deletePkg?.customerName} akan dihapus permanen dan tidak dapat dikembalikan.
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
