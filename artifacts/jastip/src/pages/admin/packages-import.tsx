import { useRef, useState } from "react";
import { useImportPackages, getListPackagesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Upload, FileSpreadsheet, Download,
  CheckCircle, XCircle, File, X, ChevronRight, QrCode, AlertCircle,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

// ── Kalkulasi ongkir ──────────────────────────────────────────────────────────
const volumeDivisor: Record<string, number> = {
  "jastip pesawat": 5000,
  "jastip hemat+":  4000,
  "jastip pelni":   4000,
  "jastip kargo":   1000000,
};

function calcVolumeWeight(serviceType: string, l: number, w: number, h: number): number {
  const d = volumeDivisor[serviceType] ?? 6000;
  return (l * w * h) / d;
}

function getTotalShipping(serviceType: string, deliveryRoute: string, weight: number): number | null {
  if (!serviceType || !deliveryRoute || !weight || weight <= 0) return null;
  if (serviceType === "jastip pesawat" && deliveryRoute === "Jakarta → Manokwari") {
    if (weight <= 0.2) return 15800;
    if (weight <= 0.4) return 30800;
    if (weight <= 0.5) return 38500;
    if (weight <= 0.6) return 46200;
    if (weight <= 0.7) return 53900;
    if (weight <= 0.8) return 61600;
    if (weight <= 0.9) return 69300;
    if (weight <= 1) return 77000;
    if (weight <= 2) return 154000;
    if (weight <= 3) return 231000;
    if (weight <= 5) return 385000;
    if (weight <= 10) return 770000;
    return Math.round(weight * 77000);
  }
  if (serviceType === "jastip hemat+" && deliveryRoute === "Surabaya → Manokwari") {
    return Math.max(10000, Math.round(weight * 10000));
  }
  if (serviceType === "jastip pelni") {
    if (deliveryRoute === "Jakarta → Manokwari") {
      const raw = weight <= 10 ? weight * 20000 : weight <= 20 ? weight * 19000 : weight <= 40 ? weight * 18000 : weight * 17000;
      return Math.max(20000, Math.round(raw));
    }
    if (deliveryRoute === "Surabaya → Manokwari") {
      const raw = weight <= 10 ? weight * 18000 : weight <= 20 ? weight * 17000 : weight <= 40 ? weight * 16000 : weight * 15500;
      return Math.max(18000, Math.round(raw));
    }
  }
  return null;
}

function getShippingRate(serviceType: string, deliveryRoute: string, weight: number): number | null {
  if (!serviceType || !weight || weight <= 0) return null;
  if (serviceType === "jastip pesawat") return 77000;
  if (serviceType === "jastip hemat+") return 10000;
  if (serviceType === "jastip pelni") {
    if (deliveryRoute === "Jakarta → Manokwari") {
      if (weight <= 10) return 20000;
      if (weight <= 20) return 19000;
      if (weight <= 40) return 18000;
      return 17000;
    }
    if (deliveryRoute === "Surabaya → Manokwari") {
      if (weight <= 10) return 18000;
      if (weight <= 20) return 17000;
      if (weight <= 40) return 16000;
      return 15500;
    }
  }
  return null;
}

function formatRp(n: number | null | undefined) {
  if (n == null) return "-";
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

// ── Definisi kolom template ───────────────────────────────────────────────────
type TemplateType = "standard" | "kargo";

const TEMPLATE_STANDARD = [
  { header: "Nama Konsumen",    key: "customerName",  example: "BUDI",      required: true },
  { header: "No Resi",          key: "resiNumber",    example: "JNE-001",   required: true },
  { header: "No Paket",         key: "packageNumber", example: "PKT-001",   required: false },
  { header: "Berat Real (Kg)",  key: "realWeight",    example: "1.5",       required: true },
  { header: "Panjang (cm)",     key: "length",        example: "30",        required: false },
  { header: "Lebar (cm)",       key: "width",         example: "20",        required: false },
  { header: "Tinggi (cm)",      key: "height",        example: "15",        required: false },
];

const TEMPLATE_KARGO = [
  { header: "Nama Konsumen",    key: "customerName",  example: "BUDI",      required: true },
  { header: "Toko/Kurir",       key: "resiNumber",    example: "Tokopedia", required: false },
  { header: "Total Koli",       key: "packageNumber", example: "3",         required: false },
  { header: "Koli",             key: "packagingType", example: "Koli 1/3",  required: false },
  { header: "Jenis Barang",     key: "itemName",      example: "Perabot",   required: false },
  { header: "Panjang (cm)",     key: "length",        example: "100",       required: false },
  { header: "Lebar (cm)",       key: "width",         example: "80",        required: false },
  { header: "Tinggi (cm)",      key: "height",        example: "60",        required: false },
  { header: "Berat Real (Ton)", key: "realWeight",    example: "0.5",       required: false },
  { header: "Harga Kubikasi",   key: "kargoRate",     example: "7000",      required: false },
];

const ROUTE_OPTIONS: Record<string, { value: string; label: string }[]> = {
  "jastip pesawat": [{ value: "Jakarta → Manokwari",          label: "Jakarta → Manokwari" }],
  "jastip hemat+":  [{ value: "Surabaya → Manokwari",         label: "Surabaya → Manokwari" }],
  "jastip kargo":   [{ value: "Jakarta/Surabaya → Manokwari", label: "Jakarta/Surabaya → Manokwari" }],
  "jastip pelni":   [
    { value: "Jakarta → Manokwari",  label: "Jakarta → Manokwari" },
    { value: "Surabaya → Manokwari", label: "Surabaya → Manokwari" },
  ],
};

const SERVICE_LABELS: Record<string, string> = {
  "jastip pesawat": "Jastip Pesawat",
  "jastip hemat+":  "Jastip Hemat+",
  "jastip kargo":   "Jastip Kargo",
  "jastip pelni":   "Jastip Pelni",
};

// ── Download template ─────────────────────────────────────────────────────────
function downloadStandardTemplate() {
  const header  = TEMPLATE_STANDARD.map((c) => c.header);
  const example = TEMPLATE_STANDARD.map((c) => c.example);
  const ws = XLSX.utils.aoa_to_sheet([header, example]);
  ws["!cols"] = TEMPLATE_STANDARD.map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template Standard");
  XLSX.writeFile(wb, "template-import-standard-jaj.xlsx");
}

function downloadKargoTemplate() {
  const header  = TEMPLATE_KARGO.map((c) => c.header);
  const example = TEMPLATE_KARGO.map((c) => c.example);
  const ws = XLSX.utils.aoa_to_sheet([header, example]);
  ws["!cols"] = TEMPLATE_KARGO.map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template Kargo");
  XLSX.writeFile(wb, "template-import-kargo-jaj.xlsx");
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Step = "upload" | "config" | "preview";

interface ParsedRow {
  customerName:  string;
  resiNumber:    string;
  packageNumber: string;
  itemName:      string;
  realWeight:    number | null;
  length:        number | null;
  width:         number | null;
  height:        number | null;
  packagingType: string;
  kargoRate?:    number | null;
  // computed
  volumeWeight?:  number | null;
  usedWeight?:    number | null;
  shippingRate?:  number | null;
  totalShipping?: number | null;
  error?:         string;
}

// ── Komponen utama ─────────────────────────────────────────────────────────────
export default function AdminPackagesImport() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const standardFileRef = useRef<HTMLInputElement>(null);
  const kargoFileRef    = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [templateType, setTemplateType] = useState<TemplateType | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rawRows, setRawRows] = useState<ParsedRow[]>([]);

  const [serviceType,   setServiceType]   = useState("");
  const [deliveryRoute, setDeliveryRoute] = useState("");
  const [packageDate,   setPackageDate]   = useState(todayStr());

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress]         = useState(0);
  const [importResult, setImportResult] = useState<any>(null);

  const importPackages = useImportPackages();

  // ── Parse Excel ─────────────────────────────────────────────────────────────
  function parseExcel(f: File, tplType: TemplateType) {
    const columns = tplType === "kargo" ? TEMPLATE_KARGO : TEMPLATE_STANDARD;
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb   = XLSX.read(data, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      if (rows.length < 2) {
        toast({ variant: "destructive", title: "File Kosong", description: "File tidak memiliki data." });
        return;
      }

      const headers: string[] = (rows[0] as string[]).map((h) => String(h || "").trim());
      const dataRows = rows.slice(1).filter((r: any[]) => r.some((c) => c !== undefined && c !== ""));

      const parsed: ParsedRow[] = dataRows.map((row: any[]) => {
        const get = (key: string) => {
          const col = columns.find((c) => c.key === key);
          if (!col) return "";
          const idx = headers.indexOf(col.header);
          if (idx < 0) return "";
          const val = row[idx];
          return val !== undefined && val !== null ? String(val).trim() : "";
        };
        const num = (key: string) => {
          const v = get(key);
          const n = parseFloat(v);
          return isNaN(n) ? null : n;
        };

        const customerName = get("customerName");
        const resiNumber   = get("resiNumber");
        let error: string | undefined;
        if (!customerName) error = "Nama Konsumen kosong";
        else if (tplType === "standard" && !resiNumber) error = "No Resi kosong";

        return {
          customerName,
          resiNumber,
          packageNumber: get("packageNumber"),
          itemName:      get("itemName"),
          realWeight:    num("realWeight"),
          length:        num("length"),
          width:         num("width"),
          height:        num("height"),
          packagingType: get("packagingType"),
          kargoRate:     tplType === "kargo" ? num("kargoRate") : undefined,
          error,
        };
      });

      setRawRows(parsed);
      setStep("config");
    };
    reader.readAsArrayBuffer(f);
  }

  function handleFileUpload(f: File, tplType: TemplateType) {
    if (!f.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast({ variant: "destructive", title: "Format Tidak Didukung", description: "Gunakan .xlsx, .xls, atau .csv" });
      return;
    }
    setFile(f);
    setTemplateType(tplType);
    setImportResult(null);
    setServiceType(tplType === "kargo" ? "jastip kargo" : "");
    setDeliveryRoute(tplType === "kargo" ? "Jakarta/Surabaya → Manokwari" : "");
    parseExcel(f, tplType);
  }

  function handleStandardChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFileUpload(f, "standard");
  }

  function handleKargoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFileUpload(f, "kargo");
  }

  function handleDrop(e: React.DragEvent, tplType: TemplateType) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFileUpload(f, tplType);
  }

  function clearFile() {
    setFile(null);
    setRawRows([]);
    setStep("upload");
    setImportResult(null);
    setTemplateType(null);
    setServiceType("");
    setDeliveryRoute("");
    if (standardFileRef.current) standardFileRef.current.value = "";
    if (kargoFileRef.current)    kargoFileRef.current.value    = "";
  }

  function handleServiceTypeChange(val: string) {
    setServiceType(val);
    const routes = ROUTE_OPTIONS[val] ?? [];
    setDeliveryRoute(routes[0]?.value ?? "");
  }

  function goToPreview() {
    if (!serviceType || !deliveryRoute) {
      toast({ variant: "destructive", title: "Pilih Jenis Jastip & Rute", description: "Kedua field wajib dipilih." });
      return;
    }
    setStep("preview");
  }

  // ── Hitung nilai per baris ───────────────────────────────────────────────────
  function computedRows(): ParsedRow[] {
    return rawRows.map((row) => {
      if (row.error) return row;

      if (templateType === "kargo") {
        const rw = row.realWeight ?? 0;
        let vw: number | null = null;
        if (row.length && row.width && row.height && row.length > 0 && row.width > 0 && row.height > 0) {
          vw = Number(((row.length * row.width * row.height) / 1000000).toFixed(4));
        }
        const rawUsed = rw > 0 && vw !== null ? Math.max(rw, vw) : rw > 0 ? rw : (vw ?? null);
        const billable = rawUsed !== null && rawUsed > 0 ? Math.max(10, rawUsed) : rawUsed;
        const rate     = row.kargoRate ?? null;
        const total    = billable && rate ? Math.round(billable * rate) : null;
        return { ...row, volumeWeight: vw, usedWeight: billable, shippingRate: rate, totalShipping: total };
      }

      // Standard (Hemat+, Pesawat, Pelni)
      const rw = row.realWeight ?? 0;
      let vw: number | null = null;
      if (row.length && row.width && row.height && row.length > 0 && row.width > 0 && row.height > 0) {
        vw = Number(calcVolumeWeight(serviceType, row.length, row.width, row.height).toFixed(3));
      }
      const uw    = rw > 0 && vw !== null ? Math.max(rw, vw) : (rw > 0 ? rw : (vw ?? null));
      const rate  = uw ? getShippingRate(serviceType, deliveryRoute, uw) : null;
      const total = uw ? getTotalShipping(serviceType, deliveryRoute, uw) : null;
      return { ...row, volumeWeight: vw, usedWeight: uw, shippingRate: rate, totalShipping: total };
    });
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleImport() {
    const rows  = computedRows();
    const valid = rows.filter((r) => !r.error);
    if (!valid.length) return;

    setIsSubmitting(true);
    setProgress(20);
    setImportResult(null);

    try {
      const payload = valid.map((r) => ({
        customerName:  r.customerName,
        customerPhone: "",
        resiNumber:    r.resiNumber || "-",
        packageNumber: r.packageNumber || undefined,
        itemName:      r.itemName      || undefined,
        realWeight:    r.realWeight,
        length:        r.length,
        width:         r.width,
        height:        r.height,
        packagingType: r.packagingType || undefined,
        volumeWeight:  r.volumeWeight,
        usedWeight:    r.usedWeight,
        shippingRate:  r.shippingRate,
        totalShipping: r.totalShipping,
        serviceType,
        deliveryRoute,
        packageDate,
        packageMode: "grup",
      }));

      setProgress(50);
      const res = await importPackages.mutateAsync({ data: { packages: payload } });
      setProgress(100);
      setImportResult(res);

      if ((res as any).success > 0) {
        queryClient.invalidateQueries({ queryKey: getListPackagesQueryKey() });
        toast({
          title: "Import Berhasil",
          description: `${(res as any).success} paket berhasil diimport dan barcode digenerate.`,
        });
        const ids: number[] = (res as any).ids ?? [];
        if (ids.length > 0) {
          setTimeout(() => {
            setLocation(`/admin/barcode?ids=${ids.join(",")}`);
          }, 1500);
        }
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Import Gagal", description: error.message || "Terjadi kesalahan" });
    } finally {
      setIsSubmitting(false);
      setProgress(0);
    }
  }

  const rows       = step === "preview" ? computedRows() : rawRows;
  const validCount = rawRows.filter((r) => !r.error).length;
  const errorCount = rawRows.filter((r) => !!r.error).length;
  const routeOpts  = ROUTE_OPTIONS[serviceType] ?? [];
  const isKargo    = templateType === "kargo";

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => setLocation("/admin/packages")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Import Excel</h1>
          <p className="text-muted-foreground mt-1">Import banyak paket sekaligus — barcode digenerate otomatis.</p>
        </div>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 text-sm font-medium">
        {(["upload", "config", "preview"] as Step[]).map((s, i) => {
          const labels = ["1. Upload File", "2. Pilih Jenis Jastip", "3. Preview & Import"];
          const active = step === s;
          const done   = (step === "config" && s === "upload") || (step === "preview" && (s === "upload" || s === "config"));
          return (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              <span className={`px-3 py-1 rounded-full text-xs transition-colors ${active ? "bg-primary text-primary-foreground" : done ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}`}>
                {done ? "✓ " : ""}{labels[i]}
              </span>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-4">

        {/* ── Sidebar: 2 template download ── */}
        <div className="lg:col-span-1 space-y-4">
          {/* Template 1: Standard */}
          <Card className="border-dashed border-2 border-blue-300 bg-blue-50/50 h-fit">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-blue-700">
                <FileSpreadsheet className="w-4 h-4" />Template 1 — Standard
              </CardTitle>
              <CardDescription className="text-xs">Hemat+, Pesawat, Pelni</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-muted-foreground space-y-1">
                {TEMPLATE_STANDARD.map((c) => (
                  <div key={c.key} className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.required ? "bg-blue-500" : "bg-muted-foreground/40"}`} />
                    <span className={c.required ? "text-foreground font-medium" : ""}>{c.header}</span>
                    {c.required && <span className="text-red-500 text-[10px]">*</span>}
                  </div>
                ))}
                <p className="text-[10px] text-muted-foreground/70 pt-1 border-t">Jenis Jastip, Rute & Tanggal dipilih saat import</p>
              </div>
              <Button onClick={downloadStandardTemplate} className="w-full" variant="outline" size="sm">
                <Download className="w-3.5 h-3.5 mr-1.5" />Unduh Template 1
              </Button>
            </CardContent>
          </Card>

          {/* Template 2: Kargo */}
          <Card className="border-dashed border-2 border-orange-300 bg-orange-50/50 h-fit">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-orange-700">
                <FileSpreadsheet className="w-4 h-4" />Template 2 — Kargo
              </CardTitle>
              <CardDescription className="text-xs">Jastip Kargo saja</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-muted-foreground space-y-1">
                {TEMPLATE_KARGO.map((c) => (
                  <div key={c.key} className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.required ? "bg-orange-500" : "bg-muted-foreground/40"}`} />
                    <span className={c.required ? "text-foreground font-medium" : ""}>{c.header}</span>
                    {c.required && <span className="text-red-500 text-[10px]">*</span>}
                  </div>
                ))}
                <p className="text-[10px] text-muted-foreground/70 pt-1 border-t">Harga Kubikasi per baris; Rute & Tanggal dipilih saat import</p>
              </div>
              <Button onClick={downloadKargoTemplate} className="w-full" variant="outline" size="sm">
                <Download className="w-3.5 h-3.5 mr-1.5" />Unduh Template 2
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ── Main content ── */}
        <div className="lg:col-span-3 space-y-4">

          {/* Step 1: Upload — dua zona */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="w-4 h-4" />Upload File Excel
              </CardTitle>
              <CardDescription>Upload salah satu template sesuai jenis jastip yang akan diimport</CardDescription>
            </CardHeader>
            <CardContent>
              {!file ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Zona 1 — Standard */}
                  <div
                    onDrop={(e) => handleDrop(e, "standard")}
                    onDragOver={(e) => e.preventDefault()}
                    className="border-2 border-dashed border-blue-300 rounded-xl p-6 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/40 transition-colors"
                    onClick={() => standardFileRef.current?.click()}
                  >
                    <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-blue-400" />
                    <p className="font-semibold text-sm text-blue-700">Template 1 — Standard</p>
                    <p className="text-xs text-muted-foreground mt-1">Hemat+, Pesawat, Pelni</p>
                    <p className="text-[11px] text-muted-foreground/60 mt-2">.xlsx / .xls / .csv</p>
                    <input ref={standardFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleStandardChange} />
                  </div>

                  {/* Zona 2 — Kargo */}
                  <div
                    onDrop={(e) => handleDrop(e, "kargo")}
                    onDragOver={(e) => e.preventDefault()}
                    className="border-2 border-dashed border-orange-300 rounded-xl p-6 text-center cursor-pointer hover:border-orange-500 hover:bg-orange-50/40 transition-colors"
                    onClick={() => kargoFileRef.current?.click()}
                  >
                    <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-orange-400" />
                    <p className="font-semibold text-sm text-orange-700">Template 2 — Kargo</p>
                    <p className="text-xs text-muted-foreground mt-1">Jastip Kargo</p>
                    <p className="text-[11px] text-muted-foreground/60 mt-2">.xlsx / .xls / .csv</p>
                    <input ref={kargoFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleKargoChange} />
                  </div>
                </div>
              ) : (
                <div className={`flex items-center gap-3 p-3 rounded-lg border ${isKargo ? "bg-orange-50 border-orange-200" : "bg-blue-50 border-blue-200"}`}>
                  <File className={`w-8 h-8 shrink-0 ${isKargo ? "text-orange-500" : "text-blue-500"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{file.name}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      <Badge variant="secondary" className={`text-xs ${isKargo ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>
                        {isKargo ? "Template Kargo" : "Template Standard"}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">{rawRows.length} baris</Badge>
                      {validCount > 0 && <Badge className="text-xs bg-green-100 text-green-800 hover:bg-green-100">{validCount} valid</Badge>}
                      {errorCount > 0 && <Badge variant="destructive" className="text-xs">{errorCount} error</Badge>}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={clearFile}><X className="w-4 h-4" /></Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 2: Config */}
          {step !== "upload" && (
            <Card className={step === "config" ? "border-primary/50 shadow-md" : ""}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {isKargo ? "Konfigurasi Import Kargo" : "Pilih Jenis Jastip"}
                </CardTitle>
                <CardDescription>
                  {isKargo
                    ? "Rute dan tanggal akan diterapkan ke seluruh data. Harga Kubikasi diambil per baris dari Excel."
                    : "Jenis jastip, rute, dan tanggal ini akan diterapkan ke seluruh data Excel."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-3 gap-4">
                  {/* Jenis Jastip */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Jenis Jastip *</label>
                    {isKargo ? (
                      <div className="flex items-center h-10 px-3 rounded-md border border-input bg-muted/40 text-sm font-medium text-orange-700">
                        Jastip Kargo
                      </div>
                    ) : (
                      <Select value={serviceType} onValueChange={handleServiceTypeChange} disabled={step === "preview"}>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih jenis jastip" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="jastip pesawat">Jastip Pesawat</SelectItem>
                          <SelectItem value="jastip hemat+">Jastip Hemat+</SelectItem>
                          <SelectItem value="jastip pelni">Jastip Pelni</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Rute */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Rute Pengiriman *</label>
                    {isKargo || routeOpts.length <= 1 ? (
                      <div className="flex items-center h-10 px-3 rounded-md border border-input bg-muted/40 text-sm">
                        {deliveryRoute || "-"}
                      </div>
                    ) : (
                      <Select value={deliveryRoute} onValueChange={setDeliveryRoute} disabled={step === "preview"}>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih rute" />
                        </SelectTrigger>
                        <SelectContent>
                          {routeOpts.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Tanggal */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Tanggal Paket</label>
                    <Input
                      type="date"
                      value={packageDate}
                      onChange={(e) => setPackageDate(e.target.value)}
                      disabled={step === "preview"}
                    />
                  </div>
                </div>

                {step === "config" && (
                  <Button
                    onClick={goToPreview}
                    disabled={!serviceType || !deliveryRoute}
                    className="w-full gap-2"
                  >
                    <ChevronRight className="w-4 h-4" />
                    Lanjut ke Preview
                  </Button>
                )}

                {step === "preview" && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground p-2 bg-muted/40 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                    <span>
                      <span className="font-medium text-foreground">{SERVICE_LABELS[serviceType]}</span>
                      {" · "}{deliveryRoute}{" · "}{new Date(packageDate + "T00:00:00").toLocaleDateString("id-ID")}
                    </span>
                    <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={() => setStep("config")}>
                      Ubah
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 3: Preview */}
          {step === "preview" && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Preview Data ({validCount} baris valid)</CardTitle>
                  {errorCount > 0 && (
                    <Badge variant="destructive">{errorCount} baris error (dilewati)</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="overflow-x-auto rounded-lg border text-xs max-h-72">
                  {isKargo ? (
                    /* Tabel kargo */
                    <table className="w-full">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="px-2 py-2 text-left font-medium whitespace-nowrap">#</th>
                          <th className="px-2 py-2 text-left font-medium whitespace-nowrap">Nama Konsumen</th>
                          <th className="px-2 py-2 text-left font-medium whitespace-nowrap">Toko/Kurir</th>
                          <th className="px-2 py-2 text-left font-medium whitespace-nowrap">Total Koli</th>
                          <th className="px-2 py-2 text-left font-medium whitespace-nowrap">Koli</th>
                          <th className="px-2 py-2 text-left font-medium whitespace-nowrap">Jenis Barang</th>
                          <th className="px-2 py-2 text-left font-medium whitespace-nowrap">P×L×T (cm)</th>
                          <th className="px-2 py-2 text-left font-medium whitespace-nowrap">M³ (Vol)</th>
                          <th className="px-2 py-2 text-left font-medium whitespace-nowrap">Ton (Real)</th>
                          <th className="px-2 py-2 text-left font-medium whitespace-nowrap text-blue-700">Pakai (M³)</th>
                          <th className="px-2 py-2 text-left font-medium whitespace-nowrap">Hrg Kbk</th>
                          <th className="px-2 py-2 text-left font-medium whitespace-nowrap text-green-700">Total Ongkir</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => (
                          <tr key={i} className={`border-t ${row.error ? "bg-red-50" : i % 2 === 0 ? "bg-background" : "bg-muted/20"}`}>
                            <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                            {row.error ? (
                              <td colSpan={11} className="px-2 py-1.5 text-red-600">
                                <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3 shrink-0" />{row.error}</span>
                              </td>
                            ) : (
                              <>
                                <td className="px-2 py-1.5 font-medium whitespace-nowrap">{row.customerName || "-"}</td>
                                <td className="px-2 py-1.5 whitespace-nowrap">{row.resiNumber || "-"}</td>
                                <td className="px-2 py-1.5 whitespace-nowrap">{row.packageNumber || "-"}</td>
                                <td className="px-2 py-1.5 whitespace-nowrap">{row.packagingType || "-"}</td>
                                <td className="px-2 py-1.5 whitespace-nowrap">{row.itemName || "-"}</td>
                                <td className="px-2 py-1.5 whitespace-nowrap">
                                  {(row.length && row.width && row.height) ? `${row.length}×${row.width}×${row.height}` : "-"}
                                </td>
                                <td className="px-2 py-1.5 whitespace-nowrap">{(row as any).volumeWeight != null ? Number((row as any).volumeWeight).toFixed(4) : "-"}</td>
                                <td className="px-2 py-1.5 whitespace-nowrap">{row.realWeight ?? "-"}</td>
                                <td className="px-2 py-1.5 whitespace-nowrap font-semibold text-blue-700">{(row as any).usedWeight != null ? (row as any).usedWeight : "-"}</td>
                                <td className="px-2 py-1.5 whitespace-nowrap">{row.kargoRate ? `Rp ${row.kargoRate.toLocaleString("id-ID")}` : "-"}</td>
                                <td className="px-2 py-1.5 whitespace-nowrap font-semibold text-green-700">{formatRp((row as any).totalShipping)}</td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    /* Tabel standard */
                    <table className="w-full">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="px-2 py-2 text-left font-medium whitespace-nowrap">#</th>
                          <th className="px-2 py-2 text-left font-medium whitespace-nowrap">Nama Konsumen</th>
                          <th className="px-2 py-2 text-left font-medium whitespace-nowrap">No Resi</th>
                          <th className="px-2 py-2 text-left font-medium whitespace-nowrap">No Paket</th>
                          <th className="px-2 py-2 text-left font-medium whitespace-nowrap">Jenis Barang</th>
                          <th className="px-2 py-2 text-left font-medium whitespace-nowrap">Real (Kg)</th>
                          <th className="px-2 py-2 text-left font-medium whitespace-nowrap">P×L×T (cm)</th>
                          <th className="px-2 py-2 text-left font-medium whitespace-nowrap">Vol (Kg)</th>
                          <th className="px-2 py-2 text-left font-medium whitespace-nowrap text-blue-700">Pakai (Kg)</th>
                          <th className="px-2 py-2 text-left font-medium whitespace-nowrap">Paking</th>
                          <th className="px-2 py-2 text-left font-medium whitespace-nowrap text-green-700">Total Ongkir</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => (
                          <tr key={i} className={`border-t ${row.error ? "bg-red-50" : i % 2 === 0 ? "bg-background" : "bg-muted/20"}`}>
                            <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                            {row.error ? (
                              <td colSpan={10} className="px-2 py-1.5 text-red-600">
                                <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3 shrink-0" />{row.error}</span>
                              </td>
                            ) : (
                              <>
                                <td className="px-2 py-1.5 font-medium whitespace-nowrap">{row.customerName || "-"}</td>
                                <td className="px-2 py-1.5 font-mono whitespace-nowrap">{row.resiNumber || "-"}</td>
                                <td className="px-2 py-1.5 whitespace-nowrap">{row.packageNumber || "-"}</td>
                                <td className="px-2 py-1.5 whitespace-nowrap">{row.itemName || "-"}</td>
                                <td className="px-2 py-1.5 whitespace-nowrap">{row.realWeight ?? "-"}</td>
                                <td className="px-2 py-1.5 whitespace-nowrap">
                                  {(row.length && row.width && row.height) ? `${row.length}×${row.width}×${row.height}` : "-"}
                                </td>
                                <td className="px-2 py-1.5 whitespace-nowrap">{(row as any).volumeWeight != null ? Number((row as any).volumeWeight).toFixed(3) : "-"}</td>
                                <td className="px-2 py-1.5 whitespace-nowrap font-semibold text-blue-700">{(row as any).usedWeight != null ? (row as any).usedWeight : "-"}</td>
                                <td className="px-2 py-1.5 whitespace-nowrap">{row.packagingType || "-"}</td>
                                <td className="px-2 py-1.5 whitespace-nowrap font-semibold text-green-700">{formatRp((row as any).totalShipping)}</td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {isSubmitting && (
                  <div className="space-y-2">
                    <Progress value={progress} className="h-2" />
                    <p className="text-xs text-muted-foreground text-center">Memproses import & generate barcode...</p>
                  </div>
                )}

                <Button
                  onClick={handleImport}
                  disabled={isSubmitting || validCount === 0}
                  className="w-full gap-2 bg-primary"
                  size="lg"
                >
                  {isSubmitting ? (
                    "Memproses..."
                  ) : (
                    <>
                      <QrCode className="w-5 h-5" />
                      Import {validCount} Paket & Generate Barcode
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Hasil import */}
          {importResult && (
            <Alert
              variant={(importResult as any).failed > 0 ? "destructive" : "default"}
              className={(importResult as any).failed === 0 ? "border-green-400 bg-green-50" : ""}
            >
              <AlertTitle className="flex items-center gap-2">
                {(importResult as any).failed === 0
                  ? <CheckCircle className="w-4 h-4 text-green-600" />
                  : <XCircle className="w-4 h-4" />
                }
                Hasil Import
              </AlertTitle>
              <AlertDescription className="mt-2 space-y-2">
                <div className="flex flex-wrap gap-3 mt-2">
                  <Badge variant="secondary">Total: {(importResult as any).total}</Badge>
                  <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Berhasil: {(importResult as any).success}</Badge>
                  {(importResult as any).failed > 0 && <Badge variant="destructive">Gagal: {(importResult as any).failed}</Badge>}
                </div>
                {(importResult as any).success > 0 && (
                  <p className="text-sm text-green-700">Mengalihkan ke halaman barcode...</p>
                )}
                {(importResult as any).errors?.length > 0 && (
                  <div className="mt-2 p-3 bg-background/50 rounded text-xs font-mono overflow-auto max-h-40 space-y-1">
                    {(importResult as any).errors.map((e: string, i: number) => (
                      <div key={i} className="text-red-600">{e}</div>
                    ))}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}
