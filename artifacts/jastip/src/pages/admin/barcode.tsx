import { useEffect, useRef, useState } from "react";
import { useListPackages } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import JsBarcode from "jsbarcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Download, Printer, Search, ArrowLeft, Barcode } from "lucide-react";

function BarcodeItem({ pkg }: { pkg: any }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current) {
      try {
        JsBarcode(svgRef.current, pkg.resiNumber || pkg.id.toString(), {
          format: "CODE128",
          width: 2,
          height: 60,
          displayValue: true,
          fontSize: 12,
          margin: 8,
          background: "#ffffff",
          lineColor: "#000000",
        });
      } catch {
        JsBarcode(svgRef.current, pkg.id.toString(), {
          format: "CODE128",
          width: 2,
          height: 60,
          displayValue: true,
          fontSize: 12,
          margin: 8,
        });
      }
    }
  }, [pkg]);

  function printBarcode() {
    const svg = svgRef.current;
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Barcode - ${pkg.resiNumber}</title>
        <style>
          body { margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: sans-serif; }
          .label { text-align: center; padding: 16px; border: 2px solid #000; display: inline-block; border-radius: 8px; }
          .pkg-info { font-size: 11px; color: #555; margin-top: 4px; }
          .pkg-name { font-weight: bold; font-size: 13px; margin-bottom: 4px; }
        </style>
      </head>
      <body>
        <div class="label">
          <div class="pkg-name">${pkg.resiNumber || "N/A"}</div>
          ${svgData}
          <div class="pkg-info">No Paket: ${pkg.packageNumber || "-"} | Customer: ${pkg.customerName || "-"}</div>
        </div>
        <script>window.onload = () => { window.print(); window.close(); }</script>
      </body>
      </html>
    `);
    win.document.close();
  }

  function downloadBarcode() {
    const svg = svgRef.current;
    if (!svg) return;
    const canvas = document.createElement("canvas");
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const a = document.createElement("a");
      a.download = `barcode-${pkg.resiNumber || pkg.id}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = url;
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{pkg.resiNumber || "No Resi"}</p>
            <p className="text-xs text-muted-foreground">No Paket: {pkg.packageNumber || "-"}</p>
            <p className="text-xs text-muted-foreground">Customer: {pkg.customerName || "-"}</p>
          </div>
          <Badge variant="outline" className="text-xs ml-2 shrink-0">
            {pkg.status || "pending"}
          </Badge>
        </div>

        <div className="flex justify-center bg-white border rounded-lg p-2 mb-3">
          <svg ref={svgRef} />
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={printBarcode}>
            <Printer className="w-3 h-3 mr-1" /> Cetak
          </Button>
          <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={downloadBarcode}>
            <Download className="w-3 h-3 mr-1" /> Unduh
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminBarcode() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const { data: packages, isLoading } = useListPackages();

  const filtered = (packages || []).filter((p: any) =>
    !search ||
    (p.resiNumber || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.packageNumber || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.customerName || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => setLocation("/admin/packages")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Barcode className="h-7 w-7 text-primary" />
            Label Barcode Paket
          </h1>
          <p className="text-muted-foreground mt-1">Cetak atau unduh barcode untuk setiap paket.</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari no resi, no paket, customer..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Badge variant="secondary">{filtered.length} paket</Badge>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-4 h-48 bg-muted/20 rounded-xl" />
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Barcode className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">Belum ada paket</p>
          <p className="text-sm mt-1">Tambah paket terlebih dahulu untuk membuat barcode</p>
          <Button className="mt-4" onClick={() => setLocation("/admin/packages/new")}>
            Input Paket Baru
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {filtered.map((pkg: any) => (
            <BarcodeItem key={pkg.id} pkg={pkg} />
          ))}
        </div>
      )}
    </div>
  );
}
