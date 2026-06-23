import { useEffect, useRef, useState } from "react";
import { useListPackages } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import JsBarcode from "jsbarcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/pagination";
import { Download, Printer, Search, ArrowLeft, Barcode, Package, Layers } from "lucide-react";

const PAGE_SIZE = 10;

function formatRp(n: any) {
  if (n == null) return "-";
  return `Rp ${Number(n).toLocaleString("id-ID")}`;
}

function BarcodeItem({ pkg }: { pkg: any }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current) {
      try {
        JsBarcode(svgRef.current, pkg.barcode || pkg.resiNumber || pkg.id.toString(), {
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
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Barcode - ${pkg.resiNumber || pkg.barcode}</title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: 'Arial', sans-serif;
      background: #fff;
      padding: 32px;
    }
    .label {
      text-align: center;
      padding: 32px;
      border: 3px solid #000;
      border-radius: 12px;
      width: 100%;
      max-width: 600px;
    }
    .brand {
      font-size: 22px;
      font-weight: 900;
      letter-spacing: 2px;
      color: #c00;
      margin-bottom: 6px;
    }
    .sub-brand {
      font-size: 11px;
      color: #666;
      margin-bottom: 16px;
      letter-spacing: 1px;
    }
    svg {
      width: 100%;
      max-width: 520px;
      height: auto;
      display: block;
      margin: 0 auto;
    }
    .divider { border: none; border-top: 1.5px dashed #999; margin: 16px 0; }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 20px;
      text-align: left;
      margin-top: 4px;
    }
    .info-item { display: flex; flex-direction: column; gap: 2px; }
    .info-label { font-size: 9px; font-weight: bold; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-value { font-size: 13px; font-weight: 600; color: #111; }
    .info-value.mono { font-family: monospace; font-size: 12px; }
    .full { grid-column: 1 / -1; }
  </style>
</head>
<body>
  <div class="label">
    <div class="brand">JASTIP ANGGUN JAYA</div>
    <div class="sub-brand">Layanan Pengiriman Paket ke Papua</div>
    ${svgData}
    <hr class="divider" />
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">No. Seri / Barcode</span>
        <span class="info-value mono">${pkg.barcode || "-"}</span>
      </div>
      <div class="info-item">
        <span class="info-label">No. Resi</span>
        <span class="info-value mono">${pkg.resiNumber || "-"}</span>
      </div>
      <div class="info-item full">
        <span class="info-label">Nama Konsumen</span>
        <span class="info-value">${pkg.customerName || "-"}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Jenis Jastip</span>
        <span class="info-value">${pkg.serviceType ? pkg.serviceType.replace("jastip ", "Jastip ") : "-"}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Rute</span>
        <span class="info-value">${pkg.deliveryRoute || "-"}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Berat Volume</span>
        <span class="info-value">${pkg.volumeWeight != null ? pkg.volumeWeight + " Kg" : "-"}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Berat Digunakan</span>
        <span class="info-value">${pkg.usedWeight != null ? pkg.usedWeight + " Kg" : "-"}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Total Ongkir</span>
        <span class="info-value">${pkg.totalShipping != null ? "Rp " + Number(pkg.totalShipping).toLocaleString("id-ID") : "-"}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Jenis Paking</span>
        <span class="info-value">${pkg.packagingType || "-"}</span>
      </div>
    </div>
  </div>
  <script>window.onload = () => { window.print(); window.close(); }</script>
</body>
</html>`);
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
      canvas.getContext("2d")?.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const a = document.createElement("a");
      a.download = `barcode-${pkg.barcode || pkg.resiNumber || pkg.id}.png`;
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
          <svg ref={svgRef} />
        </div>
        <div className="grid grid-cols-2 gap-1 mb-2 text-xs text-muted-foreground">
          {pkg.usedWeight != null && <span>Berat: {pkg.usedWeight} Kg</span>}
          {pkg.totalShipping != null && <span>Ongkir: {formatRp(pkg.totalShipping)}</span>}
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

type TabKey = "single" | "grup";

export default function AdminBarcode() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<TabKey>("single");
  const { data: packages, isLoading } = useListPackages();

  const allPackages = packages || [];

  const byTab = allPackages.filter((p: any) => {
    if (activeTab === "grup") return p.packageMode === "grup";
    return !p.packageMode || p.packageMode === "single";
  });

  const filtered = byTab.filter(
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

  function handleSearch(v: string) {
    setSearch(v);
    setPage(1);
  }

  function switchTab(tab: TabKey) {
    setActiveTab(tab);
    setPage(1);
    setSearch("");
  }

  const tabs: { key: TabKey; label: string; icon: any; count: number }[] = [
    {
      key: "single",
      label: "Barcode 1 Paket",
      icon: Package,
      count: allPackages.filter((p: any) => !p.packageMode || p.packageMode === "single").length,
    },
    {
      key: "grup",
      label: "Barcode Grup Paket",
      icon: Layers,
      count: allPackages.filter((p: any) => p.packageMode === "grup").length,
    },
  ];

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

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => switchTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              <Badge variant={isActive ? "default" : "secondary"} className="text-xs ml-1">
                {tab.count}
              </Badge>
            </button>
          );
        })}
      </div>

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
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-4 h-48 bg-muted/20 rounded-xl" />
            </Card>
          ))}
        </div>
      ) : total === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Barcode className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">Belum ada paket</p>
          <p className="text-sm mt-1">Tambah paket terlebih dahulu untuk membuat barcode</p>
          <Button className="mt-4" onClick={() => setLocation("/admin/packages/type")}>
            Input Paket Baru
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {paginated.map((pkg: any) => (
              <BarcodeItem key={pkg.id} pkg={pkg} />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="border rounded-lg">
              <Pagination
                page={page}
                totalPages={totalPages}
                total={total}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
