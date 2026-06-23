import { useGetDashboardSummary, useGetDashboardChart, useListPackages } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, PackageCheck, PackagePlus, Users, UserCog, DollarSign } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useLocation } from "wouter";

function formatRp(n: number | null | undefined) {
  if (!n) return "-";
  return `Rp ${Number(n).toLocaleString("id-ID")}`;
}
function formatDate(d: string | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}
const statusStyles: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  diserahkan: "bg-green-100 text-green-800",
};

export default function OwnerDashboard() {
  const { data: summary, isLoading: isSummaryLoading } = useGetDashboardSummary();
  const [period, setPeriod] = useState<"week" | "month" | "year">("week");
  const { data: chartData, isLoading: isChartLoading } = useGetDashboardChart({ period });
  const { data: allPackages, isLoading: isPackagesLoading } = useListPackages();
  const [, setLocation] = useLocation();

  const totalOngkir = (allPackages || []).reduce((s: number, p: any) => s + (Number(p.totalShipping) || 0), 0);
  const recentPackages = [...(allPackages || [])]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 10);

  if (isSummaryLoading) return <div className="animate-pulse p-8">Memuat dashboard...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Dashboard Owner</h1>
        <p className="text-muted-foreground mt-1">Ringkasan bisnis Jastip Anggun Jaya.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paket</CardTitle>
            <PackagePlus className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary?.totalPackages || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Semua paket dalam sistem</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Belum Diambil</CardTitle>
            <Package className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary?.pendingPackages || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Menunggu pengambilan</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sudah Diambil</CardTitle>
            <PackageCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary?.pickedUpPackages || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Telah diserahkan</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pelanggan</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary?.totalCustomers || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Customer terdaftar</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Admin</CardTitle>
            <UserCog className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary?.totalAdmins || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Admin aktif</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ongkir</CardTitle>
            <DollarSign className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatRp(totalOngkir)}</div>
            <p className="text-xs text-muted-foreground mt-1">Dari semua paket</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Tren Paket</CardTitle>
          <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Pilih Periode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">7 Hari Terakhir</SelectItem>
              <SelectItem value="month">Bulan Ini</SelectItem>
              <SelectItem value="year">Tahun Ini</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isChartLoading ? (
            <div className="h-[260px] w-full flex items-center justify-center text-muted-foreground">Memuat grafik...</div>
          ) : (
            <div className="h-[260px] w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData || []}>
                  <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip wrapperClassName="text-sm" />
                  <Legend />
                  <Bar dataKey="incoming" name="Masuk" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
                  <Bar dataKey="outgoing" name="Keluar" fill="hsl(var(--secondary))" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Packages */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Data Paket Terbaru</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">10 paket terakhir</p>
          </div>
          <button onClick={() => setLocation("/owner/packages")} className="text-sm text-primary hover:underline font-medium">
            Lihat semua →
          </button>
        </CardHeader>
        <CardContent>
          {isPackagesLoading ? (
            <div className="space-y-3">{Array.from({length:4}).map((_,i)=><div key={i} className="h-10 bg-muted/40 rounded animate-pulse"/>)}</div>
          ) : recentPackages.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-20"/><p className="text-sm">Belum ada data paket</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    {["Tanggal","No Resi","No Paket","Nama Konsumen","Berat Digunakan","Total Ongkir","Status"].map(h=>(
                      <th key={h} className="text-left py-3 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentPackages.map((pkg:any) => (
                    <tr key={pkg.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-2 text-muted-foreground whitespace-nowrap">{formatDate(pkg.packageDate || pkg.createdAt)}</td>
                      <td className="py-3 px-2 font-mono font-medium whitespace-nowrap">{pkg.resiNumber||"-"}</td>
                      <td className="py-3 px-2 font-mono whitespace-nowrap">{pkg.packageNumber||"-"}</td>
                      <td className="py-3 px-2 whitespace-nowrap">{pkg.customerName||"-"}</td>
                      <td className="py-3 px-2 whitespace-nowrap">{pkg.usedWeight?`${pkg.usedWeight} Kg`:"-"}</td>
                      <td className="py-3 px-2 font-semibold whitespace-nowrap">{pkg.totalShipping ? `Rp ${Number(pkg.totalShipping).toLocaleString("id-ID")}` : "-"}</td>
                      <td className="py-3 px-2">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[pkg.status]||"bg-gray-100 text-gray-700"}`}>{pkg.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
