import { useListPackages, PackageStatus } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { PackageOpen } from "lucide-react";

export default function CustomerPackages() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<string>("all");

  const statusFilter = filter === "all" ? undefined : (filter === "picked_up" ? 'picked_up' : 'pending'); // Just mapping roughly for UI demo, standard api filter handles standard statuses
  // Actually we need to filter multiple if filter is 'pending' (includes in_transit, ready, pending). The API param `status` is just a string.
  // We'll fetch all and filter in client for simplicity if API doesn't support complex status queries, but API supports status param.
  
  const { data: packages, isLoading } = useListPackages({
    customerId: user?.id,
  });

  const filteredPackages = packages?.filter(pkg => {
    if (filter === "all") return true;
    if (filter === "picked_up") return pkg.status === 'picked_up';
    if (filter === "pending") return pkg.status !== 'picked_up';
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Paket Saya</h1>
          <p className="text-muted-foreground mt-1">Pantau status paket Anda saat ini.</p>
        </div>
      </div>

      <Tabs defaultValue="all" value={filter} onValueChange={setFilter} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="all">Semua</TabsTrigger>
          <TabsTrigger value="pending">Belum Diambil</TabsTrigger>
          <TabsTrigger value="picked_up">Sudah Diambil</TabsTrigger>
        </TabsList>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground animate-pulse">Memuat data paket...</div>
            ) : filteredPackages && filteredPackages.length > 0 ? (
              <div className="divide-y">
                {filteredPackages.map((pkg) => (
                  <div key={pkg.id} className="p-4 hover:bg-muted/30 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-lg">{pkg.itemName}</span>
                        <StatusBadge status={pkg.status} />
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{pkg.resiNumber}</span>
                        <span>•</span>
                        <span>{format(new Date(pkg.createdAt), 'dd MMM yyyy, HH:mm', { locale: id })}</span>
                      </div>
                    </div>
                    <div className="text-sm text-right">
                      {pkg.weight && <div>Berat: {pkg.weight} kg</div>}
                      {pkg.notes && <div className="text-muted-foreground italic">"{pkg.notes}"</div>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <PackageOpen className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg">Tidak ada paket</h3>
                <p className="text-muted-foreground max-w-sm mt-1">
                  Anda tidak memiliki paket dalam kategori ini.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
