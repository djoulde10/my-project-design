import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppDataProvider, useAppData } from "@/contexts/AppDataContext";
import { usePermissions } from "@/hooks/usePermissions";
import { getRequiredPermissions } from "@/lib/routePermissions";
import { useIsDirectionMember } from "@/hooks/useIsDirectionMember";
import AppLayout from "@/components/AppLayout";
import AdminLayout from "@/components/AdminLayout";
import Auth from "@/pages/Auth";
import AccessDenied from "@/pages/AccessDenied";
import CompanyBrandingTheme from "@/components/CompanyBrandingTheme";
import PageSkeleton from "@/components/PageSkeleton";
import { prefetchRouteData } from "@/lib/pagePrefetch";

// Lazy-loaded pages — split bundles, faster initial load.
// Each loader is exported on `window.__preload` so the sidebar can warm
// the chunk on hover for an instant navigation feel.
const lazyPage = <T extends { default: React.ComponentType<any> }>(
  key: string,
  loader: () => Promise<T>,
) => {
  if (typeof window !== "undefined") {
    (window as any).__preload = (window as any).__preload ?? {};
    (window as any).__preload[key] = loader;
  }
  return lazy(loader);
};

const ResetPassword = lazyPage("/reset-password", () => import("@/pages/ResetPassword"));
const Dashboard = lazyPage("/", () => import("@/pages/Dashboard"));
const Sessions = lazyPage("/sessions", () => import("@/pages/Sessions"));
const Members = lazyPage("/members", () => import("@/pages/Members"));
const Documents = lazyPage("/documents", () => import("@/pages/Documents"));
const Decisions = lazyPage("/decisions", () => import("@/pages/Decisions"));
const Meetings = lazyPage("/meetings", () => import("@/pages/Meetings"));
const Actions = lazyPage("/actions", () => import("@/pages/Actions"));
const CalendarPage = lazyPage("/calendar", () => import("@/pages/Calendar"));
const AuditMeetings = lazyPage("/audit-meetings", () => import("@/pages/AuditMeetings"));
const Archives = lazyPage("/archives", () => import("@/pages/Archives"));
const AuditLog = lazyPage("/audit", () => import("@/pages/AuditLog"));
const UserManagement = lazyPage("/users", () => import("@/pages/UserManagement"));
const MemberProfile = lazyPage("/members/:id", () => import("@/pages/MemberProfile"));
const ApiKeys = lazyPage("/api-keys", () => import("@/pages/ApiKeys"));
const ApiDocs = lazyPage("/api-docs", () => import("@/pages/ApiDocs"));
const OrganizationSettings = lazyPage("/settings", () => import("@/pages/OrganizationSettings"));
const HelpCenter = lazyPage("/help", () => import("@/pages/HelpCenter"));
const ConvocationView = lazyPage("/convocation", () => import("@/pages/ConvocationView"));
const NotFound = lazyPage("/404", () => import("./pages/NotFound"));
const AuthenticatedAppShell = lazyPage("authenticated-shell", () => import("@/components/AuthenticatedAppShell"));

// Admin pages (lazy)
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminOrganizations = lazy(() => import("@/pages/admin/AdminOrganizations"));
const AdminPlans = lazy(() => import("@/pages/admin/AdminPlans"));
const AdminAnalytics = lazy(() => import("@/pages/admin/AdminAnalytics"));
const AdminBilling = lazy(() => import("@/pages/admin/AdminBilling"));
const AdminLogs = lazy(() => import("@/pages/admin/AdminLogs"));
const AdminSettings = lazy(() => import("@/pages/admin/AdminSettings"));
const AdminFeatureFlags = lazy(() => import("@/pages/admin/AdminFeatureFlags"));
const AdminSupport = lazy(() => import("@/pages/admin/AdminSupport"));
const AdminSecurity = lazy(() => import("@/pages/admin/AdminSecurity"));
const AdminMonitoring = lazy(() => import("@/pages/admin/AdminMonitoring"));
const AdminApiManagement = lazy(() => import("@/pages/admin/AdminApiManagement"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 1,
    },
  },
});

if (typeof window !== "undefined") {
  (window as any).__prefetchRouteData = (path: string) => prefetchRouteData(path, queryClient);
}

const PageFallback = () => <PageSkeleton />;

// CA-only routes that "Membre de la Direction" cannot access
const directionBlockedPaths = ["/sessions", "/members", "/calendar"];

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { permissions, loading: permLoading } = usePermissions();
  const isDirectionMember = useIsDirectionMember();
  const location = useLocation();

  if (loading || permLoading) return <PageSkeleton />;
  if (!user) return <Navigate to="/auth" replace />;

  // Block "Membre de la Direction" from CA-only routes
  if (isDirectionMember && directionBlockedPaths.some(p => location.pathname === p || location.pathname.startsWith(p + "/"))) {
    return <AppLayout><AccessDenied /></AppLayout>;
  }

  const required = getRequiredPermissions(location.pathname);
  if (required && !required.some((p) => permissions.includes(p))) {
    return <AppLayout><AccessDenied /></AppLayout>;
  }

  return <AppLayout><Suspense fallback={<PageFallback />}>{children}</Suspense></AppLayout>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { loading: appLoading } = useAppData();
  if (loading || appLoading) return <PageSkeleton />;
  if (!user) return <Navigate to="/auth" replace />;
  return <AdminLayout><Suspense fallback={<PageFallback />}>{children}</Suspense></AdminLayout>;
}

function AuthRoute() {
  const { user, loading } = useAuth();
  if (loading) return <PageSkeleton />;
  if (user) return <Navigate to="/" replace />;
  return <Auth />;
}

function ProtectedApp() {
  const { user } = useAuth();
  const routes = (
    <Routes>
      <Route path="/auth" element={<AuthRoute />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/convocation/:token" element={<ConvocationView />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/sessions" element={<ProtectedRoute><Sessions /></ProtectedRoute>} />
      <Route path="/members" element={<ProtectedRoute><Members /></ProtectedRoute>} />
      <Route path="/members/:id" element={<ProtectedRoute><MemberProfile /></ProtectedRoute>} />

      <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
      <Route path="/minutes" element={<Navigate to="/meetings" replace />} />
      <Route path="/meetings" element={<ProtectedRoute><Meetings /></ProtectedRoute>} />
      <Route path="/decisions" element={<ProtectedRoute><Decisions /></ProtectedRoute>} />
      <Route path="/actions" element={<ProtectedRoute><Actions /></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
      <Route path="/audit-meetings" element={<ProtectedRoute><AuditMeetings /></ProtectedRoute>} />

      <Route path="/archives" element={<ProtectedRoute><Archives /></ProtectedRoute>} />
      <Route path="/audit" element={<ProtectedRoute><AuditLog /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
      <Route path="/api-keys" element={<ProtectedRoute><ApiKeys /></ProtectedRoute>} />
      <Route path="/api-docs" element={<ProtectedRoute><ApiDocs /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><OrganizationSettings /></ProtectedRoute>} />
      <Route path="/help" element={<ProtectedRoute><HelpCenter /></ProtectedRoute>} />

      {/* Super Admin routes */}
      <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      <Route path="/admin/organizations" element={<AdminRoute><AdminOrganizations /></AdminRoute>} />
      <Route path="/admin/plans" element={<AdminRoute><AdminPlans /></AdminRoute>} />
      <Route path="/admin/analytics" element={<AdminRoute><AdminAnalytics /></AdminRoute>} />
      <Route path="/admin/billing" element={<AdminRoute><AdminBilling /></AdminRoute>} />
      <Route path="/admin/logs" element={<AdminRoute><AdminLogs /></AdminRoute>} />
      <Route path="/admin/settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
      <Route path="/admin/features" element={<AdminRoute><AdminFeatureFlags /></AdminRoute>} />
      <Route path="/admin/support" element={<AdminRoute><AdminSupport /></AdminRoute>} />
      <Route path="/admin/security" element={<AdminRoute><AdminSecurity /></AdminRoute>} />
      <Route path="/admin/monitoring" element={<AdminRoute><AdminMonitoring /></AdminRoute>} />
      <Route path="/admin/api" element={<AdminRoute><AdminApiManagement /></AdminRoute>} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );

  return (
    <Suspense fallback={<PageFallback />}>
      {user ? <AuthenticatedAppShell>{routes}</AuthenticatedAppShell> : routes}
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppDataProvider>
            <CompanyBrandingTheme />
            <ProtectedApp />
          </AppDataProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
