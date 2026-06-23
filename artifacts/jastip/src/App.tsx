import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/layout";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";

import Login from "@/pages/login";
import Register from "@/pages/register";

import CustomerDashboard from "@/pages/customer/dashboard";
import CustomerPackages from "@/pages/customer/packages";
import CustomerScan from "@/pages/customer/scan";
import CustomerHistory from "@/pages/customer/history";

import AdminDashboard from "@/pages/admin/dashboard";
import AdminPackages from "@/pages/admin/packages";
import AdminPackagesNew from "@/pages/admin/packages-new";
import AdminPackagesType from "@/pages/admin/packages-type";
import AdminPackagesImport from "@/pages/admin/packages-import";
import AdminPackagesDetail from "@/pages/admin/packages-detail";
import AdminBarcode from "@/pages/admin/barcode";
import AdminScan from "@/pages/admin/scan";

import OwnerDashboard from "@/pages/owner/dashboard";
import OwnerPackages from "@/pages/owner/packages";
import OwnerCustomers from "@/pages/owner/customers";
import OwnerAdmins from "@/pages/owner/admins";
import OwnerReports from "@/pages/owner/reports";
import OwnerUsers from "@/pages/owner/users";
import OwnerFinance from "@/pages/owner/finance";
import ProfilePage from "@/pages/profile";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component, roles, role, ...rest }: any) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Accept single role or array of roles
  const allowedRoles: string[] = roles ? roles : role ? [role] : [];

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        setLocation("/login");
      } else if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        setLocation(`/${user.role}/dashboard`);
      }
    }
  }, [user, isLoading, setLocation]);

  if (isLoading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-muted/20">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-4xl animate-pulse shadow-lg">
            J
          </div>
          <div className="text-muted-foreground animate-pulse">
            Memuat data...
          </div>
        </div>
      </div>
    );
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) return null;

  return (
    <AppLayout>
      <Component {...rest} />
    </AppLayout>
  );
}

function RedirectToDashboard() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        setLocation(`/${user.role}/dashboard`);
      } else {
        setLocation("/login");
      }
    }
  }, [user, isLoading, setLocation]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-muted/20">
      <div className="w-16 h-16 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-4xl animate-pulse shadow-lg">
        J
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={RedirectToDashboard} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />

      {/* Customer Routes */}
      <Route path="/customer/dashboard">
        {(params) => (
          <ProtectedRoute
            role="customer"
            component={CustomerDashboard}
            params={params}
          />
        )}
      </Route>
      <Route path="/customer/packages">
        {(params) => (
          <ProtectedRoute
            role="customer"
            component={CustomerPackages}
            params={params}
          />
        )}
      </Route>
      <Route path="/customer/scan">
        {(params) => (
          <ProtectedRoute
            role="customer"
            component={CustomerScan}
            params={params}
          />
        )}
      </Route>
      <Route path="/customer/history">
        {(params) => (
          <ProtectedRoute
            role="customer"
            component={CustomerHistory}
            params={params}
          />
        )}
      </Route>

      {/* Admin Routes */}
      <Route path="/admin/dashboard">
        {(params) => (
          <ProtectedRoute
            role="admin"
            component={AdminDashboard}
            params={params}
          />
        )}
      </Route>
      <Route path="/admin/packages">
        {(params) => (
          <ProtectedRoute
            role="admin"
            component={AdminPackages}
            params={params}
          />
        )}
      </Route>
      <Route path="/admin/packages/type">
        {(params) => (
          <ProtectedRoute
            role="admin"
            component={AdminPackagesType}
            params={params}
          />
        )}
      </Route>
      <Route path="/admin/packages/new">
        {(params) => (
          <ProtectedRoute
            role="admin"
            component={AdminPackagesNew}
            params={params}
          />
        )}
      </Route>
      <Route path="/admin/packages/import">
        {(params) => (
          <ProtectedRoute
            role="admin"
            component={AdminPackagesImport}
            params={params}
          />
        )}
      </Route>
      <Route path="/admin/packages/:id">
        {(params) => (
          <ProtectedRoute
            role="admin"
            component={AdminPackagesDetail}
            params={params}
          />
        )}
      </Route>
      <Route path="/admin/barcode">
        {(params) => (
          <ProtectedRoute
            role="admin"
            component={AdminBarcode}
            params={params}
          />
        )}
      </Route>
      <Route path="/admin/scan">
        {(params) => (
          <ProtectedRoute role="admin" component={AdminScan} params={params} />
        )}
      </Route>

      {/* Owner Routes */}
      <Route path="/owner/dashboard">
        {(params) => (
          <ProtectedRoute
            role="owner"
            component={OwnerDashboard}
            params={params}
          />
        )}
      </Route>
      <Route path="/owner/packages">
        {(params) => (
          <ProtectedRoute
            role="owner"
            component={OwnerPackages}
            params={params}
          />
        )}
      </Route>
      <Route path="/owner/customers">
        {(params) => (
          <ProtectedRoute
            role="owner"
            component={OwnerCustomers}
            params={params}
          />
        )}
      </Route>
      <Route path="/owner/admins">
        {(params) => (
          <ProtectedRoute
            role="owner"
            component={OwnerAdmins}
            params={params}
          />
        )}
      </Route>
      <Route path="/owner/reports">
        {(params) => (
          <ProtectedRoute
            role="owner"
            component={OwnerReports}
            params={params}
          />
        )}
      </Route>
      <Route path="/owner/users">
        {(params) => (
          <ProtectedRoute role="owner" component={OwnerUsers} params={params} />
        )}
      </Route>
      <Route path="/owner/finance">
        {(params) => (
          <ProtectedRoute
            role="owner"
            component={OwnerFinance}
            params={params}
          />
        )}
      </Route>

      {/* Profile routes — all roles */}
      <Route path="/customer/profile">
        {(params) => (
          <ProtectedRoute
            role="customer"
            component={ProfilePage}
            params={params}
          />
        )}
      </Route>
      <Route path="/admin/profile">
        {(params) => (
          <ProtectedRoute
            role="admin"
            component={ProfilePage}
            params={params}
          />
        )}
      </Route>
      <Route path="/owner/profile">
        {(params) => (
          <ProtectedRoute
            role="owner"
            component={ProfilePage}
            params={params}
          />
        )}
      </Route>

      {/* Owner — Admin Tools (same components, both roles allowed) */}
      <Route path="/owner/packages/type">
        {(params) => (
          <ProtectedRoute
            role="owner"
            component={AdminPackagesType}
            params={params}
          />
        )}
      </Route>
      <Route path="/owner/packages/new">
        {(params) => (
          <ProtectedRoute
            role="owner"
            component={AdminPackagesNew}
            params={params}
          />
        )}
      </Route>
      <Route path="/owner/packages/import">
        {(params) => (
          <ProtectedRoute
            role="owner"
            component={AdminPackagesImport}
            params={params}
          />
        )}
      </Route>
      <Route path="/owner/barcode">
        {(params) => (
          <ProtectedRoute
            role="owner"
            component={AdminBarcode}
            params={params}
          />
        )}
      </Route>
      <Route path="/owner/scan">
        {(params) => (
          <ProtectedRoute role="owner" component={AdminScan} params={params} />
        )}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
