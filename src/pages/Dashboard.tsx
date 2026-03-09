import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CalendarDays, Users, ClipboardCheck, ListTodo, AlertTriangle, CheckCircle2, Clock, TrendingUp, Timer, Target, Gavel } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    sessions: 0, members: 0, decisions: 0, actions: 0, overdueActions: 0,
    upcomingSessions: [] as any[],
    recentDecisions: [] as any[],
    completedActions: 0, cancelledActions: 0,
    avgClosureDays: 0,
    decisionsWithActions: 0,
    nearDueActions: [] as any[],
  });

  useEffect(() => {
    const fetchStats = async () => {
      const now = new Date().toISOString();
      const nearDueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const [sessionsRes, membersRes, decisionsRes, actionsRes, overdueRes, upcomingRes, completedRes, cancelledRes, actionsWithDatesRes, recentDecisionsRes, nearDueRes] = await Promise.all([
        supabase.from("sessions").select("id", { count: "exact", head: true }),
        supabase.from("members").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("decisions").select("id", { count: "exact", head: true }),
        supabase.from("actions").select("id", { count: "exact", head: true }),
        supabase.from("actions").select("id", { count: "exact", head: true }).eq("status", "en_retard"),
        supabase.from("sessions").select("*, organs(name)").gte("session_date", now).order("session_date", { ascending: true }).limit(3),
        supabase.from("actions").select("id", { count: "exact", head: true }).eq("status", "terminee"),
        supabase.from("actions").select("id", { count: "exact", head: true }).eq("status", "annulee"),
        supabase.from("actions").select("created_at, completion_date").eq("status", "terminee").not("completion_date", "is", null),
        supabase.from("decisions").select("numero_decision, texte, statut, sessions(title)").order("created_at", { ascending: false }).limit(5),
        supabase.from("actions").select("title, due_date, members(full_name)").eq("status", "en_cours").lte("due_date", nearDueDate).order("due_date").limit(5),
      ]);

      let avgDays = 0;
      const closedActions = actionsWithDatesRes.data ?? [];
      if (closedActions.length > 0) {
        const totalDays = closedActions.reduce((sum: number, a: any) => {
          const start = new Date(a.created_at).getTime();
          const end = new Date(a.completion_date!).getTime();
          return sum + Math.max(0, (end - start) / (1000 * 60 * 60 * 24));
        }, 0);
        avgDays = Math.round(totalDays / closedActions.length);
      }

      setStats({
        sessions: sessionsRes.count ?? 0,
        members: membersRes.count ?? 0,
        decisions: decisionsRes.count ?? 0,
        actions: actionsRes.count ?? 0,
        overdueActions: overdueRes.count ?? 0,
        upcomingSessions: upcomingRes.data ?? [],
        recentDecisions: recentDecisionsRes.data ?? [],
        completedActions: completedRes.count ?? 0,
        cancelledActions: cancelledRes.count ?? 0,
        avgClosureDays: avgDays,
        decisionsWithActions: 0,
        nearDueActions: nearDueRes.data ?? [],
      });
    };
    fetchStats();
  }, []);

  const statCards = [
    { label: "Sessions", value: stats.sessions, icon: CalendarDays, color: "text-primary", path: "/sessions" },
    { label: "Membres actifs", value: stats.members, icon: Users, color: "text-emerald-600", path: "/members" },
    { label: "Résolutions", value: stats.decisions, icon: Gavel, color: "text-amber-600", path: "/decisions" },
    { label: "Actions", value: stats.actions, icon: ListTodo, color: "text-violet-600", path: "/actions" },
  ];

  const totalActions = stats.actions;
  const executionRate = totalActions > 0 ? Math.round((stats.completedActions / totalActions) * 100) : 0;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tableau de bord</h1>
        <p className="text-muted-foreground">Vue d'ensemble de la gouvernance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(stat.path)}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={cn("p-3 rounded-xl bg-muted", stat.color)}>
                  <stat.icon className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* KPI Gouvernance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Taux d'exécution des actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold">{executionRate}%</span>
              <span className="text-sm text-muted-foreground mb-1">terminées</span>
            </div>
            <Progress value={executionRate} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                {stats.completedActions} terminées
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-destructive inline-block" />
                {stats.overdueActions} en retard
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Timer className="w-4 h-4 text-amber-600" />
              Temps moyen de clôture
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold">{stats.avgClosureDays}</span>
              <span className="text-sm text-muted-foreground mb-1">jours</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {stats.avgClosureDays <= 7 ? (
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">Rapide</Badge>
              ) : stats.avgClosureDays <= 30 ? (
                <Badge variant="secondary" className="bg-amber-100 text-amber-700">Modéré</Badge>
              ) : (
                <Badge variant="secondary" className="bg-red-100 text-red-700">Lent</Badge>
              )}
              <span>basé sur {stats.completedActions} action(s) clôturée(s)</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              Actions en retard
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.overdueActions > 0 ? (
              <div className="flex items-center gap-4">
                <div className="text-4xl font-bold text-destructive">{stats.overdueActions}</div>
                <p className="text-sm text-muted-foreground">action(s) nécessitent une attention immédiate</p>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
                <p className="text-sm">Toutes les actions sont à jour</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sessions à venir */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Sessions à venir
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.upcomingSessions.length > 0 ? (
              <div className="space-y-3">
                {stats.upcomingSessions.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between border-b last:border-0 pb-2 last:pb-0 cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1" onClick={() => navigate("/sessions")}>
                    <div>
                      <h4 className="font-medium text-sm">{s.title}</h4>
                      <p className="text-xs text-muted-foreground">
                        {new Date(s.session_date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <Badge variant="outline">{s.session_type}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Aucune session planifiée</p>
            )}
          </CardContent>
        </Card>

        {/* Résolutions récentes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Gavel className="w-5 h-5 text-amber-600" />
              Résolutions récentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentDecisions.length > 0 ? (
              <div className="space-y-3">
                {stats.recentDecisions.map((d: any, i: number) => (
                  <div key={i} className="flex items-center justify-between border-b last:border-0 pb-2 last:pb-0 cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1" onClick={() => navigate("/decisions")}>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs text-muted-foreground">{d.numero_decision}</p>
                      <p className="text-sm truncate">{d.texte}</p>
                    </div>
                    <Badge className={
                      d.statut === "adoptee" ? "bg-emerald-100 text-emerald-800" :
                      d.statut === "rejetee" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                    }>{d.statut}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Aucune résolution</p>
            )}
          </CardContent>
        </Card>

        {/* Actions proches échéance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="w-5 h-5 text-violet-600" />
              Actions proches de l'échéance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.nearDueActions.length > 0 ? (
              <div className="space-y-3">
                {stats.nearDueActions.map((a: any, i: number) => (
                  <div key={i} className="flex items-center justify-between border-b last:border-0 pb-2 last:pb-0 cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1" onClick={() => navigate("/actions")}>
                    <div>
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{(a as any).members?.full_name ?? "Non assigné"}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {a.due_date ? new Date(a.due_date).toLocaleDateString("fr-FR") : "—"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
                <p className="text-sm">Aucune action proche de l'échéance</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance gouvernance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Indicateur de performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Exécution des actions</span>
                <span className="font-bold">{executionRate}%</span>
              </div>
              <Progress value={executionRate} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Sessions tenues / Total</span>
                <span className="font-bold">{stats.sessions > 0 ? "—" : "0"}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-muted rounded-lg p-3">
                <p className="text-2xl font-bold text-primary">{stats.decisions}</p>
                <p className="text-xs text-muted-foreground">Décisions prises</p>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <p className="text-2xl font-bold text-emerald-600">{stats.completedActions}</p>
                <p className="text-xs text-muted-foreground">Actions clôturées</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
