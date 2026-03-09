import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays, MapPin, Video, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

const statusColors: Record<string, string> = {
  brouillon: "bg-muted text-muted-foreground",
  validee: "bg-blue-100 text-blue-800",
  tenue: "bg-emerald-100 text-emerald-800",
  cloturee: "bg-violet-100 text-violet-800",
  archivee: "bg-muted text-muted-foreground",
};

const typeLabels: Record<string, string> = {
  ordinaire: "Ordinaire",
  extraordinaire: "Extraordinaire",
  speciale: "Spéciale",
};

export default function CalendarPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    const fetchSessions = async () => {
      const { data } = await supabase
        .from("sessions")
        .select("*, organs(name)")
        .order("session_date");
      setSessions(data ?? []);
    };
    fetchSessions();
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7; // Monday-based
    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    // Previous month days
    for (let i = startOffset - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month, -i), isCurrentMonth: false });
    }
    // Current month days
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({ date: new Date(year, month, d), isCurrentMonth: true });
    }
    // Fill remaining
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      days.push({ date: new Date(year, month + 1, d), isCurrentMonth: false });
    }
    return days;
  }, [year, month]);

  const sessionsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    sessions.forEach((s) => {
      const key = new Date(s.session_date).toISOString().split("T")[0];
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [sessions]);

  const today = new Date().toISOString().split("T")[0];

  const selectedSessions = selectedDate ? (sessionsByDate[selectedDate] ?? []) : [];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(today);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="w-5 h-5 sm:w-6 sm:h-6" />
            Calendrier des réunions
          </h1>
          <p className="text-sm text-muted-foreground">Visualisez toutes vos sessions passées et à venir</p>
        </div>
        <Button variant="outline" onClick={goToday}>Aujourd'hui</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={prevMonth}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <CardTitle className="text-lg">{MONTHS[month]} {year}</CardTitle>
              <Button variant="ghost" size="icon" onClick={nextMonth}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-px">
              {DAYS.map((d) => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
              ))}
              {calendarDays.map(({ date, isCurrentMonth }, i) => {
                const key = date.toISOString().split("T")[0];
                const daySessions = sessionsByDate[key] ?? [];
                const isToday = key === today;
                const isSelected = key === selectedDate;

                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(key)}
                    className={cn(
                      "relative p-1.5 min-h-[72px] text-left rounded-lg transition-all border border-transparent",
                      !isCurrentMonth && "opacity-30",
                      isToday && "border-primary",
                      isSelected && "bg-primary/10 border-primary",
                      "hover:bg-muted/60"
                    )}
                  >
                    <span className={cn(
                      "text-xs font-medium",
                      isToday && "text-primary font-bold"
                    )}>
                      {date.getDate()}
                    </span>
                    <div className="mt-0.5 space-y-0.5">
                      {daySessions.slice(0, 2).map((s: any) => (
                        <div key={s.id} className="text-[10px] leading-tight truncate px-1 py-0.5 rounded bg-primary/10 text-primary font-medium">
                          {s.title}
                        </div>
                      ))}
                      {daySessions.length > 2 && (
                        <div className="text-[10px] text-muted-foreground pl-1">+{daySessions.length - 2}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Detail Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {selectedDate
                ? new Date(selectedDate + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
                : "Sélectionnez une date"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedDate ? (
              <p className="text-sm text-muted-foreground">Cliquez sur une date pour voir les sessions.</p>
            ) : selectedSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune session ce jour.</p>
            ) : (
              <div className="space-y-4">
                {selectedSessions.map((s: any) => (
                  <div key={s.id} className="border rounded-lg p-3 space-y-2 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-sm">{s.title}</h4>
                      <Badge className={statusColors[s.status] ?? ""} variant="secondary">{s.status}</Badge>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p className="flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        {new Date(s.session_date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        {" · "}
                        <Badge variant="outline" className="text-[10px] px-1 py-0">{typeLabels[s.session_type] ?? s.session_type}</Badge>
                      </p>
                      {s.organs?.name && <p>Organe : {s.organs.name}</p>}
                      {s.location && <p className="flex items-center gap-1"><MapPin className="w-3 h-3" />{s.location}</p>}
                      {s.is_virtual && s.meeting_link && (
                        <a href={s.meeting_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                          <Video className="w-3 h-3" />Rejoindre en ligne
                        </a>
                      )}
                    </div>
                    <Button size="sm" variant="outline" className="w-full mt-1" onClick={() => navigate("/sessions")}>
                      <ExternalLink className="w-3 h-3 mr-1" />Voir la session
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming sessions list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prochaines sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const upcoming = sessions.filter((s) => new Date(s.session_date) >= new Date()).slice(0, 5);
            if (upcoming.length === 0) return <p className="text-sm text-muted-foreground">Aucune session à venir</p>;
            return (
              <div className="space-y-2">
                {upcoming.map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0 cursor-pointer hover:bg-muted/50 rounded px-2 -mx-2" onClick={() => {
                    const d = new Date(s.session_date).toISOString().split("T")[0];
                    setCurrentDate(new Date(s.session_date));
                    setSelectedDate(d);
                  }}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex flex-col items-center justify-center text-xs font-bold">
                        <span>{new Date(s.session_date).getDate()}</span>
                        <span className="text-[9px] font-normal">{MONTHS[new Date(s.session_date).getMonth()].slice(0, 3)}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{s.title}</p>
                        <p className="text-xs text-muted-foreground">{s.organs?.name} · {new Date(s.session_date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    </div>
                    <Badge className={statusColors[s.status] ?? ""} variant="secondary">{s.status}</Badge>
                  </div>
                ))}
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
