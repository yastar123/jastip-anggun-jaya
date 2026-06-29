import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/pagination";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { Banknote, CreditCard, Clock, History, ChevronDown, ChevronUp } from "lucide-react";

const PAGE_SIZE = 15;

function formatRp(n: any) {
  if (!n) return "Rp 0";
  return `Rp ${Number(n).toLocaleString("id-ID")}`;
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
  });
}
function formatTime(d: string) {
  return new Date(d).toLocaleTimeString("id-ID", {
    hour: "2-digit", minute: "2-digit",
  });
}

const PAYMENT_META: Record<string, { label: string; icon: any; badgeClass: string; rowClass: string }> = {
  tunai: {
    label: "Tunai",
    icon: Banknote,
    badgeClass: "bg-green-100 text-green-700 border-green-200",
    rowClass: "border-l-4 border-l-green-400",
  },
  transfer: {
    label: "Transfer",
    icon: CreditCard,
    badgeClass: "bg-blue-100 text-blue-700 border-blue-200",
    rowClass: "border-l-4 border-l-blue-400",
  },
  piutang: {
    label: "Piutang",
    icon: Clock,
    badgeClass: "bg-orange-100 text-orange-700 border-orange-200",
    rowClass: "border-l-4 border-l-orange-400",
  },
};

async function fetchPayments(paymentType: string) {
  const token = localStorage.getItem("jaj_token");
  const url = paymentType !== "all"
    ? `/api/payments?paymentType=${paymentType}`
    : "/api/payments";
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Gagal memuat data");
  return res.json();
}

export default function RiwayatPembayaran() {
  const [filterType, setFilterType] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: payments = [], isLoading, error } = useQuery({
    queryKey: ["payments", filterType],
    queryFn: () => fetchPayments(filterType),
  });

  const total = payments.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const paginated = payments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleFilter(v: string) {
    setFilterType(v);
    setPage(1);
    setExpandedId(null);
  }

  const totalTagihan = payments.reduce((s: number, p: any) => s + Number(p.totalAmount || 0), 0);
  const totalTunai = payments.filter((p: any) => p.paymentType === "tunai").reduce((s: number, p: any) => s + Number(p.totalAmount || 0), 0);
  const totalTransfer = payments.filter((p: any) => p.paymentType === "transfer").reduce((s: number, p: any) => s + Number(p.totalAmount || 0), 0);
  const totalPiutang = payments.filter((p: any) => p.paymentType === "piutang").reduce((s: number, p: any) => s + Number(p.totalAmount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <History className="h-7 w-7 text-primary" /> Riwayat Pembayaran
          </h1>
          <p className="text-muted-foreground mt-1">
            Rekap seluruh transaksi pembayaran dari Kalkulator Scan.
          </p>
        </div>
        <Select value={filterType} onValueChange={handleFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter Jenis" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Jenis</SelectItem>
            <SelectItem value="tunai">Tunai</SelectItem>
            <SelectItem value="transfer">Transfer</SelectItem>
            <SelectItem value="piutang">Piutang</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Semua", value: totalTagihan, color: "text-primary", bg: "bg-primary/5 border-primary/20" },
          { label: "Tunai", value: totalTunai, color: "text-green-700", bg: "bg-green-50 border-green-200" },
          { label: "Transfer", value: totalTransfer, color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
          { label: "Piutang", value: totalPiutang, color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
        ].map((s) => (
          <Card key={s.label} className={`border ${s.bg}`}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">{s.label}</p>
              <p className={`text-xl font-black mt-1 ${s.color}`}>{formatRp(s.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground">Memuat data...</div>
          ) : error ? (
            <div className="h-40 flex items-center justify-center text-destructive">Gagal memuat data pembayaran.</div>
          ) : paginated.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <History className="w-10 h-10 opacity-20" />
              <p>Belum ada riwayat pembayaran.</p>
            </div>
          ) : (
            <div className="divide-y">
              {paginated.map((p: any) => {
                const meta = PAYMENT_META[p.paymentType] || PAYMENT_META.tunai;
                const Icon = meta.icon;
                const isExpanded = expandedId === p.id;
                const pkgSummary: any[] = p.packageSummary || [];
                const pkgCount = Array.isArray(p.packageIds) ? p.packageIds.length : pkgSummary.length;

                return (
                  <div key={p.id} className={`${meta.rowClass} transition-colors hover:bg-muted/20`}>
                    <div
                      className="flex items-center gap-4 px-5 py-4 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : p.id)}
                    >
                      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-muted/50">
                        <Icon className="w-4 h-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={`text-xs ${meta.badgeClass}`}>
                            {meta.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {pkgCount} paket
                          </span>
                          {p.adminName && (
                            <span className="text-xs text-muted-foreground">· {p.adminName}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDate(p.createdAt)} — {formatTime(p.createdAt)}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-black text-base text-primary">{formatRp(p.totalAmount)}</p>
                        {p.paymentType === "tunai" && p.changeAmount != null && (
                          <p className="text-xs text-muted-foreground">
                            Kembalian: {formatRp(p.changeAmount)}
                          </p>
                        )}
                      </div>

                      <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7 text-muted-foreground">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </div>

                    {isExpanded && pkgSummary.length > 0 && (
                      <div className="px-5 pb-4">
                        <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Detail Paket</p>
                          {pkgSummary.map((pkg: any, i: number) => (
                            <div key={i} className="flex justify-between text-sm">
                              <div>
                                <span className="font-medium">{pkg.customerName}</span>
                                <span className="text-xs text-muted-foreground ml-2 font-mono">{pkg.resiNumber}</span>
                              </div>
                              <span className="font-semibold text-primary">{formatRp(pkg.totalShipping)}</span>
                            </div>
                          ))}
                          {p.paymentType === "tunai" && p.paidAmount != null && (
                            <div className="border-t pt-2 mt-2 flex justify-between text-xs text-muted-foreground">
                              <span>Dibayar: {formatRp(p.paidAmount)}</span>
                              <span>Kembalian: {formatRp(p.changeAmount)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
        {total > PAGE_SIZE && (
          <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
        )}
      </Card>
    </div>
  );
}
