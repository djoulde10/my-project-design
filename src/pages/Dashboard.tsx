import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CalendarDays, Users, ClipboardCheck, ListTodo, AlertTriangle, CheckCircle2, Clock, TrendingUp, Timer, Target } from "lucide-react";

export default function Dashboard() {
  const [stats, setStats] = useState({
    sessions: 0, members: 0, solutions: 0, actions: 0, overdueActions: 0,
    upcomingSession: null as any,
    completedActions: 0, cancelledActions: 0,
    avgClosureDays: 0,
    solutionsWithActions: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const [sessionsRes, membersRes, solutionsRes, actionsRes, overdueRes, upcomingRes, completedRes, cancelledRes, actionsWithDatesRes, solutionsWithActionsRes] = await Promise.all([
        supabase.from("sessions").select("id", { count: "exact", head: true }),
        supabase.from("members").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("solutions").select("id", { count: "exact", head: true }),
        supabase.from("actions").select("id", { count: "exact", head: true }),
        supabase.from("actions").select("id", { count: "exact", head: true }).eq("status", "en_retard"),
        supabase.from("sessions").select("*, organs(name)").gte("session_date", new Date().toISOString()).order("session_date", { ascending: true }).limit(1),
        supabase.from("actions").select("id", { count: "exact", head: true }).eq("status", "terminee"),
        supabase.from("actions").select("id", { count: "exact", head: true }).eq("status", "annulee"),
        supabase.from("actions").select("created_at, completion_date").eq("status", "terminee").not("completion_date", "is", null),
        supabase.from("solutions").select("id, actions(id)"),
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

      const withActions = (solutionsWithActionsRes.data ?? []).filter(
        (d: any) => d.actions && d.actions.length > 0
      ).length;

      setStats({
        sessions: sessionsRes.count ?? 0,
        members: membersRes.count ?? 0,
        solutions: solutionsRes.count ?? 0,
        actions: actionsRes.count ?? 0,
        overdueActions: overdueRes.count ?? 0,
        upcomingSession: upcomingRes.data?.[0] ?? null,
        completedActions: completedRes.count ?? 0,
        cancelledActions: cancelledRes.count ?? 0,
        avgClosureDays: avgDays,
        solutionsWithActions: withActions,
      });
    };
    fetchStats();
  }, []);

  const statCards = [
    { label: "Sessions", value: stats.sessions, icon: CalendarDays, color: "text-primary" },
    { label: "Membres actifs", value: stats.members, icon: Users, color: "text-emerald-600" },
    { label: "Solutions", value: stats.solutions, icon: ClipboardCheck, color: "text-amber-600" },
    { label: "Actions", value: stats.actions, icon: ListTodo, color: "text-violet-600" },
  ];

  const totalActions = stats.actions;
  const executionRate = totalActions > 0 ? Math.round((stats.completedActions / totalActions) * 100) : 0;
  const solutionPerformance = stats.solutions > 0 ? Math.round((stats.solutionsWithActions / stats.solutions) * 100) : 0;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tableau de bord</h1>
        <p className="text-muted-foreground">Vue d'ensemble de la gouvernance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
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
              <Target className="w-4 h-4 text-primary" />
              Performance des solutions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold">{solutionPerformance}%</span>
              <span className="text-sm text-muted-foreground mb-1">avec actions</span>
            </div>
            <Progress value={solutionPerformance} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {stats.solutionsWithActions} / {stats.solutions} solutions suivies d'actions
            </p>
          </CardContent>
        </Card>

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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Prochaine session
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.upcomingSession ? (
              <div className="space-y-2">
                <h3 className="font-semibold">{stats.upcomingSession.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {new Date(stats.upcomingSession.session_date).toLocaleDateString("fr-FR", {
                    weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
                  })}
                </p>
                <div className="flex gap-2">
                  <Badge variant="secondary">{stats.upcomingSession.session_type}</Badge>
                  <Badge variant="outline">{stats.upcomingSession.location ?? "Non défini"}</Badge>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Aucune session planifiée</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
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
    </div>
  );
}
