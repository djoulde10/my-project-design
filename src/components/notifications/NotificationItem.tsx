import { memo } from "react";
import {
  CalendarDays, FolderOpen, FileText, BookOpen, ClipboardCheck,
  Gavel, Users, ShieldAlert, AtSign, Bell, Eye, ExternalLink, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Notification, NotificationPriority } from "./types";
import { priorityMap, priorityConfig } from "./types";

const iconMap: Record<string, any> = {
  CalendarDays, FolderOpen, FileText, BookOpen, ClipboardCheck,
  Gavel, Users, ShieldAlert, AtSign,
};

const typeToIcon: Record<string, any> = {
  session_created: CalendarDays,
  session_updated: CalendarDays,
  document_added: FolderOpen,
  agenda_item_created: FileText,
  minute_created: BookOpen,
  minute_updated: ClipboardCheck,
  minute_status_changed: Gavel,
  attendee_added: Users,
  approval_requested: ShieldAlert,
  mention: AtSign,
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Il y a ${days}j`;
  return new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

interface NotificationItemProps {
  notification: Notification;
  onNavigate: (n: Notification) => void;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}

export const NotificationItem = memo(function NotificationItem({
  notification: n,
  onNavigate,
  onMarkRead,
  onDelete,
}: NotificationItemProps) {
  const priority: NotificationPriority = priorityMap[n.type] || "info";
  const config = priorityConfig[priority];
  const Icon = typeToIcon[n.type] || Bell;

  return (
    <div
      onClick={() => onNavigate(n)}
      className={cn(
        "group relative px-4 py-3 cursor-pointer transition-all duration-200",
        "hover:bg-muted/60",
        !n.is_read && "bg-primary/[0.03]",
        priority === "critical" && !n.is_read && "border-l-2 border-l-destructive",
        priority === "important" && !n.is_read && "border-l-2 border-l-amber-500",
        priority === "info" && !n.is_read && "border-l-2 border-l-primary/40",
        n.is_read && "border-l-2 border-l-transparent"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5 p-2 rounded-xl shrink-0 transition-colors", config.bgColor)}>
          <Icon className={cn("w-4 h-4", config.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={cn("text-sm leading-tight", !n.is_read ? "font-semibold text-foreground" : "font-medium text-muted-foreground")}>
              {n.title}
            </p>
            <div className="flex items-center gap-1 shrink-0">
              {!n.is_read && (
                <span className={cn("w-2 h-2 rounded-full shrink-0", config.dotColor)} />
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-[11px] text-muted-foreground/60">{timeAgo(n.created_at)}</p>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {n.link && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => { e.stopPropagation(); onNavigate(n); }}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Voir</TooltipContent>
                </Tooltip>
              )}
              {!n.is_read && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => { e.stopPropagation(); onMarkRead(n.id); }}
                    >
                      <Eye className="w-3 h-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Marquer lu</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive/70 hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); onDelete(n.id); }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Supprimer</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
