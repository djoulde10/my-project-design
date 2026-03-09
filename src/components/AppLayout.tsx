import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
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
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

const navItems = [
  { label: "Tableau de bord", icon: LayoutDashboard, path: "/" },
  { label: "Sessions", icon: CalendarDays, path: "/sessions" },
  { label: "Membres", icon: Users, path: "/members" },
  { label: "Ordre du jour", icon: FileText, path: "/agenda" },
  { label: "Documents", icon: FolderOpen, path: "/documents" },
  { label: "Réunions & PV", icon: Mic, path: "/meetings" },
  { label: "Résolutions", icon: Gavel, path: "/decisions" },
  { label: "Suivi des actions", icon: ListTodo, path: "/actions" },
  { label: "Archives", icon: Archive, path: "/archives" },
  { label: "Journal d'audit", icon: Shield, path: "/audit" },
  { label: "Utilisateurs", icon: Users, path: "/users" },
];

function SidebarContent({ user, signOut, location, onNavigate }: {
  user: any;
  signOut: () => void;
  location: any;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="p-5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
          <Shield className="w-5 h-5 text-sidebar-primary-foreground" />
        </div>
        <div>
          <h1 className="font-bold text-base text-sidebar-accent-foreground font-['Space_Grotesk']">GovBoard</h1>
          <p className="text-xs text-sidebar-foreground/60">Gouvernance</p>
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {isActive && <ChevronRight className="w-3 h-3" />}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-medium text-sidebar-accent-foreground">
            {user?.email?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-sidebar-accent-foreground truncate">{user?.email}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent" onClick={signOut}>
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
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside className="w-64 flex-shrink-0 bg-sidebar text-sidebar-foreground flex flex-col">
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
        <header className="flex items-center justify-between px-4 md:px-6 py-3 border-b bg-background gap-2">
          {isMobile && (
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setMobileOpen(true)}>
              <Menu className="w-5 h-5" />
            </Button>
          )}
          <div className="flex-1 min-w-0">
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
