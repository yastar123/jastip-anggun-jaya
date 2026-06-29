import { useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useGetPackage, getListPackagesQueryKey, getGetPackageQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Printer, User, Phone } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import JsBarcode from "jsbarcode";

function formatRp(n: any) {
  if (n === null || n === undefined || n === "") return "-";
  return `Rp ${Number(n).toLocaleString("id-ID")}`;
}
function formatDate(d: string | null | undefined) {
  if (!d) return "-";
  try { return format(new Date(d), "dd MMM yyyy", { locale: localeId }); } catch { return d; }
}
function packagingLabel(t: string | null | undefined) {
  const map: Record<string, string> = { karton:"Karton", plastik:"Plastik", kayu:"Kayu", bubble_wrap:"Bubble Wrap", sack:"Karung", lainnya:"Lainnya" };
  return t ? (map[t] || t) : "-";
}

function BarcodeDisplay({ value, pkg }: { value: string; pkg?: any }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: "CODE128", width: 2, height: 80, displayValue: true,
          fontSize: 13, margin: 10, background: "#ffffff", lineColor: "#000000",
        });
      } catch {}
    }
  }, [value]);

  function printLabel() {
    const svg = svgRef.current;
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const win = window.open("", "_blank");
    if (!win) { toast({ variant: "destructive", title: "Pop-up diblokir", description: "Izinkan pop-up untuk mencetak." }); return; }
    const customerName = pkg?.customerName || "";
    const resiNumber = pkg?.resiNumber || value;
    const pkgNumber = pkg?.packageNumber || "-";
    const serviceType = pkg?.serviceType ? pkg.serviceType.replace("jastip ", "Jastip ") : "-";
    const pkgDate = pkg?.packageDate ? new Date(pkg.packageDate).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }) : "-";
    const usedWeight = pkg?.usedWeight != null ? pkg.usedWeight + " Kg" : "-";
    const packaging = pkg?.packagingType || "-";
    const ongkir = pkg?.totalShipping != null ? "Rp " + Number(pkg.totalShipping).toLocaleString("id-ID") : "-";
    win.document.write(`<!DOCTYPE html><html><head><title>Label Barcode - ${resiNumber}</title>
      <style>
        @page { size: 100mm 100mm; margin: 0; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; width: 100mm; height: 100mm; overflow: hidden; }
        .label { width: 100mm; height: 100mm; display: flex; flex-direction: column; border: 1.5px solid #222; }
        .header { background: #c00; color: #fff; padding: 3mm 4mm 2.5mm; flex-shrink: 0; }
        .brand-name { font-size: 11pt; font-weight: 900; letter-spacing: 1px; line-height: 1; }
        .brand-sub { font-size: 5pt; opacity: 0.85; margin-top: 1px; }
        .body { flex: 1; padding: 2.5mm 3.5mm; overflow: hidden; }
        .customer { font-size: 11pt; font-weight: 900; color: #111; margin-bottom: 2mm; border-bottom: 0.5px solid #eee; padding-bottom: 1.5mm; line-height: 1.2; }
        .row { display: flex; gap: 2mm; margin-bottom: 1mm; }
        .item { flex: 1; }
        .lbl { font-size: 4.5pt; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: 0.3px; }
        .val { font-size: 7pt; font-weight: 700; color: #111; line-height: 1.2; }
        .val.mono { font-family: monospace; font-size: 6.5pt; }
        .val.red { color: #c00; font-size: 8.5pt; }
        .barcode-wrap { margin-top: 2mm; display: flex; justify-content: center; }
        .footer { background: #f8f8f8; border-top: 0.5px solid #eee; padding: 1.5mm 3mm; font-size: 4pt; color: #aaa; text-align: center; flex-shrink: 0; }
      </style></head>
      <body>
        <div class="label">
          <div class="header">
            <div class="brand-name">JASTIP ANGGUN JAYA</div>
            <div class="brand-sub">Jakarta · Surabaya → Manokwari, Papua</div>
          </div>
          <div class="body">
            <div class="customer">${customerName || resiNumber}</div>
            <div class="row">
              <div class="item"><div class="lbl">No. Resi</div><div class="val mono">${resiNumber}</div></div>
              <div class="item"><div class="lbl">No. Paket</div><div class="val mono">${pkgNumber}</div></div>
            </div>
            <div class="row">
              <div class="item"><div class="lbl">Jenis Jastip</div><div class="val">${serviceType}</div></div>
              <div class="item"><div class="lbl">Tanggal</div><div class="val">${pkgDate}</div></div>
            </div>
            <div class="row">
              <div class="item"><div class="lbl">Berat Pakai</div><div class="val">${usedWeight}</div></div>
              <div class="item"><div class="lbl">Paking</div><div class="val">${packaging}</div></div>
            </div>
            <div class="row">
              <div class="item"><div class="lbl">Total Ongkir</div><div class="val red">${ongkir}</div></div>
            </div>
            <div class="barcode-wrap">${svgData.replace(/width="\d+"/, 'width="88mm"').replace(/height="\d+"/, 'height="14mm"')}</div>
          </div>
          <div class="footer">Jastip Anggun Jaya · +62 812-4500-8384 · Jln Merpati Sp 4 jlr 8 (Depan SMKN 4), Manokwari</div>
        </div>
        <script>window.onload=()=>{window.print();window.close();}<\/script>
      </body></html>`);
    win.document.close();
  }

  function downloadPNG() {
    const svg = svgRef.current;
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const scale = 3;
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
      }
      URL.revokeObjectURL(url);
      const a = document.createElement("a");
      a.download = `barcode-${value}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = url;
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-6 w-full flex items-center justify-center">
        <svg ref={svgRef} />
      </div>
      <div className="flex gap-3 w-full">
        <Button variant="outline" className="flex-1" onClick={printLabel}>
          <Printer className="w-4 h-4 mr-2" /> Cetak Label
        </Button>
        <Button variant="outline" className="flex-1" onClick={downloadPNG}>
          Unduh PNG
        </Button>
      </div>
    </div>
  );
}

const FIELDS: { label: string; key: string; format?: (v: any, pkg: any) => string }[] = [
  { label: "Tanggal", key: "packageDate", format: (v, p) => formatDate(v || p.createdAt) },
  { label: "No Resi", key: "resiNumber" },
  { label: "No Paket", key: "packageNumber", format: v => v || "-" },
  { label: "Nama Konsumen", key: "customerName", format: v => v || "-" },
  { label: "Berat Real (Kg)", key: "realWeight", format: v => v ?? "-" },
  { label: "P (cm)", key: "length", format: v => v ?? "-" },
  { label: "L (cm)", key: "width", format: v => v ?? "-" },
  { label: "T (cm)", key: "height", format: v => v ?? "-" },
  { label: "Berat Volume (Kg)", key: "volumeWeight", format: v => v ?? "-" },
  { label: "Jenis Paking", key: "packagingType", format: v => packagingLabel(v) },
  { label: "Berat Digunakan (Kg)", key: "usedWeight", format: v => v ?? "-" },
  { label: "Ongkir/Kg", key: "shippingRate", format: v => formatRp(v) },
  { label: "Total Berat (Kg)", key: "totalWeight", format: v => v ?? "-" },
  { label: "Harga Barang", key: "price", format: v => formatRp(v) },
  { label: "Total Ongkir", key: "totalShipping", format: v => formatRp(v) },
];

export default function AdminPackagesDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const [, setLocation] = useLocation();

  const { data: pkg, isLoading } = useGetPackage(id, { query: { queryKey: ["package", id], enabled: !!id } });

  if (isLoading) return <div className="p-12 text-center animate-pulse text-muted-foreground">Memuat detail paket...</div>;
  if (!pkg) return <div className="p-12 text-center text-destructive">Paket tidak ditemukan.</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 print:hidden">
        <Button variant="outline" size="icon" onClick={() => setLocation("/admin/packages")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Detail Paket</h1>
          <p className="text-muted-foreground mt-1 font-mono">{pkg.resiNumber}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left: info */}
        <div className="md:col-span-2 space-y-4">

          {/* Customer Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Informasi Customer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Nama Customer</div>
                    <div className="font-semibold text-base">{pkg.customerName || "-"}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Nomor Telepon</div>
                    <div className="font-semibold text-base">{pkg.customerPhone || "-"}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Status</div>
                    <div className="mt-1"><StatusBadge status={pkg.status} /></div>
                  </div>
                </div>
              </div>
              {pkg.pickedUpAt && (
                <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
                  Diambil pada: <span className="text-foreground font-medium">{format(new Date(pkg.pickedUpAt), "dd MMM yyyy, HH:mm", { locale: localeId })}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Data Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Data Paket</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs uppercase">Field</th>
                      <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs uppercase">Nilai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FIELDS.map(({ label, key, format: fmt }, idx) => {
                      const val = (pkg as any)[key];
                      const display = fmt ? fmt(val, pkg) : (val ?? "-");
                      return (
                        <tr key={key} className={`border-b ${idx % 2 === 0 ? "" : "bg-muted/20"}`}>
                          <td className="py-2.5 px-4 text-muted-foreground font-medium whitespace-nowrap">{label}</td>
                          <td className={`py-2.5 px-4 font-medium ${key === "totalShipping" ? "text-primary font-bold" : ""} ${key === "resiNumber" || key === "packageNumber" ? "font-mono" : ""}`}>
                            {display}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Barcode */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Label Barcode</CardTitle>
            </CardHeader>
            <CardContent>
              <BarcodeDisplay value={pkg.barcode || pkg.resiNumber} pkg={pkg} />
              <div className="mt-4 text-center">
                <div className="text-xs text-muted-foreground">Kode Barcode</div>
                <div className="font-mono font-bold text-sm mt-1 break-all">{pkg.barcode}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dibuat</span>
                  <span className="font-medium">{formatDate(pkg.createdAt)}</span>
                </div>
                {pkg.adminName && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Admin Input</span>
                    <span className="font-medium">{pkg.adminName}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nama Barang</span>
                  <span className="font-medium text-right">{pkg.itemName || "-"}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
