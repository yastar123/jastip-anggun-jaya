import { useListPackages } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, PackageCheck } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Cell, Pie, PieChart, Legend } from "recharts";
import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function formatRp(n: number) {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function getMonthKey(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function getMonthLabel(key: string) {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
}

const PIE_COLORS = ["#ef4444", "#f97316", "#22c55e", "#6b7280"];

export default function OwnerFinance() {
  const { data: packages, isLoading } = useListPackages();
  const [viewMonths, setViewMonths] = useState("6");

  const stats = useMemo(() => {
    const pkgs = packages || [];
    const totalOngkir = pkgs.reduce((s, p: any) => s + (Number(p.totalShipping) || 0), 0);
    const totalHarga = pkgs.reduce((s, p: any) => s + (Number(p.price) || 0), 0);
    const pickedUp = pkgs.filter((p: any) => p.status === "diserahkan");
    const ongkirCollected = pickedUp.reduce((s, p: any) => s + (Number(p.totalShipping) || 0), 0);

    // Monthly revenue
    const monthMap: Record<string, { ongkir: number; count: number }> = {};
    pkgs.forEach((p: any) => {
      const key = getMonthKey(p.packageDate || p.createdAt);
      if (!monthMap[key]) monthMap[key] = { ongkir: 0, count: 0 };
      monthMap[key].ongkir += Number(p.totalShipping) || 0;
      monthMap[key].count += 1;
    });
    const months = Object.keys(monthMap).sort().slice(-Number(viewMonths));
    const monthlyData = months.map(k => ({
      month: getMonthLabel(k),
      ongkir: monthMap[k].ongkir,
      paket: monthMap[k].count,
    }));

    // Status breakdown for pie
    const statusCount = { pending: 0, diserahkan: 0 };
    pkgs.forEach((p: any) => { if (statusCount.hasOwnProperty(p.status)) (statusCount as any)[p.status]++; });
    const pieData = [
      { name: "Pending", value: statusCount.pending },
      { name: "Diserahkan", value: statusCount.diserahkan },
    ].filter(d => d.value > 0);

    return { totalOngkir, totalHarga, ongkirCollected, monthlyData, pieData, totalPkgs: pkgs.length, pickedUpCount: pickedUp.length };
  }, [packages, viewMonths]);

  if (isLoading) return <div className="animate-pulse p-8">Memuat data keuangan...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Monitoring Keuangan</h1>
        <p className="text-muted-foreground mt-1">Pantau arus ongkir dan pendapatan bisnis Jastip Anggun Jaya.</p>
      </div>

      {/* KPI Cards — 2 status cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paket Diserahkan</CardTitle>
            <PackageCheck className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-green-600">{stats.pickedUpCount}</div>
            <p className="text-xs text-muted-foreground mt-1">paket</p>
            <p className="text-sm font-semibold text-green-700 mt-2">{formatRp(stats.ongkirCollected)}</p>
            <p className="text-xs text-muted-foreground">Total ongkir terkumpul</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paket Pending</CardTitle>
            <Package className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-amber-600">{stats.totalPkgs - stats.pickedUpCount}</div>
            <p className="text-xs text-muted-foreground mt-1">paket</p>
            <p className="text-sm font-semibold text-amber-700 mt-2">{formatRp(stats.totalOngkir - stats.ongkirCollected)}</p>
            <p className="text-xs text-muted-foreground">Ongkir belum terkumpul</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Monthly Revenue Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Ongkir Bulanan</CardTitle>
            <Select value={viewMonths} onValueChange={setViewMonths}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 Bulan</SelectItem>
                <SelectItem value="6">6 Bulan</SelectItem>
                <SelectItem value="12">12 Bulan</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {stats.monthlyData.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">Belum ada data</div>
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${(v/1000000).toFixed(0)}jt`} />
                    <Tooltip formatter={(v: any) => formatRp(v)} />
                    <Bar dataKey="ongkir" name="Total Ongkir" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Pie */}
        <Card>
          <CardHeader><CardTitle>Status Paket</CardTitle></CardHeader>
          <CardContent>
            {stats.pieData.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">Belum ada data</div>
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.pieData} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                      {stats.pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly Table */}
      {stats.monthlyData.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Detail Bulanan</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase">Bulan</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground uppercase">Jumlah Paket</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground uppercase">Total Ongkir</th>
                </tr>
              </thead>
              <tbody>
                {stats.monthlyData.map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/20">
                    <td className="py-2.5 px-3 font-medium">{row.month}</td>
                    <td className="py-2.5 px-3 text-right">{row.paket} paket</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-primary">{formatRp(row.ongkir)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-bold">
                  <td className="py-2.5 px-3">Total</td>
                  <td className="py-2.5 px-3 text-right">{stats.monthlyData.reduce((s,r)=>s+r.paket,0)} paket</td>
                  <td className="py-2.5 px-3 text-right text-primary">{formatRp(stats.monthlyData.reduce((s,r)=>s+r.ongkir,0))}</td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
