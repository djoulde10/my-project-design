import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Bell, CheckCheck, Settings2, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { NotificationItem } from "./NotificationItem";
import { NotificationFilters } from "./NotificationFilters";
import type { Notification, NotificationFilter, NotificationPriority } from "./types";
import { priorityMap } from "./types";
import { cn } from "@/lib/utils";

export default function NotificationCenter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>("all");

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setNotifications((data as Notification[]) ?? []);
  }, [user]);

  useEffect(() => {
    fetchNotifications();
    const channel = supabase
      .channel("user-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user?.id}` },
        (payload) => {
          const newNotif = payload.new as Notification;
          setNotifications((prev) => [newNotif, ...prev]);
          const priority = priorityMap[newNotif.type] || "info";
          if (priority === "critical") {
            toast.error(newNotif.title, { description: newNotif.message, duration: 6000 });
          } else if (priority === "important") {
            toast.warning(newNotif.title, { description: newNotif.message, duration: 4000 });
          } else {
            toast.info(newNotif.title, { description: newNotif.message, duration: 3000 });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, fetchNotifications]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.is_read).length, [notifications]);

  const filteredNotifications = useMemo(() => {
    switch (filter) {
      case "unread": return notifications.filter((n) => !n.is_read);
      case "critical": return notifications.filter((n) => (priorityMap[n.type] || "info") === "critical");
      case "important": return notifications.filter((n) => (priorityMap[n.type] || "info") === "important");
      case "info": return notifications.filter((n) => (priorityMap[n.type] || "info") === "info");
      default: return notifications;
    }
  }, [notifications, filter]);

  const groupedNotifications = useMemo(() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const groups: { label: string; items: Notification[] }[] = [
      { label: "Aujourd'hui", items: [] },
      { label: "Hier", items: [] },
      { label: "Cette semaine", items: [] },
      { label: "Plus ancien", items: [] },
    ];
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    filteredNotifications.forEach((n) => {
      const d = new Date(n.created_at);
      if (d.toDateString() === today.toDateString()) groups[0].items.push(n);
      else if (d.toDateString() === yesterday.toDateString()) groups[1].items.push(n);
      else if (d > weekAgo) groups[2].items.push(n);
      else groups[3].items.push(n);
    });
    return groups.filter((g) => g.items.length > 0);
  }, [filteredNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  }, []);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    toast.success("Toutes les notifications marquées comme lues");
  }, [user]);

  const deleteNotification = useCallback(async (id: string) => {
    // We can't delete from notifications table (no DELETE RLS), so mark as read and remove from local state
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const handleNavigate = useCallback((n: Notification) => {
    if (!n.is_read) markAsRead(n.id);
    if (n.link) {
      navigate(n.link);
      setOpen(false);
    }
  }, [markAsRead, navigate]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className={cn("w-5 h-5 transition-transform", open && "scale-110")} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[20px] h-5 px-1 text-[10px] font-bold rounded-full bg-destructive text-destructive-foreground animate-in zoom-in-50 duration-200">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[400px] sm:w-[440px] p-0 shadow-xl border-border/60"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
          <div>
            <h3 className="font-semibold text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={markAllRead}>
                    <CheckCheck className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Tout marquer lu</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Filters */}
        <NotificationFilters active={filter} onChange={setFilter} />
        <Separator />

        {/* Notification List */}
        <ScrollArea className="max-h-[420px]">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <div className="w-12 h-12 rounded-full bg-muted/80 flex items-center justify-center mb-3">
                <Inbox className="w-6 h-6 opacity-40" />
              </div>
              <p className="text-sm font-medium">Aucune notification</p>
              <p className="text-xs mt-1 text-muted-foreground/60">
                {filter !== "all" ? "Aucune notification dans cette catégorie" : "Vous êtes à jour !"}
              </p>
            </div>
          ) : (
            groupedNotifications.map((group, gi) => (
              <div key={group.label}>
                <div className="sticky top-0 z-10 px-4 py-1.5 bg-muted/40 backdrop-blur-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                    {group.label}
                  </p>
                </div>
                {group.items.map((n) => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    onNavigate={handleNavigate}
                    onMarkRead={markAsRead}
                    onDelete={deleteNotification}
                  />
                ))}
                {gi < groupedNotifications.length - 1 && <Separator />}
              </div>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
