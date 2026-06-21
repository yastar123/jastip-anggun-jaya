import { useListPackages } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { History as HistoryIcon } from "lucide-react";

export default function CustomerHistory() {
  const { user } = useAuth();
  
  const { data: packages, isLoading } = useListPackages({
    customerId: user?.id,
    status: 'picked_up'
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Riwayat Pengambilan</h1>
        <p className="text-muted-foreground mt-1">Daftar paket yang sudah Anda ambil.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse">Memuat riwayat...</div>
          ) : packages && packages.length > 0 ? (
            <div className="divide-y">
              {packages.map((pkg) => (
                <div key={pkg.id} className="p-4 hover:bg-muted/30 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-lg">{pkg.itemName}</span>
                      <StatusBadge status={pkg.status} />
                    </div>
                    <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-2">
                      <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{pkg.resiNumber}</span>
                      <span>•</span>
                      <span>Diambil pada: {pkg.pickedUpAt ? format(new Date(pkg.pickedUpAt), 'dd MMM yyyy, HH:mm', { locale: id }) : '-'}</span>
                    </div>
                  </div>
                  <div className="text-sm text-right">
                    {pkg.weight && <div>Berat: {pkg.weight} kg</div>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <HistoryIcon className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg">Belum ada riwayat</h3>
              <p className="text-muted-foreground max-w-sm mt-1">
                Anda belum pernah mengambil paket.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
