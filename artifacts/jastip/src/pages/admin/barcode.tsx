import { useEffect, useRef, useState } from "react";
import { useListPackages } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/pagination";
import { Download, Printer, Search, ArrowLeft, QrCode, Package, Layers, CheckCircle2 } from "lucide-react";

const PAGE_SIZE = 10;

function formatRp(n: any) {
  if (n == null) return "-";
  return `Rp ${Number(n).toLocaleString("id-ID")}`;
}

function BarcodeItem({ pkg }: { pkg: any }) {
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
    body {
      font-family: 'Arial', sans-serif;
      background: #fff;
      height: calc(297mm - 24mm);
      display: flex;
      align-items: stretch;
    }
    .label {
      border: 3px solid #222;
      border-radius: 10px;
      width: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .header {
      background: #c00;
      color: #fff;
      padding: 14px 20px;
    }
    .brand-name { font-size: 26px; font-weight: 900; letter-spacing: 2px; }
    .brand-sub { font-size: 11px; opacity: 0.85; margin-top: 2px; }
    .body-wrap {
      flex: 1;
      display: flex;
      flex-direction: row;
      align-items: stretch;
    }
    .qr-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 20px;
      border-right: 2px dashed #ddd;
      min-width: 180px;
    }
    .qr-wrap img { width: 150px; height: 150px; display: block; }
    .qr-label { font-size: 8px; color: #999; margin-top: 6px; font-family: monospace; text-align:center; word-break:break-all; max-width:150px; }
    .info-section { flex: 1; padding: 16px 20px; }
    .customer { font-size: 20px; font-weight: 900; color: #111; margin-bottom: 12px; border-bottom: 1.5px solid #eee; padding-bottom: 10px; }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 16px;
    }
    .info-item { display: flex; flex-direction: column; gap: 2px; }
    .info-label { font-size: 8px; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-value { font-size: 12px; font-weight: 700; color: #111; line-height: 1.3; }
    .info-value.mono { font-family: monospace; font-size: 11px; }
    .info-value.red { color: #c00; font-size: 14px; }
    .full { grid-column: 1 / -1; }
    .status {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 20px;
      font-size: 10px;
      font-weight: 700;
      background: ${pkg.status === "diserahkan" ? "#dcfce7" : "#fef9c3"};
      color: ${pkg.status === "diserahkan" ? "#166534" : "#713f12"};
    }
    .footer {
      background: #f8f8f8;
      border-top: 1px solid #eee;
      padding: 8px 20px;
      font-size: 9px;
      color: #aaa;
      text-align: center;
    }
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
          <div class="info-item">
            <span class="info-label">No. Resi</span>
            <span class="info-value mono">${pkg.resiNumber || "-"}</span>
          </div>
          <div class="info-item">
            <span class="info-label">No. Paket</span>
            <span class="info-value mono">${pkg.packageNumber || "-"}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Tanggal</span>
            <span class="info-value">${pkg.packageDate ? new Date(pkg.packageDate).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }) : "-"}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Status</span>
            <span class="info-value"><span class="status">${pkg.status === "diserahkan" ? "✓ Diserahkan" : "● Pending"}</span></span>
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
            <span class="info-label">Berat Real</span>
            <span class="info-value">${pkg.realWeight != null ? pkg.realWeight + " Kg" : "-"}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Berat Digunakan</span>
            <span class="info-value">${pkg.usedWeight != null ? pkg.usedWeight + " Kg" : "-"}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Jenis Paking</span>
            <span class="info-value">${pkg.packagingType || "-"}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Nama Barang</span>
            <span class="info-value">${pkg.itemName || "-"}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Harga Barang</span>
            <span class="info-value">${pkg.price != null ? "Rp " + Number(pkg.price).toLocaleString("id-ID") : "-"}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Total Ongkir</span>
            <span class="info-value red">${pkg.totalShipping != null ? "Rp " + Number(pkg.totalShipping).toLocaleString("id-ID") : "-"}</span>
          </div>
        </div>
      </div>
    </div>
    <div class="footer">
      Jastip Anggun Jaya · +62 812-4500-8384 · Jln Merpati Sp 4 jlr 8 (Depan SMKN 4), Manokwari
    </div>
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
  const [location, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<TabKey>("single");
  const { data: packages, isLoading } = useListPackages();

  const idsParam = new URLSearchParams(location.split("?")[1] || "").get("ids");
  const highlightIds = idsParam ? idsParam.split(",").map(Number).filter(Boolean) : null;

  const allPackages = packages || [];

  const byTab = highlightIds
    ? allPackages.filter((p: any) => highlightIds.includes(p.id))
    : allPackages.filter((p: any) => {
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
            <QrCode className="h-7 w-7 text-primary" />
            Label Barcode Paket
          </h1>
          <p className="text-muted-foreground mt-1">Cetak atau unduh QR code untuk setiap paket.</p>
        </div>
      </div>

      {/* Grup session banner */}
      {highlightIds && highlightIds.length > 0 && (
        <Card className="border-green-500 bg-green-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-green-800">
                  Barcode siap — {highlightIds.length} paket dalam sesi Grup ini
                </p>
                <p className="text-sm text-green-700 mt-0.5">Silakan cetak atau unduh barcode di bawah.</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-green-400 text-green-700"
                onClick={() => setLocation("/admin/barcode")}
              >
                Lihat Semua
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs — only show when not in grup session mode */}
      {!highlightIds && (
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
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-4 h-48 bg-muted/20 rounded-xl" />
            </Card>
          ))}
        </div>
      ) : total === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <QrCode className="w-16 h-16 mx-auto mb-4 opacity-20" />
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
