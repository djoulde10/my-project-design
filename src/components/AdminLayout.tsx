import { ReactNode, useState } from "react";
import { Link, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  BarChart3,
  Settings,
  ScrollText,
  LogOut,
  Shield,
  ChevronRight,
  Menu,
  Package,
  ToggleRight,
  MessageSquare,
  Activity,
  ShieldCheck,
  Plug,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

const adminNav = [
  {
    label: "Tableau de bord",
    items: [
      { label: "Vue d'ensemble", icon: LayoutDashboard, path: "/admin" },
      { label: "Analytics", icon: BarChart3, path: "/admin/analytics" },
      { label: "Monitoring", icon: Activity, path: "/admin/monitoring" },
    ],
  },
  {
    label: "Gestion",
    items: [
      { label: "Organisations", icon: Building2, path: "/admin/organizations" },
      { label: "Plans & Tarifs", icon: Package, path: "/admin/plans" },
      { label: "Feature Flags", icon: ToggleRight, path: "/admin/features" },
      { label: "Facturation", icon: CreditCard, path: "/admin/billing" },
    ],
  },
  {
    label: "Système",
    items: [
      { label: "Logs système", icon: ScrollText, path: "/admin/logs" },
      { label: "Sécurité", icon: ShieldCheck, path: "/admin/security" },
      { label: "Support", icon: MessageSquare, path: "/admin/support" },
      { label: "Configuration", icon: Settings, path: "/admin/settings" },
    ],
  },
];

function AdminSidebarContent({ user, signOut, location, onNavigate }: {
  user: any;
  signOut: () => void;
  location: any;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="px-5 py-5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-destructive flex items-center justify-center">
          <Shield className="w-5 h-5 text-destructive-foreground" />
        </div>
        <div>
          <h1 className="font-bold text-base text-sidebar-accent-foreground font-['Space_Grotesk'] tracking-tight">
            Super Admin
          </h1>
          <p className="text-[11px] text-sidebar-foreground/50 leading-none mt-0.5">
            Portail d'administration
          </p>
        </div>
      </div>

      <Separator className="bg-sidebar-border/60" />

      <ScrollArea className="flex-1 px-3 py-3">
        <nav className="space-y-5">
          {adminNav.map((section) => (
            <div key={section.label}>
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all duration-150",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm"
                          : "text-sidebar-foreground/65 hover:bg-sidebar-accent/40 hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <item.icon className={cn("w-[18px] h-[18px] flex-shrink-0", isActive ? "text-destructive" : "")} />
                      <span className="flex-1">{item.label}</span>
                      {isActive && <ChevronRight className="w-3 h-3 opacity-50" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>

      <div className="p-3">
        <Link
          to="/"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-sidebar-foreground/65 hover:bg-sidebar-accent/40 hover:text-sidebar-accent-foreground transition-colors mb-1"
        >
          <Building2 className="w-[18px] h-[18px]" />
          <span>Retour à l'app</span>
        </Link>
      </div>

      <div className="p-3 border-t border-sidebar-border/60">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-sidebar-accent/30 transition-colors">
          <div className="w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center text-xs font-semibold text-destructive">
            {user?.email?.[0]?.toUpperCase() ?? "S"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium text-sidebar-accent-foreground truncate">{user?.email}</p>
            <p className="text-[10px] text-sidebar-foreground/40">Super Admin</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-sidebar-foreground/50 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/50" onClick={signOut}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, signOut, loading: authLoading } = useAuth();
  const { isSuperAdmin, loading: adminLoading } = useSuperAdmin();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (authLoading || adminLoading) {
    return <div className="flex items-center justify-center h-screen text-muted-foreground">Chargement...</div>;
  }

  if (!user || !isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {!isMobile && (
        <aside className="w-[260px] flex-shrink-0 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border/40">
          <AdminSidebarContent user={user} signOut={signOut} location={location} />
        </aside>
      )}

      {isMobile && (
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-72 p-0 bg-sidebar text-sidebar-foreground flex flex-col">
            <SheetTitle className="sr-only">Navigation Admin</SheetTitle>
            <AdminSidebarContent user={user} signOut={signOut} location={location} onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-4 lg:px-8 py-3 border-b bg-card/80 backdrop-blur-sm gap-3 shrink-0">
          {isMobile && (
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setMobileOpen(true)}>
              <Menu className="w-5 h-5" />
            </Button>
          )}
          <h2 className="text-lg font-semibold text-foreground font-['Space_Grotesk']">
            Portail Super Admin
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded-full font-medium">
              Super Admin
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
