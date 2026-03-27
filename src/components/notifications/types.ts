export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
  metadata: any;
}

export type NotificationPriority = "critical" | "important" | "info";

export type NotificationFilter = "all" | "unread" | "critical" | "important" | "info";

export const priorityMap: Record<string, NotificationPriority> = {
  minute_status_changed: "critical",
  approval_requested: "critical",
  session_updated: "important",
  session_created: "important",
  attendee_added: "important",
  minute_created: "important",
  minute_updated: "info",
  document_added: "info",
  agenda_item_created: "info",
  mention: "important",
};

export const priorityConfig: Record<NotificationPriority, { label: string; color: string; bgColor: string; dotColor: string }> = {
  critical: { label: "Critique", color: "text-destructive", bgColor: "bg-destructive/10", dotColor: "bg-destructive" },
  important: { label: "Important", color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-500/10", dotColor: "bg-amber-500" },
  info: { label: "Information", color: "text-primary", bgColor: "bg-primary/10", dotColor: "bg-primary" },
};

export const typeIcons: Record<string, string> = {
  session_created: "CalendarDays",
  session_updated: "CalendarDays",
  document_added: "FolderOpen",
  agenda_item_created: "FileText",
  minute_created: "BookOpen",
  minute_updated: "ClipboardCheck",
  minute_status_changed: "Gavel",
  attendee_added: "Users",
  approval_requested: "ShieldAlert",
  mention: "AtSign",
};
