import { useState } from "react";
import { useScanPackage } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { ScanLine, Search, AlertCircle, CheckCircle2 } from "lucide-react";

export default function CustomerScan() {
  const [barcode, setBarcode] = useState("");
  const [lastScanned, setLastScanned] = useState("");

  const { data: scanResult, isLoading, refetch } = useScanPackage(lastScanned, {
    query: {
      enabled: false,
      retry: false
    }
  });

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim()) return;
    setLastScanned(barcode.trim());
    setTimeout(() => {
      refetch();
    }, 0);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Scan Paket</h1>
        <p className="text-muted-foreground mt-1">Cari paket berdasarkan kode resi atau barcode.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Input Barcode</CardTitle>
          <CardDescription>Masukkan kode barcode paket Anda</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleScan} className="flex gap-2">
            <Input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Contoh: PKG-12345678"
              className="font-mono text-lg"
              autoFocus
            />
            <Button type="submit" disabled={isLoading || !barcode.trim()}>
              {isLoading ? (
                "Mencari..."
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Cari
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {scanResult && (
        <Card className={`border-l-4 ${scanResult.valid ? 'border-l-green-500' : 'border-l-destructive'}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              {scanResult.valid ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-destructive" />
              )}
              <CardTitle className={scanResult.valid ? "text-green-700 dark:text-green-400" : "text-destructive"}>
                {scanResult.message}
              </CardTitle>
            </div>
          </CardHeader>
          {scanResult.valid && scanResult.package && (
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <div className="text-sm text-muted-foreground">Nomor Resi</div>
                  <div className="font-mono font-medium">{scanResult.package.resiNumber}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <div className="mt-1"><StatusBadge status={scanResult.package.status} /></div>
                </div>
                <div className="col-span-2">
                  <div className="text-sm text-muted-foreground">Nama Barang</div>
                  <div className="font-medium">{scanResult.package.itemName}</div>
                </div>
                {scanResult.package.notes && (
                  <div className="col-span-2">
                    <div className="text-sm text-muted-foreground">Catatan</div>
                    <div className="italic">{scanResult.package.notes}</div>
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {!scanResult && !isLoading && (
        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground border-2 border-dashed rounded-lg border-border/50">
          <ScanLine className="w-12 h-12 mb-4 opacity-50" />
          <p>Scan barcode atau masukkan kode resi untuk melihat detail paket</p>
        </div>
      )}
    </div>
  );
}
