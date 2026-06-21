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
import { useToast } from "@/hooks/use-toast";
import logoImg from "/logo.png";

const loginSchema = z.object({
  phone: z.string().min(5, "Nomor HP harus diisi minimal 5 karakter"),
  password: z.string().min(3, "Password harus diisi minimal 3 karakter"),
});

const demoAccounts = [
  { label: "Admin", role: "admin", phone: "081200000001", password: "admin123", color: "bg-blue-500", desc: "Kelola paket & data" },
  { label: "Customer", role: "customer", phone: "081200000010", password: "customer123", color: "bg-green-500", desc: "Lacak kiriman Anda" },
  { label: "Owner", role: "owner", phone: "081200000000", password: "owner123", color: "bg-amber-500", desc: "Monitor bisnis" },
];

export default function Login() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: "", password: "" },
  });

  async function onSubmit(values: z.infer<typeof loginSchema>) {
    try {
      setIsSubmitting(true);
      await login(values);
      toast({ title: "Login berhasil", description: "Selamat datang kembali" });
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
    <div className="min-h-screen w-full flex">
      {/* LEFT PANEL — branding */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative bg-red-700 flex-col items-center justify-center overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-red-600/60" />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-red-800/70" />
        <div className="absolute top-1/3 right-10 w-48 h-48 rounded-full bg-red-500/40" />

        <div className="relative z-10 flex flex-col items-center text-center px-12 max-w-lg">
          <img src={logoImg} alt="Jastip Anggun Jaya" className="h-40 w-auto mb-8 drop-shadow-2xl rounded-2xl" />
          <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight mb-4">
            Jastip Anggun Jaya
          </h1>
          <p className="text-red-100 text-lg xl:text-xl leading-relaxed mb-8">
            Layanan jasa titip & ekspedisi terpercaya. Cepat, aman, dan terjangkau.
          </p>
          <div className="grid grid-cols-3 gap-4 w-full">
            {[
              { label: "Paket Terkirim", value: "10K+" },
              { label: "Customer Puas", value: "5K+" },
              { label: "Kota Terjangkau", value: "50+" },
            ].map((s) => (
              <div key={s.label} className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/20">
                <div className="text-2xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-red-200 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL — login form */}
      <div className="w-full lg:w-1/2 xl:w-2/5 flex flex-col items-center justify-center bg-white px-6 py-12 overflow-y-auto">
        {/* Mobile logo */}
        <div className="flex flex-col items-center mb-6 lg:hidden">
          <img src={logoImg} alt="Jastip Anggun Jaya" className="h-20 w-auto mb-2 rounded-xl" />
          <p className="text-muted-foreground text-sm">Jastip Anggun Jaya</p>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900">Selamat Datang</h2>
            <p className="text-muted-foreground mt-1">Masuk ke akun Anda untuk melanjutkan</p>
          </div>

          {/* Demo accounts */}
          <div className="mb-6 p-4 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Akun Demo — Klik untuk isi otomatis
            </p>
            <div className="grid grid-cols-3 gap-2">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.role}
                  type="button"
                  onClick={() => fillDemo(acc.phone, acc.password)}
                  className="flex flex-col items-start p-2.5 rounded-lg border bg-white hover:bg-gray-50 hover:border-red-300 transition-all text-left shadow-sm group"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`w-2 h-2 rounded-full ${acc.color}`} />
                    <span className="font-semibold text-xs text-gray-800">{acc.label}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono leading-tight">{acc.phone}</p>
                  <p className="text-[10px] text-muted-foreground font-mono leading-tight">{acc.password}</p>
                </button>
              ))}
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 font-medium">Nomor HP</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="0812xxxx"
                        className="h-11 border-gray-300 focus:border-red-500 focus:ring-red-500"
                        {...field}
                      />
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
                    <FormLabel className="text-gray-700 font-medium">Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        className="h-11 border-gray-300 focus:border-red-500 focus:ring-red-500"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-semibold text-base shadow-md hover:shadow-lg transition-all"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Memproses..." : "Masuk"}
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Belum punya akun?{" "}
              <Link href="/register" className="text-red-600 hover:text-red-700 font-semibold hover:underline">
                Daftar sekarang
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
