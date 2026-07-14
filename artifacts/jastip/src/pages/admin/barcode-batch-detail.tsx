import { useEffect, useRef, useState } from "react";
import { useListPackages, useListBatches } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Printer, Download, Ship, CheckCircle2, Lock, Archive,
  QrCode, Pencil, Search, Eye,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Pagination } from "@/components/pagination";
import { labelDocumentHtml, labelPageHtml, qrSectionHtml } from "@/lib/print-label";

const PAGE_SIZE = 15;

// ── helpers ───────────────────────────────────────────────────────────────────

function formatRp(n: any) {
  if (n == null) return "-";
  return `Rp ${Number(n).toLocaleString("id-ID")}`;
}

function fmtDate(d: string) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function batchStatusColor(status: string) {
  if (status === "OPEN") return "bg-green-100 text-green-800 border-green-200";
  if (status === "CLOSED") return "bg-yellow-100 text-yellow-800 border-yellow-200";
  return "bg-gray-100 text-gray-600 border-gray-200";
}

function batchStatusIcon(status: string) {
  if (status === "OPEN") return <CheckCircle2 className="w-3 h-3" />;
  if (status === "CLOSED") return <Lock className="w-3 h-3" />;
  return <Archive className="w-3 h-3" />;
}

function batchStatusLabel(status: string) {
  if (status === "OPEN") return "Aktif";
  if (status === "CLOSED") return "Ditutup";
  return "Arsip";
}

// ── grouping helper ───────────────────────────────────────────────────────────

function groupPkgsByCustomer(pkgs: any[]) {
  const map = new Map<string, any[]>();
  for (const p of pkgs) {
    const key = [
      (p.customerName || "").trim().toLowerCase(),
      (p.serviceType || "").toLowerCase(),
      String(p.batchId ?? ""),
    ].join("|");
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return [...map.values()];
}

function buildGroupedPrintHtml(pkgs: any[], qrDataUrl: string, qrValue: string, batchLabel?: string) {
  const first = pkgs[0];
  const totalWeight = pkgs.reduce((s, p) => s + (p.usedWeight ?? p.realWeight ?? 0), 0);
  const totalShipping = pkgs.reduce((s, p) => s + (p.totalShipping ?? 0), 0);
  const batchRow = batchLabel
    ? `<div class="field full"><div class="fl">Batch Pengiriman</div><div class="fv" style="color:#1d4ed8;">${batchLabel}</div></div>`
    : "";

  const inner = `${qrSectionHtml(qrDataUrl, qrValue)}
    <div class="info">
      <div class="cust">${first?.customerName || "-"}</div>
      <div class="grid">
        <div class="field"><div class="fl">Total Paket</div><div class="fv">${pkgs.length} pkt</div></div>
        <div class="field"><div class="fl">Total Berat</div><div class="fv">${totalWeight.toFixed(3)} Kg</div></div>
        <div class="field"><div class="fl">Jenis Jastip</div><div class="fv">${first?.serviceType ? first.serviceType.replace("jastip ", "Jastip ") : "-"}</div></div>
        <div class="field"><div class="fl">Total Ongkir</div><div class="fv red">Rp ${totalShipping.toLocaleString("id-ID")}</div></div>
        <div class="field full"><div class="fl">Rute</div><div class="fv">${first?.deliveryRoute || "-"}</div></div>
        ${batchRow}
      </div>
    </div>`;
  return labelDocumentHtml(`Label Grup - ${first?.customerName}`, labelPageHtml(inner));
}

// ── GroupedBarcodeCard ────────────────────────────────────────────────────────

function GroupedBarcodeCard({
  pkgs,
  batchLabel,
}: {
  pkgs: any[];
  batchLabel?: string;
}) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const base = user?.role === "owner" ? "/owner" : "/admin";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const first = pkgs[0];
  const qrValue = first?.barcode || first?.resiNumber || first?.id?.toString() || "";
  const totalWeight = pkgs.reduce((s, p) => s + (p.usedWeight ?? p.realWeight ?? 0), 0);
  const totalShipping = pkgs.reduce((s, p) => s + (p.totalShipping ?? 0), 0);
  const allPending = pkgs.every((p) => p.status !== "diserahkan");
  const allDone = pkgs.every((p) => p.status === "diserahkan");

  useEffect(() => {
    if (canvasRef.current && qrValue) {
      QRCode.toCanvas(canvasRef.current, qrValue, {
        width: 160, margin: 2, color: { dark: "#000000", light: "#ffffff" },
      }).catch(() => {});
    }
  }, [qrValue]);

  async function printBarcode() {
    let qrDataUrl = "";
    try {
      qrDataUrl = await QRCode.toDataURL(qrValue, { width: 400, margin: 3, color: { dark: "#000000", light: "#ffffff" } });
    } catch { return; }
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(buildGroupedPrintHtml(pkgs, qrDataUrl, qrValue, batchLabel));
    win.document.close();
  }

  function downloadBarcode() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.download = `qr-grup-${first?.customerName || first?.id}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  }

  return (
    <Card className="hover:shadow-md transition-shadow border-blue-200">
      <CardContent className="pt-4 pb-3">
        <div className="mb-2">
          <p className="font-bold text-sm leading-snug break-words line-clamp-2" title={first?.customerName || "-"}>
            {first?.customerName || "-"}
          </p>
          <div className="flex items-center justify-between gap-2 mt-1">
            <p className="text-xs text-muted-foreground truncate">{pkgs.length} paket · {totalWeight.toFixed(3)} Kg</p>
            <Badge
              variant="outline"
              className={`text-xs shrink-0 ${allDone ? "bg-green-100 text-green-800 border-green-300" : allPending ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-blue-100 text-blue-800 border-blue-300"}`}
            >
              {allDone ? "Diserahkan" : allPending ? "Pending" : "Sebagian"}
            </Badge>
          </div>
          {first?.serviceType && (
            <p className="text-xs text-muted-foreground capitalize truncate">{first.serviceType}</p>
          )}
        </div>
        <div className="flex justify-center bg-white border rounded-lg p-2 mb-2">
          <canvas ref={canvasRef} />
        </div>
        <div className="mb-2 space-y-0.5">
          {pkgs.map((p, i) => (
            <div key={p.id} className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-mono truncate max-w-[120px]">#{i + 1} {p.resiNumber || "-"}</span>
              <span>{p.usedWeight != null ? p.usedWeight + " Kg" : "-"}</span>
            </div>
          ))}
        </div>
        <div className="text-xs font-semibold text-primary mb-2">Total Ongkir: {formatRp(totalShipping)}</div>
        <div className="flex gap-1.5 mb-1.5">
          <Button size="sm" variant="outline" className="flex-1 min-w-0 px-2 text-xs" onClick={printBarcode}>
            <Printer className="w-3 h-3 mr-1 shrink-0" /> <span className="truncate">Cetak</span>
          </Button>
          <Button size="sm" variant="outline" className="flex-1 min-w-0 px-2 text-xs" onClick={downloadBarcode}>
            <Download className="w-3 h-3 mr-1 shrink-0" /> <span className="truncate">Unduh</span>
          </Button>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="w-full text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
          onClick={() => {
            const params = new URLSearchParams({ name: first?.customerName || "" });
            if (first?.serviceType) params.set("serviceType", first.serviceType);
            if (first?.batchId != null) params.set("batchId", String(first.batchId));
            setLocation(`${base}/barcode-group?${params.toString()}`);
          }}
        >
          {pkgs.length > 1 ? (
            <><Eye className="w-3 h-3 mr-1" /> Lihat Semua Paket</>
          ) : (
            <><Pencil className="w-3 h-3 mr-1" /> Edit / Kelola Paket</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BarcodeBatchDetail({ params }: { params: { id: string } }) {
  const batchId = Number(params?.id);
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const base = user?.role === "owner" ? "/owner" : "/admin";

  const [search, setSearch] = useState("");
  const [filterServiceType, setFilterServiceType] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedServiceType, setSelectedServiceType] = useState<string | null>(null);

  const { data: batches } = useListBatches();
  const { data: packages, isLoading } = useListPackages();

  const batch = (batches || []).find((b: any) => b.id === batchId);
  const batchLabel = batch ? (batch.namaKapal || `Batch #${batchId}`) : `Batch #${batchId}`;

  const batchPkgs = (packages || []).filter(
    (p: any) =>
      p.batchId === batchId &&
      p.statusPengambilan !== "SUDAH_DIAMBIL" &&
      p.status !== "diserahkan"
  );

  // ── Service type stats ────────────────────────────────────────────────────────
  const SVC_DEFS = [
    { key: "jastip pesawat", label: "Jastip Pesawat", emoji: "✈️", border: "border-blue-200", bg: "bg-blue-50/60", num: "text-blue-700" },
    { key: "jastip hemat+",  label: "Jastip Hemat+",  emoji: "📦", border: "border-emerald-200", bg: "bg-emerald-50/60", num: "text-emerald-700" },
    { key: "jastip kargo",   label: "Jastip Kargo",   emoji: "🚛", border: "border-orange-200", bg: "bg-orange-50/60", num: "text-orange-700" },
    { key: "jastip pelni",   label: "Jastip Pelni",   emoji: "🚢", border: "border-indigo-200", bg: "bg-indigo-50/60", num: "text-indigo-700" },
  ];
  const knownSvcKeys = SVC_DEFS.map(d => d.key);
  const svcStats = [
    ...SVC_DEFS.map(def => {
      const pkgs = batchPkgs.filter((p: any) => (p.serviceType || "").toLowerCase() === def.key);
      if (!pkgs.length) return null;
      return { ...def, count: pkgs.length, weight: pkgs.reduce((s: number, p: any) => s + Number(p.realWeight || 0), 0), ongkir: pkgs.reduce((s: number, p: any) => s + Number(p.totalShipping || 0), 0) };
    }).filter(Boolean),
    (() => { const pkgs = batchPkgs.filter((p: any) => !knownSvcKeys.includes((p.serviceType || "").toLowerCase())); return pkgs.length ? { key: "lainnya", label: "Lainnya", emoji: "📋", border: "border-gray-200", bg: "bg-gray-50/60", num: "text-gray-700", count: pkgs.length, weight: pkgs.reduce((s: number, p: any) => s + Number(p.realWeight || 0), 0), ongkir: pkgs.reduce((s: number, p: any) => s + Number(p.totalShipping || 0), 0) } : null; })(),
  ].filter(Boolean) as { key: string; label: string; emoji: string; border: string; bg: string; num: string; count: number; weight: number; ongkir: number }[];

  const selectedSvcDef = SVC_DEFS.find(d => d.key === selectedServiceType);
  const selectedSvcLabel = selectedSvcDef?.label ?? (selectedServiceType === "lainnya" ? "Lainnya" : "");

  const effectiveFilter = selectedServiceType ?? filterServiceType;

  const filtered = batchPkgs.filter((p: any) =>
    (effectiveFilter === "all" || (p.serviceType || "").toLowerCase() === effectiveFilter) &&
    (!search ||
      (p.barcode || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.resiNumber || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.packageNumber || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.customerName || "").toLowerCase().includes(search.toLowerCase()))
  );

  const groupedFiltered = groupPkgsByCustomer(filtered);
  const totalPages = Math.max(1, Math.ceil(groupedFiltered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedGroups = groupedFiltered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const totalWeight = batchPkgs.reduce((s: number, p: any) => s + Number(p.realWeight || 0), 0);
  const totalShipping = batchPkgs.reduce((s: number, p: any) => s + Number(p.totalShipping || 0), 0);

  function handleSearch(v: string) { setSearch(v); setPage(1); }
  function handleFilter(v: string) { setFilterServiceType(v); setPage(1); }

  // ── Print All ────────────────────────────────────────────────────────────────
  async function printAll() {
    if (!batchPkgs.length) return;
    const pages: string[] = [];
    for (const pkg of batchPkgs) {
      const qrValue = pkg.barcode || pkg.resiNumber || String(pkg.id);
      let qrDataUrl = "";
      try {
        qrDataUrl = await QRCode.toDataURL(qrValue, { width: 400, margin: 3 });
      } catch { continue; }
      const pkgDate = pkg.packageDate
        ? new Date(pkg.packageDate).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })
        : "-";
      pages.push(labelPageHtml(`${qrSectionHtml(qrDataUrl, qrValue)}
        <div class="info">
          <div class="cust">${pkg.customerName || "-"}</div>
          <div class="grid">
            <div class="field"><div class="fl">No. Resi</div><div class="fv mono">${pkg.resiNumber || "-"}</div></div>
            <div class="field"><div class="fl">No. Paket</div><div class="fv mono">${pkg.packageNumber || "-"}</div></div>
            <div class="field"><div class="fl">Tanggal</div><div class="fv">${pkgDate}</div></div>
            <div class="field"><div class="fl">Jenis Jastip</div><div class="fv">${pkg.serviceType ? pkg.serviceType.replace("jastip ", "Jastip ") : "-"}</div></div>
            <div class="field full"><div class="fl">Rute</div><div class="fv">${pkg.deliveryRoute || "-"}</div></div>
            <div class="field"><div class="fl">Berat Digunakan</div><div class="fv">${pkg.usedWeight != null ? pkg.usedWeight + " Kg" : "-"}</div></div>
            <div class="field"><div class="fl">Total Ongkir</div><div class="fv red">${pkg.totalShipping != null ? "Rp " + Number(pkg.totalShipping).toLocaleString("id-ID") : "-"}</div></div>
            <div class="field full"><div class="fl">Batch Pengiriman</div><div class="fv" style="color:#1d4ed8;">${batchLabel}</div></div>
          </div>
        </div>`));
    }
    if (!pages.length) return;
    const html = labelDocumentHtml(`Print Barcode — ${batchLabel}`, pages.join(""));
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="outline" size="icon" onClick={() => setLocation(`${base}/barcode`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className={`p-1.5 rounded-lg ${batch?.statusBatch === "OPEN" ? "bg-blue-100" : "bg-gray-100"}`}>
              <Ship className={`w-5 h-5 ${batch?.statusBatch === "OPEN" ? "text-blue-700" : "text-gray-500"}`} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{batch?.namaKapal || batchLabel}</h1>
            {batch && (
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${batchStatusColor(batch.statusBatch)}`}>
                {batchStatusIcon(batch.statusBatch)}
                {batchStatusLabel(batch.statusBatch)}
              </span>
            )}
          </div>
          {batch && (
            <p className="text-sm text-muted-foreground mt-1">
              {batch.kotaAsal} → {batch.tujuan}
              &nbsp;·&nbsp; ETD: {fmtDate(batch.etd)}
              &nbsp;·&nbsp; Closing: {fmtDate(batch.periodeClosingMulai)} – {fmtDate(batch.periodeClosingSelesai)}
            </p>
          )}
          <p className="text-sm text-muted-foreground mt-0.5">
            <span className="font-semibold text-foreground">{batchPkgs.length} paket</span>
            &nbsp;·&nbsp; Berat {totalWeight.toFixed(3)} Kg
            &nbsp;·&nbsp; Total Ongkir {formatRp(totalShipping)}
          </p>
        </div>
        <Button onClick={printAll} disabled={batchPkgs.length === 0} className="gap-2 shrink-0">
          <Printer className="h-4 w-4" /> Cetak Semua
        </Button>
      </div>

      {!selectedServiceType ? (
        /* ── Pilih Jenis Jastip ───────────────────────────────────────────────── */
        isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <Card key={i} className="animate-pulse"><CardContent className="h-40 pt-4 bg-muted/20" /></Card>)}
          </div>
        ) : svcStats.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <QrCode className="w-14 h-14 mx-auto mb-4 opacity-20" />
            <p className="font-semibold">Belum ada paket dalam batch ini</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {svcStats.map(svc => (
              <Card
                key={svc.key}
                className={`cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all border-2 ${svc.border} ${svc.bg}`}
                onClick={() => { setSelectedServiceType(svc.key); setSearch(""); setPage(1); }}
              >
                <CardContent className="pt-5 pb-4">
                  <p className={`text-sm font-bold leading-snug ${svc.num}`}>{svc.label}</p>
                  <div className="mt-3 space-y-1">
                    <div>
                      <span className={`text-3xl font-black ${svc.num}`}>{svc.count}</span>
                      <span className="text-sm text-muted-foreground ml-1">paket</span>
                    </div>
                    {svc.ongkir > 0 && <p className="text-xs font-semibold text-primary">{formatRp(svc.ongkir)}</p>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : (
        /* ── Barcode grid (per jenis jastip) ─────────────────────────────────── */
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => { setSelectedServiceType(null); setSearch(""); setPage(1); }}>
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Jenis Jastip
            </Button>
            <span className="text-base font-bold">{selectedSvcLabel}</span>
            <Badge variant="secondary">{filtered.length} paket</Badge>
          </div>

          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari resi, barcode, nama..."
              className="pl-9"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>

          {isLoading ? (
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {[1,2,3,4,5].map(i => <Card key={i} className="animate-pulse"><CardContent className="h-64 pt-4 bg-muted/20" /></Card>)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <QrCode className="w-14 h-14 mx-auto mb-4 opacity-20" />
              <p className="font-semibold text-base">Tidak ada paket yang cocok</p>
              {search && <p className="text-sm mt-1">Coba ubah kata kunci pencarian</p>}
            </div>
          ) : (
            <>
              <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {paginatedGroups.map((pkgs: any[]) => (
                  <GroupedBarcodeCard
                    key={`${pkgs[0]?.customerName}|${pkgs[0]?.serviceType}|${pkgs[0]?.batchId}`}
                    pkgs={pkgs}
                    batchLabel={batchLabel}
                  />
                ))}
              </div>
              <Pagination
                page={safePage}
                totalPages={totalPages}
                total={groupedFiltered.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </>
          )}
        </>
      )}

    </div>
  );
}
