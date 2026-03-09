import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  Bell,
  CalendarDays,
  FileText,
  FolderOpen,
  ClipboardCheck,
  Users,
  Gavel,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useNavigate } from "react-router-dom";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
  metadata: any;
}

const typeConfig: Record<string, { icon: any; color: string }> = {
  session_created: { icon: CalendarDays, color: "text-primary" },
  document_added: { icon: FolderOpen, color: "text-amber-600" },
  agenda_item_created: { icon: FileText, color: "text-violet-600" },
  minute_created: { icon: BookOpen, color: "text-emerald-600" },
  minute_updated: { icon: ClipboardCheck, color: "text-blue-600" },
  minute_status_changed: { icon: Gavel, color: "text-orange-600" },
};

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setNotifications((data as Notification[]) ?? []);
  };

  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel("user-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user?.id}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleClick = (n: Notification) => {
    if (!n.is_read) markAsRead(n.id);
    if (n.link) {
      navigate(n.link);
      setOpen(false);
    }
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "À l'instant";
    if (mins < 60) return `Il y a ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Il y a ${days}j`;
  };

  const groupByDate = (notifs: Notification[]) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const groups: { label: string; items: Notification[] }[] = [
      { label: "Aujourd'hui", items: [] },
      { label: "Hier", items: [] },
      { label: "Plus ancien", items: [] },
    ];

    notifs.forEach((n) => {
      const d = new Date(n.created_at);
      if (d.toDateString() === today.toDateString()) groups[0].items.push(n);
      else if (d.toDateString() === yesterday.toDateString()) groups[1].items.push(n);
      else groups[2].items.push(n);
    });

    return groups.filter((g) => g.items.length > 0);
  };

  const groups = groupByDate(notifications);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-destructive text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] sm:w-[420px] p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <h3 className="font-semibold text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <p className="text-xs text-muted-foreground">{unreadCount} non lue{unreadCount > 1 ? "s" : ""}</p>
            )}
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllRead}>
              Tout marquer lu
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[450px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">Aucune notification</p>
            </div>
          ) : (
            groups.map((group, gi) => (
              <div key={group.label}>
                <div className="px-4 py-2 bg-muted/50">
                  <p className="text-xs font-medium text-muted-foreground">{group.label}</p>
                </div>
                {group.items.map((n) => {
                  const cfg = typeConfig[n.type] || { icon: Bell, color: "text-muted-foreground" };
                  const Icon = cfg.icon;
                  return (
                    <div
                      key={n.id}
                      onClick={() => handleClick(n)}
                      className={`px-4 py-3 border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors ${
                        !n.is_read ? "bg-primary/5" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 p-1.5 rounded-lg bg-muted ${cfg.color}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium leading-tight">{n.title}</p>
                            {!n.is_read && (
                              <span className="mt-1 w-2 h-2 rounded-full bg-primary shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {n.message}
                          </p>
                          <p className="text-xs text-muted-foreground/60 mt-1">
                            {timeAgo(n.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {gi < groups.length - 1 && <Separator />}
              </div>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
