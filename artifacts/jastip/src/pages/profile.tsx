import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import { User, KeyRound, Save, Loader2 } from "lucide-react";

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState(user?.name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  async function callProfileApi(body: object) {
    const token = localStorage.getItem("jaj_token");
    const r = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Terjadi kesalahan");
    return data;
  }

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSavingName(true);
    try {
      await callProfileApi({ name: name.trim() });
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast({ title: "Nama berhasil diperbarui" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message });
    } finally {
      setIsSavingName(false);
    }
  }

  async function handleSavePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({ variant: "destructive", title: "Lengkapi semua field password" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ variant: "destructive", title: "Password baru tidak cocok" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ variant: "destructive", title: "Password minimal 6 karakter" });
      return;
    }
    setIsSavingPassword(true);
    try {
      await callProfileApi({ currentPassword, newPassword });
      toast({ title: "Password berhasil diubah", description: "Silakan login ulang jika diperlukan." });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message });
    } finally {
      setIsSavingPassword(false);
    }
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profil Saya</h1>
        <p className="text-muted-foreground mt-1">Ubah nama dan password akun Anda.</p>
      </div>

      {/* Info akun */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-7 h-7 text-primary" />
            </div>
            <div>
              <div className="font-semibold text-lg">{user?.name}</div>
              <div className="text-sm text-muted-foreground">{user?.phone}</div>
              <div className="text-xs mt-0.5 capitalize px-2 py-0.5 bg-primary/10 text-primary rounded-full inline-block">{user?.role}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ganti Nama */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4" />Ganti Nama
          </CardTitle>
          <CardDescription>Perbarui nama tampilan akun Anda</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveName} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama Baru</Label>
              <Input
                id="name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Nama lengkap"
              />
            </div>
            <Button type="submit" disabled={isSavingName || !name.trim() || name.trim() === user?.name} className="w-full">
              {isSavingName ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Menyimpan...</> : <><Save className="w-4 h-4 mr-2" />Simpan Nama</>}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Ganti Password */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="w-4 h-4" />Ganti Password
          </CardTitle>
          <CardDescription>Masukkan password lama dan password baru Anda</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSavePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Password Lama</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Masukkan password lama"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Password Baru</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Konfirmasi Password Baru</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password baru"
              />
            </div>
            <Button type="submit" disabled={isSavingPassword || !currentPassword || !newPassword || !confirmPassword} className="w-full">
              {isSavingPassword ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Menyimpan...</> : <><KeyRound className="w-4 h-4 mr-2" />Simpan Password</>}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
