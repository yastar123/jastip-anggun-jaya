import { useAuth } from "@/lib/auth";
import { useGetDashboardSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ScanLine, PackageCheck } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function CustomerDashboard() {
  const { user } = useAuth();
  const { data: summary, isLoading } = useGetDashboardSummary();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(2)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="h-4 w-1/3 bg-muted rounded"></CardTitle>
                <div className="h-4 w-4 bg-muted rounded-full"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 w-1/2 bg-muted rounded mb-2"></div>
                <div className="h-3 w-2/3 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Halo, {user?.name}!</h1>
          <p className="text-muted-foreground mt-1">Selamat datang di Jastip Anggun Jaya.</p>
        </div>
        <Button asChild className="bg-primary hover:bg-primary/90">
          <Link href="/customer/scan">
            <ScanLine className="mr-2 h-4 w-4" />
            Scan Paket
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paket Belum Diambil</CardTitle>
            <Package className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{summary?.pendingPackages || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Paket sedang dalam perjalanan atau siap diambil
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-secondary shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paket Sudah Diambil</CardTitle>
            <PackageCheck className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-secondary">{summary?.pickedUpPackages || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total paket yang telah Anda ambil
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">Aksi Cepat</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-primary/5 hover:bg-primary/10 transition-colors border-none shadow-none cursor-pointer">
            <Link href="/customer/packages">
              <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                  <Package className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg text-primary">Cek Paket Saya</h3>
                <p className="text-sm text-muted-foreground mt-1">Lihat status terbaru paket Anda</p>
              </CardContent>
            </Link>
          </Card>

          <Card className="bg-secondary/5 hover:bg-secondary/10 transition-colors border-none shadow-none cursor-pointer">
            <Link href="/customer/history">
              <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center mb-4">
                  <PackageCheck className="h-6 w-6 text-secondary" />
                </div>
                <h3 className="font-semibold text-lg text-secondary">Riwayat Pengambilan</h3>
                <p className="text-sm text-muted-foreground mt-1">Lihat riwayat paket yang sudah diambil</p>
              </CardContent>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
