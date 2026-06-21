import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/lib/auth";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import logoImg from "/logo.png";

const loginSchema = z.object({
  phone: z.string().min(5, "Nomor HP harus diisi minimal 5 karakter"),
  password: z.string().min(3, "Password harus diisi minimal 3 karakter"),
});

const demoAccounts = [
  { label: "Admin", role: "admin", phone: "081200000001", password: "admin123", color: "bg-blue-500" },
  { label: "Customer", role: "customer", phone: "081200000010", password: "customer123", color: "bg-green-500" },
  { label: "Owner", role: "owner", phone: "081200000000", password: "owner123", color: "bg-red-600" },
];

export default function Login() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      phone: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof loginSchema>) {
    try {
      setIsSubmitting(true);
      await login(values);
      toast({
        title: "Login berhasil",
        description: "Selamat datang kembali",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Login gagal",
        description: error.message || "Nomor HP atau password salah",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function fillDemo(phone: string, password: string) {
    form.setValue("phone", phone);
    form.setValue("password", password);
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-red-50 p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="flex flex-col items-center justify-center mb-6">
          <img
            src={logoImg}
            alt="Jastip Anggun Jaya"
            className="h-28 w-auto mb-3 drop-shadow-md"
          />
          <p className="text-muted-foreground text-sm text-center">Layanan Jastip & Ekspedisi Terpercaya</p>
        </div>

        {/* Demo Accounts Card */}
        <Card className="border-dashed border-2 border-muted bg-muted/20">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Akun Demo — Klik untuk isi otomatis
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="flex gap-2 flex-wrap">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.role}
                  type="button"
                  onClick={() => fillDemo(acc.phone, acc.password)}
                  className="flex flex-col items-start px-3 py-2 rounded-lg border bg-white hover:bg-muted/50 transition-colors text-left flex-1 min-w-[120px] shadow-sm"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`w-2 h-2 rounded-full ${acc.color}`} />
                    <span className="font-semibold text-sm">{acc.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">{acc.phone}</p>
                  <p className="text-xs text-muted-foreground font-mono">{acc.password}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-border/50">
          <CardHeader>
            <CardTitle>Masuk</CardTitle>
            <CardDescription>
              Silakan masuk dengan nomor HP dan password Anda
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nomor HP</FormLabel>
                      <FormControl>
                        <Input placeholder="0812xxxx" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full bg-red-600 hover:bg-red-700" disabled={isSubmitting}>
                  {isSubmitting ? "Memproses..." : "Masuk"}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex justify-center border-t border-border/50 p-4">
            <p className="text-sm text-muted-foreground">
              Belum punya akun?{" "}
              <Link href="/register" className="text-red-600 hover:underline font-medium">
                Daftar sekarang
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
