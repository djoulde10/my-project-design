import { cn } from "@/lib/utils";
import type { NotificationFilter } from "./types";

const filters: { key: NotificationFilter; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "unread", label: "Non lues" },
  { key: "critical", label: "🔴 Critiques" },
  { key: "important", label: "🟡 Important" },
  { key: "info", label: "🔵 Info" },
];

interface Props {
  active: NotificationFilter;
  onChange: (f: NotificationFilter) => void;
}

export function NotificationFilters({ active, onChange }: Props) {
  return (
    <div className="flex items-center gap-1 px-4 py-2 overflow-x-auto scrollbar-hide">
      {filters.map((f) => (
        <button
          key={f.key}
          onClick={() => onChange(f.key)}
          className={cn(
            "px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all",
            active === f.key
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
