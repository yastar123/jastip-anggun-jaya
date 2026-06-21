import { useListPackages, PackageStatus } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Plus, Search, FileText } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AdminPackages() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [, setLocation] = useLocation();

  const { data: packages, isLoading } = useListPackages({
    search: search || undefined,
    status: status === "all" ? undefined : (status as PackageStatus)
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Semua Paket</h1>
          <p className="text-muted-foreground mt-1">Kelola data paket pelanggan.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/packages/import">
              <FileText className="w-4 h-4 mr-2" />
              Import Excel
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/packages/new">
              <Plus className="w-4 h-4 mr-2" />
              Input Paket Baru
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <div className="p-4 border-b flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari resi, nama barang, atau nama customer..."
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
                <TableHead>Resi / Barcode</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Barang</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tanggal Input</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
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
                  <TableRow key={pkg.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setLocation(`/admin/packages/${pkg.id}`)}>
                    <TableCell>
                      <div className="font-mono text-sm">{pkg.resiNumber}</div>
                      <div className="text-xs text-muted-foreground">{pkg.barcode}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{pkg.customerName}</div>
                      <div className="text-xs text-muted-foreground">{pkg.customerPhone}</div>
                    </TableCell>
                    <TableCell>
                      <div>{pkg.itemName}</div>
                      <div className="text-xs text-muted-foreground">{pkg.weight ? `${pkg.weight} kg` : '-'}</div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={pkg.status} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(pkg.createdAt), 'dd MMM yyyy', { locale: localeId })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">Detail</Button>
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
