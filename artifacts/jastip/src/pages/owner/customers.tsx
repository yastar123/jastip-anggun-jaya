import { useListCustomers } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/pagination";

const PAGE_SIZE = 10;

export default function OwnerCustomers() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data: customers, isLoading } = useListCustomers({ search: search || undefined });

  const total = customers?.length || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const paginated = customers?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleSearch(v: string) { setSearch(v); setPage(1); }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Data Customer</h1>
        <p className="text-muted-foreground mt-1">Daftar pelanggan yang terdaftar di sistem.</p>
      </div>

      <Card>
        <div className="p-4 border-b flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cari nama atau nomor telepon..." className="pl-9" value={search} onChange={(e) => handleSearch(e.target.value)} />
          </div>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Pelanggan</TableHead>
                <TableHead>Nomor HP</TableHead>
                <TableHead className="text-center">Total Paket</TableHead>
                <TableHead className="text-center">Paket Pending</TableHead>
                <TableHead className="text-center">Paket Diambil</TableHead>
                <TableHead>Status Akun</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Memuat data...</TableCell></TableRow>
              ) : paginated && paginated.length > 0 ? (
                paginated.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>{customer.phone}</TableCell>
                    <TableCell className="text-center font-semibold">{customer.totalPackages}</TableCell>
                    <TableCell className="text-center text-orange-600">{customer.pendingPackages}</TableCell>
                    <TableCell className="text-center text-green-600">{customer.pickedUpPackages}</TableCell>
                    <TableCell>
                      {customer.isActive ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Aktif</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Nonaktif</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">Data customer tidak ditemukan.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </Card>
    </div>
  );
}
