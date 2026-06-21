import { useAuth } from "@/lib/auth";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import logoImg from "/logo.png";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  LogOut, Package, LayoutDashboard, ScanLine, History, Users, FileText,
  Settings, UserPlus, Barcode, FileSpreadsheet, FileInput, TrendingUp, Crown,
  Wrench,
} from "lucide-react";

type NavItem = { name: string; href: string; icon: any };
type NavSection = { label: string; items: NavItem[] };

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  if (!user) return <>{children}</>;

  const role = user.role;

  const flatNav: Record<string, NavItem[]> = {
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
  };

  // Owner gets two sections
  const ownerSections: NavSection[] = [
    {
      label: "Owner",
      items: [
        { name: "Dashboard", href: "/owner/dashboard", icon: LayoutDashboard },
        { name: "Monitor Paket", href: "/owner/packages", icon: Package },
        { name: "Data Customer", href: "/owner/customers", icon: Users },
        { name: "Data Admin", href: "/owner/admins", icon: UserPlus },
        { name: "Keuangan", href: "/owner/finance", icon: TrendingUp },
        { name: "Laporan", href: "/owner/reports", icon: FileText },
        { name: "Manajemen User", href: "/owner/users", icon: Settings },
      ],
    },
    {
      label: "Admin Tools",
      items: [
        { name: "Input Paket", href: "/owner/packages/new", icon: FileInput },
        { name: "Import Excel", href: "/owner/packages/import", icon: FileSpreadsheet },
        { name: "Label Barcode", href: "/owner/barcode", icon: Barcode },
        { name: "Scan Barcode", href: "/owner/scan", icon: ScanLine },
      ],
    },
  ];

  const isOwner = role === "owner";
  const navItems = flatNav[role as keyof typeof flatNav] || [];

  function isActive(href: string) {
    return location === href || location.startsWith(`${href}/`);
  }

  function renderNavItem(item: NavItem) {
    const active = isActive(item.href);
    return (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton asChild isActive={active} tooltip={item.name}>
          <Link href={item.href} className="flex items-center gap-3 w-full">
            <item.icon className="w-5 h-5" />
            <span>{item.name}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

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
            {isOwner ? (
              ownerSections.map((section) => (
                <div key={section.label} className="mb-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 mb-1">
                    {section.label === "Owner" ? <Crown className="w-3 h-3 text-amber-500" /> : <Wrench className="w-3 h-3 text-blue-500" />}
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {section.label}
                    </span>
                  </div>
                  <SidebarMenu>
                    {section.items.map(renderNavItem)}
                  </SidebarMenu>
                  {section.label !== ownerSections[ownerSections.length - 1].label && (
                    <div className="mx-3 mt-3 border-t border-border/40" />
                  )}
                </div>
              ))
            ) : (
              <SidebarMenu>
                {navItems.map(renderNavItem)}
              </SidebarMenu>
            )}
          </SidebarContent>
          <SidebarFooter className="p-4 border-t border-border/50">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col">
                <span className="font-medium text-sm">{user.name}</span>
                <span className="text-xs text-muted-foreground capitalize">{user.role}</span>
              </div>
              <Button variant="outline" className="w-full justify-start text-destructive" onClick={() => logout()}>
                <LogOut className="w-4 h-4 mr-2" />Keluar
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
