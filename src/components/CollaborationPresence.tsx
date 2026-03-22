import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PresenceUser } from "@/hooks/useRealtimePresence";
import { Users, Pencil } from "lucide-react";

interface CollaborationPresenceProps {
  users: PresenceUser[];
}

export default function CollaborationPresence({ users }: CollaborationPresenceProps) {
  if (users.length === 0) return null;

  const editing = users.filter((u) => u.isEditing);
  const viewing = users.filter((u) => !u.isEditing);

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Users className="w-3.5 h-3.5" />
        <span>{users.length + 1}</span>
      </div>

      <div className="flex -space-x-2">
        {users.slice(0, 5).map((u) => (
          <Tooltip key={u.userId}>
            <TooltipTrigger asChild>
              <div className="relative">
                <Avatar className="h-7 w-7 border-2 border-background" style={{ borderColor: u.color }}>
                  <AvatarFallback
                    className="text-[10px] font-medium text-white"
                    style={{ backgroundColor: u.color }}
                  >
                    {u.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {u.isEditing && (
                  <span
                    className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-background"
                  >
                    <Pencil className="w-2.5 h-2.5 text-primary animate-pulse" />
                  </span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {u.fullName} — {u.isEditing ? "en train de modifier" : "en consultation"}
            </TooltipContent>
          </Tooltip>
        ))}
        {users.length > 5 && (
          <Avatar className="h-7 w-7 border-2 border-background">
            <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
              +{users.length - 5}
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      {editing.length > 0 && (
        <span className="text-xs text-muted-foreground animate-pulse">
          {editing.map((u) => u.fullName.split(" ")[0]).join(", ")} {editing.length === 1 ? "modifie" : "modifient"}...
        </span>
      )}
    </div>
  );
}
