import { useRef, useState } from "react";
import { useImportPackages, getListPackagesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, FileSpreadsheet, Download, CheckCircle, XCircle, File, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const TEMPLATE_COLUMNS = [
  { header: "No Resi", key: "resiNumber", example: "JNE-001" },
  { header: "No Paket", key: "packageNumber", example: "PKT-001" },
  { header: "No HP Customer", key: "customerPhone", example: "081234567890" },
  { header: "Nama Barang", key: "itemName", example: "Sepatu" },
  { header: "Berat Real (Kg)", key: "weight", example: "1.5" },
  { header: "Panjang (cm)", key: "length", example: "30" },
  { header: "Lebar (cm)", key: "width", example: "20" },
  { header: "Tinggi (cm)", key: "height", example: "15" },
  { header: "Jenis Paking", key: "packagingType", example: "karton" },
  { header: "Ongkir/Kg (Rp)", key: "shippingRate", example: "50000" },
  { header: "Harga (Rp)", key: "price", example: "150000" },
  { header: "Catatan", key: "notes", example: "Fragile" },
];

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    TEMPLATE_COLUMNS.map((c) => c.header),
    TEMPLATE_COLUMNS.map((c) => c.example),
  ]);
  ws["!cols"] = TEMPLATE_COLUMNS.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template Import Paket");
  XLSX.writeFile(wb, "template-import-paket.xlsx");
}

export default function AdminPackagesImport() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [progress, setProgress] = useState(0);

  const importPackages = useImportPackages();

  function parseExcel(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      if (rows.length < 2) {
        toast({ variant: "destructive", title: "File Kosong", description: "File Excel tidak memiliki data." });
        return;
      }

      const headers: string[] = rows[0] as string[];
      const dataRows = rows.slice(1).filter((r: any[]) => r.some((c) => c !== undefined && c !== ""));

      const mapped = dataRows.map((row: any[]) => {
        const obj: Record<string, any> = {};
        headers.forEach((h, i) => {
          const col = TEMPLATE_COLUMNS.find((c) => c.header === h);
          if (col) obj[col.key] = row[i] !== undefined ? String(row[i]) : "";
        });
        return obj;
      });

      setParsedData(mapped);
      setPreviewRows(mapped.slice(0, 5));
    };
    reader.readAsArrayBuffer(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast({ variant: "destructive", title: "Format Tidak Didukung", description: "Gunakan file .xlsx, .xls, atau .csv" });
      return;
    }
    setFile(f);
    setImportResult(null);
    setParsedData([]);
    setPreviewRows([]);
    parseExcel(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) {
      const input = fileInputRef.current;
      if (input) {
        const dt = new DataTransfer();
        dt.items.add(f);
        input.files = dt.files;
      }
      setFile(f);
      setImportResult(null);
      parseExcel(f);
    }
  }

  async function handleImport() {
    if (!parsedData.length) return;
    try {
      setIsSubmitting(true);
      setProgress(20);
      setImportResult(null);

      const res = await importPackages.mutateAsync({ data: { packages: parsedData } });
      setProgress(100);
      setImportResult(res);

      if (res.success > 0) {
        queryClient.invalidateQueries({ queryKey: getListPackagesQueryKey() });
        toast({ title: "Import Selesai", description: `Berhasil mengimport ${res.success} paket.` });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Import Gagal", description: error.message || "Terjadi kesalahan saat import" });
    } finally {
      setIsSubmitting(false);
      setProgress(0);
    }
  }

  function clearFile() {
    setFile(null);
    setParsedData([]);
    setPreviewRows([]);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => setLocation("/admin/packages")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Import Excel</h1>
          <p className="text-muted-foreground mt-1">Import banyak paket sekaligus dari file Excel.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Template download */}
        <Card className="md:col-span-1 border-dashed border-2 border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              Template Excel
            </CardTitle>
            <CardDescription>Download template dan isi data sesuai kolom yang tersedia</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground mb-2">Kolom yang tersedia:</p>
              {TEMPLATE_COLUMNS.map((c) => (
                <div key={c.key} className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  {c.header}
                </div>
              ))}
            </div>
            <Button onClick={downloadTemplate} className="w-full" variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Unduh Template .xlsx
            </Button>
          </CardContent>
        </Card>

        {/* Upload area */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload File Excel
            </CardTitle>
            <CardDescription>Pilih atau drag & drop file .xlsx / .xls / .csv</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!file ? (
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                <p className="font-medium text-muted-foreground">Klik atau drag & drop file di sini</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Mendukung .xlsx, .xls, .csv</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                  <File className="w-8 h-8 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {parsedData.length} baris data ditemukan
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={clearFile}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {previewRows.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Preview data (5 baris pertama):</p>
                    <div className="overflow-x-auto rounded-lg border text-xs">
                      <table className="w-full">
                        <thead className="bg-muted">
                          <tr>
                            {Object.keys(previewRows[0]).map((k) => (
                              <th key={k} className="px-3 py-2 text-left font-medium whitespace-nowrap">{k}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewRows.map((row, i) => (
                            <tr key={i} className={i % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                              {Object.values(row).map((v: any, j) => (
                                <td key={j} className="px-3 py-2 whitespace-nowrap">{v || "-"}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {parsedData.length > 5 && (
                      <p className="text-xs text-muted-foreground mt-1">...dan {parsedData.length - 5} baris lainnya</p>
                    )}
                  </div>
                )}

                {isSubmitting && (
                  <div className="space-y-2">
                    <Progress value={progress} className="h-2" />
                    <p className="text-xs text-muted-foreground text-center">Memproses import...</p>
                  </div>
                )}

                <Button
                  onClick={handleImport}
                  disabled={isSubmitting || !parsedData.length}
                  className="w-full"
                >
                  {isSubmitting ? "Memproses..." : (
                    <><Upload className="w-4 h-4 mr-2" /> Import {parsedData.length} Paket</>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {importResult && (
        <Alert
          variant={importResult.failed > 0 ? "destructive" : "default"}
          className={importResult.failed === 0 ? "border-green-400 bg-green-50 dark:bg-green-950/20" : ""}
        >
          <AlertTitle className="flex items-center gap-2">
            {importResult.failed === 0 ? (
              <CheckCircle className="w-4 h-4 text-green-600" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            Hasil Import
          </AlertTitle>
          <AlertDescription className="mt-2 space-y-2">
            <div className="flex flex-wrap gap-3 mt-2">
              <Badge variant="secondary">Total: {importResult.total}</Badge>
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Berhasil: {importResult.success}</Badge>
              {importResult.failed > 0 && (
                <Badge variant="destructive">Gagal: {importResult.failed}</Badge>
              )}
            </div>
            {importResult.errors?.length > 0 && (
              <div className="mt-3 p-3 bg-background/50 rounded text-xs font-mono overflow-auto max-h-40 space-y-1">
                {importResult.errors.map((e: string, i: number) => (
                  <div key={i} className="text-red-600">{e}</div>
                ))}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
