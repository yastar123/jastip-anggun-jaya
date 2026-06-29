import { useEffect, useRef, useState } from "react";
import { useListPackages, getListPackagesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Pencil, Trash2, Printer, Package, QrCode, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";

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

function SmallQR({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, value, { width: 80, margin: 1 }).catch(() => {});
    }
  }, [value]);
  return <canvas ref={canvasRef} className="rounded" />;
}

export default function BarcodeGroupDetail() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const base = user?.role === "owner" ? "/owner" : "/admin";

  const q = new URLSearchParams(window.location.search);
  const groupName = q.get("name") || "";
  const idsParam = q.get("ids") || "";
  const filterIds = idsParam ? idsParam.split(",").map(Number).filter(Boolean) : null;

  const { data: packages, isLoading } = useListPackages();

  const groupPackages = (packages || []).filter((p: any) => {
    if (filterIds) return filterIds.includes(p.id);
    return (p.customerName || "").trim().toLowerCase() === groupName.trim().toLowerCase();
  });

  const totalWeight = groupPackages.reduce((s: number, p: any) => s + Number(p.realWeight || 0), 0);
  const totalShipping = groupPackages.reduce((s: number, p: any) => s + Number(p.totalShipping || 0), 0);

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
      toast({ title: "Berhasil", description: "Data paket diperbarui." });
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

  async function printAll() {
    const pkgs = groupPackages;
    if (!pkgs.length) return;

    const qrDataUrls: string[] = await Promise.all(
      pkgs.map((p: any) =>
        QRCode.toDataURL(p.barcode || p.resiNumber || String(p.id), { width: 300, margin: 2 }).catch(() => "")
      )
    );

    const win = window.open("", "_blank");
    if (!win) return;

    const pages = pkgs.map((p: any, i: number) => {
      const qrValue = p.barcode || p.resiNumber || String(p.id);
      const pkgDate = p.packageDate ? new Date(p.packageDate).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }) : "-";
      const svcType = p.serviceType ? p.serviceType.replace("jastip ", "Jastip ") : "-";
      const ongkir = p.totalShipping != null ? "Rp " + Number(p.totalShipping).toLocaleString("id-ID") : "-";
      return `
        <div class="label">
          <div class="header">
            <div class="h-title">JASTIP ANGGUN JAYA</div>
            <div class="h-sub">Layanan Pengiriman Paket — Jakarta · Surabaya · Manokwari · Papua</div>
          </div>
          <div class="body">
            <div class="left">
              <div class="scan-label">SCAN RESI</div>
              <img class="qr-img" src="${qrDataUrls[i]}" alt="QR" />
              <div class="qr-txt">${qrValue}</div>
            </div>
            <div class="right">
              <div class="cust">${p.customerName || "-"}</div>
              <div class="grid">
                <div class="field"><div class="fl">No. Resi</div><div class="fv mono">${p.resiNumber || "-"}</div></div>
                <div class="field"><div class="fl">No. Paket</div><div class="fv mono">${p.packageNumber || "-"}</div></div>
                <div class="field"><div class="fl">Tanggal</div><div class="fv">${pkgDate}</div></div>
                <div class="field"><div class="fl">Jenis Jastip</div><div class="fv">${svcType}</div></div>
                <div class="field full"><div class="fl">Rute</div><div class="fv">${p.deliveryRoute || "-"}</div></div>
                <div class="field"><div class="fl">Berat Real</div><div class="fv">${p.realWeight != null ? p.realWeight + " Kg" : "-"}</div></div>
                <div class="field"><div class="fl">Berat Digunakan</div><div class="fv">${p.usedWeight != null ? p.usedWeight + " Kg" : "-"}</div></div>
                <div class="field"><div class="fl">Jenis Paking</div><div class="fv">${p.packagingType || "-"}</div></div>
                <div class="field"><div class="fl">Total Ongkir</div><div class="fv red">${ongkir}</div></div>
              </div>
            </div>
          </div>
          <div class="footer">Jastip Anggun Jaya · +62 812-4500-8384 · Jln Merpati Sp 4 jlr 8 (Depan SMKN 4), Manokwari</div>
        </div>
      `;
    }).join("");

    win.document.write(`<!DOCTYPE html><html><head>
      <title>Label — ${groupName || "Grup Paket"}</title>
      <style>
        @page { size: 100mm 100mm; margin: 0; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; background: #fff; }
        .label { width: 100mm; height: 100mm; display: flex; flex-direction: column; page-break-after: always; overflow: hidden; }
        .label:last-child { page-break-after: auto; }
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
        .fl { font-size: 4pt; font-weight: 700; color: #aaa; text-transform: uppercase; letter-spacing: 0.4px; }
        .fv { font-size: 7pt; font-weight: 700; color: #222; line-height: 1.2; }
        .fv.mono { font-family: monospace; font-size: 6.5pt; }
        .fv.red { color: #cc0000; font-size: 8.5pt; }
        .full { grid-column: 1 / -1; }
        .footer { border-top: 0.5px solid #eee; background: #f9f9f9; padding: 1mm 3mm; font-size: 3.8pt; color: #bbb; text-align: center; flex-shrink: 0; }
      </style>
    </head><body>
      ${pages}
      <script>window.onload = () => { window.print(); window.close(); }</script>
    </body></html>`);
    win.document.close();
  }

  const editRouteOpts = deliveryRouteOptions[editForm.serviceType] || [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => setLocation(`${base}/barcode`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            {groupName || "Grup Paket"}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {groupPackages.length} paket · Berat {totalWeight.toFixed(3)} Kg · Ongkir {formatRp(totalShipping)}
          </p>
        </div>
        <Button variant="outline" onClick={printAll} className="gap-2">
          <Printer className="h-4 w-4" /> Cetak Semua
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse"><CardContent className="h-20 pt-4 bg-muted/20" /></Card>
          ))}
        </div>
      ) : groupPackages.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <QrCode className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">Tidak ada paket ditemukan</p>
          <p className="text-sm mt-1">Nama "{groupName}" tidak memiliki paket terdaftar</p>
          <Button className="mt-4" onClick={() => setLocation(`${base}/barcode`)}>Kembali ke Barcode</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {groupPackages.map((pkg: any, idx: number) => (
            <Card key={pkg.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-4 pb-3">
                {/* Header row */}
                <div className="flex items-start gap-4 mb-3">
                  <div className="shrink-0 text-center">
                    <SmallQR value={pkg.barcode || pkg.resiNumber || String(pkg.id)} />
                    <p className="text-xs text-muted-foreground mt-1 font-mono">#{idx + 1}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-mono font-bold text-sm">{pkg.barcode || "-"}</p>
                      <Badge
                        variant="outline"
                        className={`text-xs ${pkg.status === "diserahkan" ? "bg-green-100 text-green-800 border-green-300" : "bg-amber-100 text-amber-800 border-amber-300"}`}
                      >
                        {pkg.status === "diserahkan" ? "✓ Diserahkan" : "● Pending"}
                      </Badge>
                    </div>
                    <p className="text-sm font-semibold text-primary">{pkg.customerName || "-"}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" className="text-xs border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => openEdit(pkg)}>
                      <Pencil className="w-3 h-3 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs border-red-300 text-red-600 hover:bg-red-50" onClick={() => setDeletePkg(pkg)}>
                      <Trash2 className="w-3 h-3 mr-1" /> Hapus
                    </Button>
                  </div>
                </div>

                {/* All fields grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-xs border-t pt-3">
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
                    <p>{pkg.packageDate ? new Date(pkg.packageDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-"}</p>
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
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Add package hint */}
          <Button
            variant="outline"
            className="w-full gap-2 border-dashed"
            onClick={() => setLocation(`${base}/packages/new?serviceType=${(groupPackages[0] as any)?.serviceType || ""}&packageMode=grup`)}
          >
            <Plus className="h-4 w-4" /> Tambah Paket ke Grup Ini
          </Button>
        </div>
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
              <label className="text-sm font-medium">Jenis Paking</label>
              <Input value={editForm.packagingType} onChange={e => setEditForm(f => ({ ...f, packagingType: e.target.value }))} placeholder="Karton, Plastik, Kayu..." />
            </div>
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
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? "Menghapus..." : "Ya, Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
