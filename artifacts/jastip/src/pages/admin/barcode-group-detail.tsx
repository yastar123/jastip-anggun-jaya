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
    return p.customerName === groupName && p.packageMode === "grup";
  });

  const totalWeight = groupPackages.reduce((s: number, p: any) => s + Number(p.realWeight || 0), 0);
  const totalShipping = groupPackages.reduce((s: number, p: any) => s + Number(p.totalShipping || 0), 0);

  const [editPkg, setEditPkg] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    resiNumber: "", packageNumber: "", customerName: "", itemName: "",
    serviceType: "", deliveryRoute: "", packageDate: "",
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
        QRCode.toDataURL(p.barcode || p.resiNumber || String(p.id), { width: 200, margin: 2 }).catch(() => "")
      )
    );

    const win = window.open("", "_blank");
    if (!win) return;

    const rows = pkgs.map((p: any, i: number) => `
      <div class="pkg-row">
        <div class="qr-cell"><img src="${qrDataUrls[i]}" width="80" height="80" /><div class="barcode-txt">${p.barcode || p.resiNumber}</div></div>
        <div class="info-cell">
          <div class="resi">${p.resiNumber || "-"}</div>
          <div class="detail">No. Paket: ${p.packageNumber || "-"} · ${serviceLabel[p.serviceType] || p.serviceType || "-"}</div>
          <div class="detail">Berat: ${p.realWeight != null ? p.realWeight + " Kg" : "-"} · Ongkir: ${formatRp(p.totalShipping)}</div>
          <div class="detail">Rute: ${p.deliveryRoute || "-"}</div>
        </div>
        <div class="status-cell"><span class="status ${p.status === "diserahkan" ? "done" : "pending"}">${p.status === "diserahkan" ? "✓ Diserahkan" : "● Pending"}</span></div>
      </div>
    `).join("");

    win.document.write(`<!DOCTYPE html><html><head>
      <title>Label Grup — ${groupName || "Grup Paket"}</title>
      <style>
        @page { size: A4; margin: 10mm; }
        body { font-family: Arial, sans-serif; }
        .header { background: #c00; color: #fff; padding: 10px 16px; border-radius: 6px; margin-bottom: 12px; }
        .brand { font-size: 20px; font-weight: 900; }
        .sub { font-size: 11px; opacity: 0.85; }
        .customer-name { font-size: 22px; font-weight: 900; margin: 8px 0 12px; border-bottom: 2px solid #eee; padding-bottom: 8px; }
        .pkg-row { display: flex; gap: 12px; align-items: center; border: 1px solid #ddd; border-radius: 6px; padding: 10px; margin-bottom: 8px; }
        .qr-cell { text-align: center; min-width: 90px; }
        .barcode-txt { font-size: 7px; color: #999; font-family: monospace; margin-top: 2px; word-break: break-all; max-width: 85px; }
        .info-cell { flex: 1; }
        .resi { font-size: 13px; font-weight: 700; font-family: monospace; }
        .detail { font-size: 10px; color: #555; margin-top: 2px; }
        .status-cell { text-align: center; min-width: 80px; }
        .status { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; }
        .status.done { background: #dcfce7; color: #166534; }
        .status.pending { background: #fef9c3; color: #713f12; }
        .summary { margin-top: 12px; font-size: 11px; color: #777; border-top: 1px dashed #ddd; padding-top: 8px; }
      </style>
    </head><body>
      <div class="header">
        <div class="brand">JASTIP ANGGUN JAYA</div>
        <div class="sub">Layanan Pengiriman Paket — Jakarta · Surabaya → Manokwari, Papua</div>
      </div>
      <div class="customer-name">📦 ${groupName || "Grup Paket"} — ${pkgs.length} Paket</div>
      ${rows}
      <div class="summary">
        Total ${pkgs.length} paket · Berat: ${totalWeight.toFixed(3)} Kg · Total Ongkir: ${formatRp(totalShipping)}
      </div>
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
                <div className="flex items-center gap-4">
                  <div className="shrink-0 text-center">
                    <SmallQR value={pkg.barcode || pkg.resiNumber || String(pkg.id)} />
                    <p className="text-xs text-muted-foreground mt-1">#{idx + 1}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-mono font-semibold text-sm">{pkg.resiNumber || "-"}</p>
                      {pkg.packageNumber && <span className="text-xs text-muted-foreground">({pkg.packageNumber})</span>}
                      <Badge
                        variant="outline"
                        className={`text-xs ${pkg.status === "diserahkan" ? "bg-green-100 text-green-800 border-green-300" : "bg-amber-100 text-amber-800 border-amber-300"}`}
                      >
                        {pkg.status === "diserahkan" ? "Diserahkan" : "Pending"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                      <span>{serviceLabel[pkg.serviceType] || pkg.serviceType || "-"}</span>
                      <span>{pkg.deliveryRoute || "-"}</span>
                      <span>Berat: {pkg.realWeight != null ? pkg.realWeight + " Kg" : "-"}</span>
                      <span>Ongkir: {formatRp(pkg.totalShipping)}</span>
                      {pkg.itemName && <span className="col-span-2">Barang: {pkg.itemName}</span>}
                    </div>
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
