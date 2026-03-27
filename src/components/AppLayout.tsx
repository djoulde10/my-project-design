import { ReactNode, useState, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { usePermissions } from "@/hooks/usePermissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCompanyBranding } from "@/hooks/useCompanyBranding";
import { routePermissionMap } from "@/lib/routePermissions";
import NotificationCenter from "@/components/notifications/NotificationCenter";
import GlobalSearch from "@/components/GlobalSearch";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  FileText,
  FolderOpen,
  ListTodo,
  Mic,
  Archive,
  LogOut,
  Shield,
  ChevronRight,
  Gavel,
  Menu,
  Calendar,
  ShieldAlert,
  Key,
  Settings,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

const navSections = [
  {
    label: "Principal",
    items: [
      { label: "Tableau de bord", icon: LayoutDashboard, path: "/" },
      { label: "Sessions", icon: CalendarDays, path: "/sessions" },
      { label: "Membres", icon: Users, path: "/members" },
      { label: "Calendrier", icon: Calendar, path: "/calendar" },
    ],
  },
  {
    label: "Gouvernance",
    items: [
      { label: "Ordre du jour", icon: FileText, path: "/agenda" },
      { label: "Réunions & PV", icon: Mic, path: "/meetings" },
      { label: "Résolutions", icon: Gavel, path: "/decisions" },
      { label: "Suivi des actions", icon: ListTodo, path: "/actions" },
      { label: "Approbations", icon: Shield, path: "/approvals" },
    ],
  },
  {
    label: "Gestion",
    items: [
      { label: "Documents", icon: FolderOpen, path: "/documents" },
      { label: "Conflits d'intérêts", icon: ShieldAlert, path: "/conflicts" },
      { label: "Archives", icon: Archive, path: "/archives" },
      { label: "Journal d'audit", icon: Shield, path: "/audit" },
      { label: "Utilisateurs", icon: Users, path: "/users" },
      { label: "Permissions", icon: Shield, path: "/permissions" },
      { label: "API", icon: Key, path: "/api-keys" },
      { label: "Personnalisation", icon: Settings, path: "/settings" },
      { label: "Centre d'aide", icon: HelpCircle, path: "/help" },
    ],
  },
];

function SidebarContent({ user, signOut, location, onNavigate, isSuperAdmin, branding, permissions }: {
  user: any;
  signOut: () => void;
  location: any;
  onNavigate?: () => void;
  isSuperAdmin?: boolean;
  branding?: { displayName: string; logoUrl: string | null; primaryColor: string };
  permissions: string[];
}) {
  const name = branding?.displayName || "GovBoard";
  const logoUrl = branding?.logoUrl;
  const primaryColor = branding?.primaryColor;

  return (
    <>
      <div className="px-5 py-5 flex items-center gap-3">
        {logoUrl ? (
          <img src={logoUrl} alt={name} className="w-9 h-9 rounded-lg object-contain" />
        ) : (
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={primaryColor ? { backgroundColor: primaryColor } : undefined}
          >
            <Shield className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
        )}
        <div>
          <h1 className="font-bold text-base text-sidebar-accent-foreground font-['Space_Grotesk'] tracking-tight truncate max-w-[160px]">{name}</h1>
          <p className="text-[11px] text-sidebar-foreground/50 leading-none mt-0.5">Gouvernance d'entreprise</p>
        </div>
      </div>

      <Separator className="bg-sidebar-border/60" />

      <ScrollArea className="flex-1 px-3 py-3">
        <nav className="space-y-5">
          {navSections.map((section) => {
            const visibleItems = section.items.filter((item) => {
              const required = routePermissionMap[item.path];
              if (!required) return true;
              return required.some((p) => permissions.includes(p));
            });
            if (visibleItems.length === 0) return null;
            return (
              <div key={section.label}>
                <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
                  {section.label}
                </p>
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
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
                        <item.icon className={cn("w-[18px] h-[18px] flex-shrink-0", isActive ? "text-sidebar-primary" : "")} />
                        <span className="flex-1">{item.label}</span>
                        {isActive && <ChevronRight className="w-3 h-3 opacity-50" />}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </ScrollArea>

      {isSuperAdmin && (
        <div className="px-3 pb-1">
          <Link
            to="/admin"
            onClick={onNavigate}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors font-medium"
          >
            <Shield className="w-[18px] h-[18px]" />
            <span>Super Admin</span>
          </Link>
        </div>
      )}

      <div className="p-3 border-t border-sidebar-border/60">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-sidebar-accent/30 transition-colors">
          <div className="w-8 h-8 rounded-full bg-sidebar-primary/20 flex items-center justify-center text-xs font-semibold text-sidebar-primary">
            {user?.email?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium text-sidebar-accent-foreground truncate">{user?.email}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-sidebar-foreground/50 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/50" onClick={signOut}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const { isSuperAdmin } = useSuperAdmin();
  const { permissions } = usePermissions();
  const { branding, displayName } = useCompanyBranding();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  const brandingProps = {
    displayName,
    logoUrl: branding.logo_url,
    primaryColor: branding.couleur_principale,
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside className="w-[260px] flex-shrink-0 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border/40">
          <SidebarContent user={user} signOut={signOut} location={location} isSuperAdmin={isSuperAdmin} branding={brandingProps} permissions={permissions} />
        </aside>
      )}

      {/* Mobile Sheet Sidebar */}
      {isMobile && (
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-72 p-0 bg-sidebar text-sidebar-foreground flex flex-col">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarContent user={user} signOut={signOut} location={location} onNavigate={() => setMobileOpen(false)} isSuperAdmin={isSuperAdmin} branding={brandingProps} permissions={permissions} />
          </SheetContent>
        </Sheet>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-4 lg:px-8 py-3 border-b bg-card/80 backdrop-blur-sm gap-3 shrink-0">
          {isMobile && (
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setMobileOpen(true)}>
              <Menu className="w-5 h-5" />
            </Button>
          )}
          <div className="flex-1 min-w-0 max-w-xl">
            <GlobalSearch />
          </div>
          <NotificationCenter />
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
