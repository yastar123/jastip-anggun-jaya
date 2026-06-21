import { useState } from "react";
import { useListAdmins, useCreateAdmin, useToggleAdminActive, useResetAdminPassword, getListAdminsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { UserPlus, Power, KeyRound } from "lucide-react";

export default function OwnerUsers() {
  const { data: admins, isLoading } = useListAdmins();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createAdmin = useCreateAdmin();
  const toggleActive = useToggleAdminActive();
  const resetPassword = useResetAdminPassword();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ name: "", phone: "", password: "" });

  const [resetId, setResetId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const handleAddAdmin = async () => {
    try {
      await createAdmin.mutateAsync({ data: newAdmin });
      queryClient.invalidateQueries({ queryKey: getListAdminsQueryKey() });
      toast({ title: "Berhasil", description: "Admin baru ditambahkan." });
      setIsAddOpen(false);
      setNewAdmin({ name: "", phone: "", password: "" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message });
    }
  };

  const handleToggleActive = async (id: number) => {
    try {
      await toggleActive.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListAdminsQueryKey() });
      toast({ title: "Status diperbarui" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message });
    }
  };

  const handleResetPassword = async () => {
    if (!resetId) return;
    try {
      await resetPassword.mutateAsync({ id: resetId, data: { newPassword } });
      toast({ title: "Berhasil", description: "Password direset." });
      setResetId(null);
      setNewPassword("");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manajemen User</h1>
          <p className="text-muted-foreground mt-1">Kelola akses akun admin.</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="w-4 h-4 mr-2" /> Tambah Admin
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah Admin Baru</DialogTitle>
              <DialogDescription>Tambahkan staff admin baru ke dalam sistem.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nama Lengkap</Label>
                <Input value={newAdmin.name} onChange={e => setNewAdmin({...newAdmin, name: e.target.value})} placeholder="Nama staff" />
              </div>
              <div className="space-y-2">
                <Label>Nomor HP (Username)</Label>
                <Input value={newAdmin.phone} onChange={e => setNewAdmin({...newAdmin, phone: e.target.value})} placeholder="0812..." />
              </div>
              <div className="space-y-2">
                <Label>Password Default</Label>
                <Input type="password" value={newAdmin.password} onChange={e => setNewAdmin({...newAdmin, password: e.target.value})} placeholder="***" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Batal</Button>
              <Button onClick={handleAddAdmin} disabled={createAdmin.isPending || !newAdmin.name || !newAdmin.phone || !newAdmin.password}>
                Simpan Admin
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Nomor HP</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Memuat data...</TableCell>
                </TableRow>
              ) : admins && admins.length > 0 ? (
                admins.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell className="font-medium">{admin.name}</TableCell>
                    <TableCell>{admin.phone}</TableCell>
                    <TableCell>
                      {admin.isActive ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Aktif</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Nonaktif</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleToggleActive(admin.id)}>
                        <Power className="w-4 h-4 mr-2" /> {admin.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      </Button>
                      <Dialog open={resetId === admin.id} onOpenChange={(open) => !open && setResetId(null)}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => setResetId(admin.id)}>
                            <KeyRound className="w-4 h-4 mr-2" /> Reset Pass
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Reset Password</DialogTitle>
                            <DialogDescription>Reset password untuk admin {admin.name}.</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>Password Baru</Label>
                              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="***" />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setResetId(null)}>Batal</Button>
                            <Button onClick={handleResetPassword} disabled={resetPassword.isPending || !newPassword}>
                              Simpan Password
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">Belum ada admin.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
