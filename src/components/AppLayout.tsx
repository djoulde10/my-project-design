import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useIsMobile } from "@/hooks/use-mobile";
import NotificationBell from "@/components/NotificationBell";
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
    ],
  },
];

function SidebarContent({ user, signOut, location, onNavigate, isSuperAdmin }: {
  user: any;
  signOut: () => void;
  location: any;
  onNavigate?: () => void;
  isSuperAdmin?: boolean;
}) {
  return (
    <>
      <div className="px-5 py-5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
          <Shield className="w-5 h-5 text-sidebar-primary-foreground" />
        </div>
        <div>
          <h1 className="font-bold text-base text-sidebar-accent-foreground font-['Space_Grotesk'] tracking-tight">GovBoard</h1>
          <p className="text-[11px] text-sidebar-foreground/50 leading-none mt-0.5">Gouvernance d'entreprise</p>
        </div>
      </div>

      <Separator className="bg-sidebar-border/60" />

      <ScrollArea className="flex-1 px-3 py-3">
        <nav className="space-y-5">
          {navSections.map((section) => (
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
                      <item.icon className={cn("w-[18px] h-[18px] flex-shrink-0", isActive ? "text-sidebar-primary" : "")} />
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
  const location = useLocation();
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside className="w-[260px] flex-shrink-0 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border/40">
          <SidebarContent user={user} signOut={signOut} location={location} />
        </aside>
      )}

      {/* Mobile Sheet Sidebar */}
      {isMobile && (
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-72 p-0 bg-sidebar text-sidebar-foreground flex flex-col">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarContent user={user} signOut={signOut} location={location} onNavigate={() => setMobileOpen(false)} />
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
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
