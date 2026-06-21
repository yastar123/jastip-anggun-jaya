import { useAuth } from "@/lib/auth";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import logoImg from "/logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  LogOut,
  Package,
  LayoutDashboard,
  ScanLine,
  History,
  Users,
  FileText,
  Settings,
  UserPlus,
  Barcode,
  FileSpreadsheet,
  FileInput,
} from "lucide-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  if (!user) {
    return <>{children}</>;
  }

  const role = user.role;

  const navigation = {
    customer: [
      { name: "Dashboard", href: "/customer/dashboard", icon: LayoutDashboard },
      { name: "Paket Saya", href: "/customer/packages", icon: Package },
      { name: "Scan Paket", href: "/customer/scan", icon: ScanLine },
      { name: "Riwayat", href: "/customer/history", icon: History },
    ],
    admin: [
      { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
      { name: "Semua Paket", href: "/admin/packages", icon: Package },
      { name: "Input Paket", href: "/admin/packages/new", icon: FileInput },
      { name: "Import Excel", href: "/admin/packages/import", icon: FileSpreadsheet },
      { name: "Label Barcode", href: "/admin/barcode", icon: Barcode },
      { name: "Scan Barcode", href: "/admin/scan", icon: ScanLine },
    ],
    owner: [
      { name: "Dashboard", href: "/owner/dashboard", icon: LayoutDashboard },
      { name: "Monitor Paket", href: "/owner/packages", icon: Package },
      { name: "Data Customer", href: "/owner/customers", icon: Users },
      { name: "Data Admin", href: "/owner/admins", icon: UserPlus },
      { name: "Laporan", href: "/owner/reports", icon: FileText },
      { name: "Manajemen User", href: "/owner/users", icon: Settings },
    ],
  };

  const navItems = navigation[role as keyof typeof navigation] || [];

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/20">
        <Sidebar className="border-r bg-sidebar">
          <SidebarHeader className="p-4 border-b border-border/50">
            <div className="flex items-center gap-3">
              <img src={logoImg} alt="Jastip Anggun Jaya" className="h-10 w-auto rounded" />
              <div className="flex flex-col">
                <span className="font-bold tracking-tight text-primary leading-tight">JASTIP</span>
                <span className="text-xs text-muted-foreground font-semibold leading-none">ANGGUN JAYA</span>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent className="p-2">
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location === item.href || location.startsWith(`${item.href}/`);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.name}>
                      <Link href={item.href} className="flex items-center gap-3 w-full">
                        <item.icon className="w-5 h-5" />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="p-4 border-t border-border/50">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col">
                <span className="font-medium text-sm">{user.name}</span>
                <span className="text-xs text-muted-foreground capitalize">{user.role}</span>
              </div>
              <Button variant="outline" className="w-full justify-start text-destructive" onClick={() => logout()}>
                <LogOut className="w-4 h-4 mr-2" />
                Keluar
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>
        <div className="flex-1 flex flex-col w-full overflow-hidden">
          <header className="h-14 border-b bg-background flex items-center px-4 md:px-6 sticky top-0 z-10">
            <SidebarTrigger className="mr-4 md:hidden" />
            <div className="flex-1" />
            <div className="text-sm font-medium text-muted-foreground">
              {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-6xl w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
