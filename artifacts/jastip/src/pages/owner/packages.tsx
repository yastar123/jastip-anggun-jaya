import { useListPackages, PackageStatus } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { useState } from "react";
import { Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

export default function OwnerPackages() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");

  const { data: packages, isLoading } = useListPackages({
    search: search || undefined,
    status: status === "all" ? undefined : (status as PackageStatus)
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monitor Paket</h1>
          <p className="text-muted-foreground mt-1">Pantau pergerakan seluruh paket dalam sistem.</p>
        </div>
      </div>

      <Card>
        <div className="p-4 border-b flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari resi, barang, customer..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="Filter Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="pending">Menunggu</SelectItem>
              <SelectItem value="in_transit">Dalam Pengiriman</SelectItem>
              <SelectItem value="ready">Siap Diambil</SelectItem>
              <SelectItem value="picked_up">Sudah Diambil</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Resi</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Barang</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Admin Input</TableHead>
                <TableHead>Tanggal Input</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Memuat data...
                  </TableCell>
                </TableRow>
              ) : packages && packages.length > 0 ? (
                packages.map((pkg) => (
                  <TableRow key={pkg.id}>
                    <TableCell>
                      <div className="font-mono text-sm">{pkg.resiNumber}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{pkg.customerName}</div>
                      <div className="text-xs text-muted-foreground">{pkg.customerPhone}</div>
                    </TableCell>
                    <TableCell>
                      <div>{pkg.itemName}</div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={pkg.status} />
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{pkg.adminName || '-'}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(pkg.createdAt), 'dd MMM yyyy, HH:mm', { locale: localeId })}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    Data paket tidak ditemukan.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
