import { useParams, useLocation } from "wouter";
import { useGetPackage, useUpdatePackage, useConfirmPickup, PackageUpdateStatus, getListPackagesQueryKey, getGetPackageQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Printer, CheckCircle, Package } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

export default function AdminPackagesDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pkg, isLoading } = useGetPackage(id, { query: { enabled: !!id } });
  const updatePackage = useUpdatePackage();
  const confirmPickup = useConfirmPickup();

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updatePackage.mutateAsync({
        id,
        data: { status: newStatus as PackageUpdateStatus }
      });
      
      queryClient.setQueryData(getGetPackageQueryKey(id), (old: any) => 
        old ? { ...old, status: newStatus } : old
      );
      queryClient.invalidateQueries({ queryKey: getListPackagesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      
      toast({ title: "Status diperbarui" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal", description: error.message });
    }
  };

  const handleConfirmPickup = async () => {
    try {
      await confirmPickup.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getGetPackageQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getListPackagesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      toast({ title: "Pengambilan Dikonfirmasi", description: "Paket telah diserahkan." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal", description: error.message });
    }
  };

  const printBarcode = () => {
    window.print();
  };

  if (isLoading) return <div className="p-8 text-center animate-pulse">Memuat detail paket...</div>;
  if (!pkg) return <div className="p-8 text-center text-destructive">Paket tidak ditemukan</div>;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4 print:hidden">
        <Button variant="outline" size="icon" onClick={() => setLocation("/admin/packages")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Detail Paket</h1>
          <p className="text-muted-foreground mt-1">{pkg.resiNumber}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="print:shadow-none print:border-none">
          <CardHeader className="print:hidden">
            <CardTitle>Informasi Paket</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6 md:pt-0">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Status</div>
              <div className="mt-1 flex items-center gap-4 print:hidden">
                <StatusBadge status={pkg.status} />
                {pkg.status !== 'picked_up' && (
                  <Select value={pkg.status} onValueChange={handleStatusChange}>
                    <SelectTrigger className="w-[180px] h-8 text-xs">
                      <SelectValue placeholder="Ubah status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Menunggu</SelectItem>
                      <SelectItem value="in_transit">Dalam Pengiriman</SelectItem>
                      <SelectItem value="ready">Siap Diambil</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="hidden print:block font-bold">{pkg.status}</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Barang</div>
                <div className="font-medium text-lg">{pkg.itemName}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Berat</div>
                <div>{pkg.weight ? `${pkg.weight} kg` : '-'}</div>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="text-sm font-medium text-muted-foreground">Customer</div>
              <div className="font-semibold text-lg text-primary">{pkg.customerName}</div>
              <div>{pkg.customerPhone}</div>
            </div>

            <div className="border-t pt-4 text-sm text-muted-foreground">
              <div className="grid grid-cols-2 gap-2">
                <div>Dibuat: {format(new Date(pkg.createdAt), 'dd MMM yyyy, HH:mm', { locale: localeId })}</div>
                {pkg.pickedUpAt && (
                  <div>Diambil: {format(new Date(pkg.pickedUpAt), 'dd MMM yyyy, HH:mm', { locale: localeId })}</div>
                )}
              </div>
            </div>

            {pkg.notes && (
              <div className="bg-muted p-3 rounded-md text-sm italic">
                "{pkg.notes}"
              </div>
            )}
          </CardContent>
          <CardFooter className="flex gap-2 print:hidden">
            {pkg.status === 'ready' && (
              <Button onClick={handleConfirmPickup} className="w-full bg-green-600 hover:bg-green-700 text-white">
                <CheckCircle className="w-4 h-4 mr-2" /> Konfirmasi Pengambilan
              </Button>
            )}
          </CardFooter>
        </Card>

        {/* Barcode Section */}
        <Card className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed print:border-solid print:border-black print:border-2">
          <Package className="w-12 h-12 text-muted-foreground mb-4 print:hidden" />
          <div className="font-mono text-sm text-muted-foreground mb-1">BARCODE / RESI</div>
          <div className="text-3xl font-bold tracking-widest font-mono p-4 border-4 border-black inline-block bg-white text-black mb-6">
            {pkg.barcode}
          </div>
          <div className="text-xl font-semibold mb-2">{pkg.customerName}</div>
          <div className="text-lg">{pkg.itemName}</div>
          
          <Button variant="outline" className="mt-8 print:hidden w-full" onClick={printBarcode}>
            <Printer className="w-4 h-4 mr-2" /> Print Label
          </Button>
        </Card>
      </div>
    </div>
  );
}
