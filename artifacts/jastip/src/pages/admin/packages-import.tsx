import { useState } from "react";
import { useImportPackages, getListPackagesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, FileJson } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function AdminPackagesImport() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const [dataText, setDataText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const importPackages = useImportPackages();

  const handleImport = async () => {
    try {
      setIsSubmitting(true);
      setImportResult(null);
      
      let parsedData;
      try {
        parsedData = JSON.parse(dataText);
        if (!Array.isArray(parsedData)) {
          throw new Error("Format JSON harus berupa array of objects.");
        }
      } catch (e: any) {
        toast({
          variant: "destructive",
          title: "Format Tidak Valid",
          description: "Harap masukkan data dalam format JSON yang benar.",
        });
        setIsSubmitting(false);
        return;
      }

      const res = await importPackages.mutateAsync({ data: { packages: parsedData } });
      setImportResult(res);
      
      if (res.success > 0) {
        queryClient.invalidateQueries({ queryKey: getListPackagesQueryKey() });
        toast({
          title: "Import Selesai",
          description: `Berhasil mengimport ${res.success} paket.`,
        });
      }
      
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Import Gagal",
        description: error.message || "Terjadi kesalahan saat import",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const sampleJson = `[
  {
    "resiNumber": "RES-001",
    "itemName": "Sepatu",
    "customerPhone": "081234567890",
    "weight": 1.2,
    "notes": "Fragile"
  }
]`;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => setLocation("/admin/packages")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Import Data Paket</h1>
          <p className="text-muted-foreground mt-1">Import banyak paket sekaligus menggunakan JSON/Excel.</p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileJson className="w-5 h-5" />
              Paste Data JSON
            </CardTitle>
            <CardDescription>
              Format data harus berupa JSON Array dengan keys: resiNumber, itemName, customerPhone (wajib), weight, notes (opsional).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
              <div className="font-semibold mb-1">Contoh Format:</div>
              <pre className="font-mono text-xs whitespace-pre-wrap">{sampleJson}</pre>
            </div>
            <Textarea 
              className="min-h-[300px] font-mono text-sm" 
              placeholder="Paste array JSON di sini..."
              value={dataText}
              onChange={(e) => setDataText(e.target.value)}
            />
            <Button onClick={handleImport} disabled={isSubmitting || !dataText.trim()} className="w-full">
              {isSubmitting ? "Memproses..." : <><Upload className="w-4 h-4 mr-2" /> Proses Import</>}
            </Button>
          </CardContent>
        </Card>

        {importResult && (
          <Alert variant={importResult.failed > 0 ? "destructive" : "default"} className={importResult.failed === 0 ? "border-green-500 text-green-700 bg-green-50 dark:bg-green-950/20" : ""}>
            <AlertTitle>Hasil Import</AlertTitle>
            <AlertDescription className="mt-2 space-y-2">
              <div>Total diproses: <strong>{importResult.total}</strong></div>
              <div className="text-green-600 dark:text-green-400">Berhasil: <strong>{importResult.success}</strong></div>
              {importResult.failed > 0 && (
                <div className="text-red-600 dark:text-red-400">Gagal: <strong>{importResult.failed}</strong></div>
              )}
              {importResult.errors && importResult.errors.length > 0 && (
                <div className="mt-4 p-2 bg-background/50 rounded text-xs font-mono overflow-auto max-h-40">
                  {importResult.errors.map((e: string, i: number) => (
                    <div key={i}>{e}</div>
                  ))}
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
