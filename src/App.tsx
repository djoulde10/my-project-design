import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import AppLayout from "@/components/AppLayout";
import AdminLayout from "@/components/AdminLayout";
import Auth from "@/pages/Auth";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import Sessions from "@/pages/Sessions";
import Members from "@/pages/Members";
import AgendaItems from "@/pages/AgendaItems";
import Documents from "@/pages/Documents";
import Decisions from "@/pages/Decisions";
import Meetings from "@/pages/Meetings";
import Actions from "@/pages/Actions";
import CalendarPage from "@/pages/Calendar";
import ConflictOfInterest from "@/pages/ConflictOfInterest";
import Archives from "@/pages/Archives";
import AuditLog from "@/pages/AuditLog";
import UserManagement from "@/pages/UserManagement";
import MemberProfile from "@/pages/MemberProfile";
import Approvals from "@/pages/Approvals";
import PermissionsManagement from "@/pages/PermissionsManagement";
import NotFound from "./pages/NotFound";
import AIAssistant from "@/components/AIAssistant";

// Admin pages
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminOrganizations from "@/pages/admin/AdminOrganizations";
import AdminPlans from "@/pages/admin/AdminPlans";
import AdminAnalytics from "@/pages/admin/AdminAnalytics";
import AdminBilling from "@/pages/admin/AdminBilling";
import AdminLogs from "@/pages/admin/AdminLogs";
import AdminSettings from "@/pages/admin/AdminSettings";
import AdminFeatureFlags from "@/pages/admin/AdminFeatureFlags";
import AdminSupport from "@/pages/admin/AdminSupport";
import AdminSecurity from "@/pages/admin/AdminSecurity";
import AdminMonitoring from "@/pages/admin/AdminMonitoring";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen text-muted-foreground">Chargement...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen text-muted-foreground">Chargement...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <AdminLayout>{children}</AdminLayout>;
}

function AuthRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen text-muted-foreground">Chargement...</div>;
  if (user) return <Navigate to="/" replace />;
  return <Auth />;
}

function ProtectedApp() {
  const { user } = useAuth();
  return (
    <>
      <Routes>
        <Route path="/auth" element={<AuthRoute />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/sessions" element={<ProtectedRoute><Sessions /></ProtectedRoute>} />
        <Route path="/members" element={<ProtectedRoute><Members /></ProtectedRoute>} />
        <Route path="/members/:id" element={<ProtectedRoute><MemberProfile /></ProtectedRoute>} />
        <Route path="/agenda" element={<ProtectedRoute><AgendaItems /></ProtectedRoute>} />
        <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
        <Route path="/minutes" element={<Navigate to="/meetings" replace />} />
        <Route path="/meetings" element={<ProtectedRoute><Meetings /></ProtectedRoute>} />
        <Route path="/decisions" element={<ProtectedRoute><Decisions /></ProtectedRoute>} />
        <Route path="/actions" element={<ProtectedRoute><Actions /></ProtectedRoute>} />
        <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
        <Route path="/conflicts" element={<ProtectedRoute><ConflictOfInterest /></ProtectedRoute>} />
        <Route path="/archives" element={<ProtectedRoute><Archives /></ProtectedRoute>} />
        <Route path="/audit" element={<ProtectedRoute><AuditLog /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
        <Route path="/approvals" element={<ProtectedRoute><Approvals /></ProtectedRoute>} />

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

        <Route path="*" element={<NotFound />} />
      </Routes>
      {user && <AIAssistant />}
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ProtectedApp />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
