import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CalendarPlus, Download, ExternalLink } from "lucide-react";
import {
  downloadICS,
  getGoogleCalendarLink,
  getOutlookLink,
  getTeamsLink,
  type SessionEvent,
} from "@/lib/calendarIntegrations";
import { toast } from "sonner";

interface SessionCalendarActionsProps {
  session: {
    title: string;
    session_date: string;
    location?: string | null;
    is_virtual?: boolean;
    meeting_link?: string | null;
    organs?: { name: string } | null;
  };
  variant?: "icon" | "button";
}

function toEvent(s: SessionCalendarActionsProps["session"]): SessionEvent {
  return {
    title: s.title,
    startDate: new Date(s.session_date),
    location: s.location ?? undefined,
    isVirtual: s.is_virtual,
    meetingLink: s.meeting_link ?? undefined,
    organName: s.organs?.name,
  };
}

export default function SessionCalendarActions({ session, variant = "icon" }: SessionCalendarActionsProps) {
  const event = toEvent(session);

  const handleDownloadICS = () => {
    downloadICS(event);
    toast.success("Fichier .ics téléchargé");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "icon" ? (
          <Button variant="ghost" size="icon" title="Ajouter au calendrier">
            <CalendarPlus className="w-4 h-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <CalendarPlus className="w-4 h-4 mr-1" />
            Ajouter au calendrier
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={handleDownloadICS}>
          <Download className="w-4 h-4 mr-2" />
          Télécharger .ics
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={getGoogleCalendarLink(event)} target="_blank" rel="noopener noreferrer" className="flex items-center">
            <ExternalLink className="w-4 h-4 mr-2" />
            Google Calendar
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={getOutlookLink(event)} target="_blank" rel="noopener noreferrer" className="flex items-center">
            <ExternalLink className="w-4 h-4 mr-2" />
            Outlook
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={getTeamsLink(event)} target="_blank" rel="noopener noreferrer" className="flex items-center">
            <ExternalLink className="w-4 h-4 mr-2" />
            Microsoft Teams
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
