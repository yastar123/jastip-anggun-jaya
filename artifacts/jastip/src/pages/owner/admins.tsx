import { useListAdmins } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

export default function OwnerAdmins() {
  const { data: admins, isLoading } = useListAdmins();

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Data Admin</h1>
          <p className="text-muted-foreground mt-1">Performa staf admin.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Admin</TableHead>
                <TableHead>Nomor HP</TableHead>
                <TableHead className="text-center">Paket Diinput</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Bergabung</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Memuat data...
                  </TableCell>
                </TableRow>
              ) : admins && admins.length > 0 ? (
                admins.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell className="font-medium">
                      {admin.name}
                    </TableCell>
                    <TableCell>
                      {admin.phone}
                    </TableCell>
                    <TableCell className="text-center font-semibold text-primary">
                      {admin.packagesInputted}
                    </TableCell>
                    <TableCell>
                      {admin.isActive ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Aktif</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Nonaktif</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {admin.createdAt ? format(new Date(admin.createdAt), 'dd MMM yyyy', { locale: localeId }) : '-'}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    Data admin tidak ditemukan.
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
