import { useNavigate, useLocation } from "react-router-dom";
import { Mic, Pause, Play, Square, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRecording, formatDuration } from "@/contexts/RecordingContext";
import { cn } from "@/lib/utils";

export default function FloatingRecordingWidget() {
  const { status, elapsedMs, pause, resume, stop } = useRecording();
  const navigate = useNavigate();
  const location = useLocation();

  if (status === "idle") return null;

  const onMeetings = location.pathname.startsWith("/meetings");
  const isPaused = status === "paused";

  const handleStop = async () => {
    if (!confirm("Arrêter définitivement l'écoute IA ? La transcription sera conservée pour générer le PV.")) return;
    await stop();
    if (!onMeetings) navigate("/meetings");
  };

  return (
    <div className="fixed bottom-6 left-6 z-[60] w-[320px] max-w-[calc(100vw-3rem)] bg-card border rounded-2xl shadow-2xl overflow-hidden">
      <div className={cn(
        "px-4 py-2 flex items-center justify-between text-xs font-medium",
        isPaused ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-destructive/15 text-destructive"
      )}>
        <div className="flex items-center gap-2">
          <span className={cn(
            "w-2 h-2 rounded-full",
            isPaused ? "bg-amber-500" : "bg-destructive animate-pulse"
          )} />
          {isPaused ? "Écoute en pause" : "Écoute IA en cours"}
        </div>
        <Badge variant="outline" className="font-mono text-[11px] h-5 bg-background/50">
          {formatDuration(elapsedMs)}
        </Badge>
      </div>

      <div className="p-3 flex items-center gap-2">
        {isPaused ? (
          <Button size="sm" onClick={resume} className="flex-1 gap-1.5">
            <Play className="w-3.5 h-3.5" />Reprendre
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={pause} className="flex-1 gap-1.5">
            <Pause className="w-3.5 h-3.5" />Pause
          </Button>
        )}
        <Button size="sm" variant="destructive" onClick={handleStop} className="gap-1.5">
          <Square className="w-3.5 h-3.5" />Arrêter
        </Button>
        {!onMeetings && (
          <Button size="icon" variant="ghost" onClick={() => navigate("/meetings")} title="Ouvrir la page Réunions">
            <ExternalLink className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}