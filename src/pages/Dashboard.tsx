import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CalendarDays, Users, ListTodo, AlertTriangle, CheckCircle2, Clock, TrendingUp, Timer, Target, Gavel, FileText, ShieldAlert, ArrowRight, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const PIE_COLORS = ["hsl(152, 60%, 40%)", "hsl(225, 65%, 40%)", "hsl(0, 72%, 51%)", "hsl(220, 10%, 75%)"];

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    sessions: 0, members: 0, decisions: 0, actions: 0, overdueActions: 0,
    upcomingSessions: [] as any[],
    recentDecisions: [] as any[],
    completedActions: 0, cancelledActions: 0, inProgressActions: 0,
    avgClosureDays: 0,
    nearDueActions: [] as any[],
    pendingPVs: 0,
    activeConflicts: 0,
    pendingApprovals: 0,
    sessionsByMonth: [] as { month: string; count: number }[],
  });

  useEffect(() => {
    const fetchStats = async () => {
      const now = new Date().toISOString();
      const nearDueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const [sessionsRes, membersRes, decisionsRes, actionsRes, overdueRes, upcomingRes, completedRes, cancelledRes, inProgressRes, actionsWithDatesRes, recentDecisionsRes, nearDueRes, pendingPVRes, conflictsRes, sessionsAllRes, pendingApprovalsRes] = await Promise.all([
        supabase.from("sessions").select("id", { count: "exact", head: true }),
        supabase.from("members").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("decisions").select("id", { count: "exact", head: true }),
        supabase.from("actions").select("id", { count: "exact", head: true }),
        supabase.from("actions").select("id", { count: "exact", head: true }).eq("status", "en_retard"),
        supabase.from("sessions").select("*, organs(name)").gte("session_date", now).order("session_date", { ascending: true }).limit(5),
        supabase.from("actions").select("id", { count: "exact", head: true }).eq("status", "terminee"),
        supabase.from("actions").select("id", { count: "exact", head: true }).eq("status", "annulee"),
        supabase.from("actions").select("id", { count: "exact", head: true }).eq("status", "en_cours"),
        supabase.from("actions").select("created_at, completion_date").eq("status", "terminee").not("completion_date", "is", null),
        supabase.from("decisions").select("numero_decision, texte, statut, sessions(title)").order("created_at", { ascending: false }).limit(5),
        supabase.from("actions").select("title, due_date, members(full_name)").eq("status", "en_cours").lte("due_date", nearDueDate).order("due_date").limit(5),
        supabase.from("minutes").select("id", { count: "exact", head: true }).eq("pv_status", "brouillon"),
        supabase.from("conflict_of_interests").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("sessions").select("session_date").order("session_date", { ascending: false }).limit(100),
        supabase.from("approval_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
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

      // Sessions by month (last 6 months)
      const monthCounts: Record<string, number> = {};
      const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthCounts[key] = 0;
      }
      (sessionsAllRes.data ?? []).forEach((s: any) => {
        const d = new Date(s.session_date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (key in monthCounts) monthCounts[key]++;
      });
      const sessionsByMonth = Object.entries(monthCounts).map(([key, count]) => {
        const [y, m] = key.split("-");
        return { month: monthNames[parseInt(m) - 1], count };
      });

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
        inProgressActions: inProgressRes.count ?? 0,
        avgClosureDays: avgDays,
        nearDueActions: nearDueRes.data ?? [],
        pendingPVs: pendingPVRes.count ?? 0,
        activeConflicts: conflictsRes.count ?? 0,
        pendingApprovals: pendingApprovalsRes.count ?? 0,
        sessionsByMonth,
      });
    };
    fetchStats();
  }, []);

  const statCards = [
    { label: "Sessions", value: stats.sessions, icon: CalendarDays, color: "text-primary", bg: "bg-primary/10", path: "/sessions" },
    { label: "Membres actifs", value: stats.members, icon: Users, color: "text-emerald-600", bg: "bg-emerald-50", path: "/members" },
    { label: "Résolutions", value: stats.decisions, icon: Gavel, color: "text-amber-600", bg: "bg-amber-50", path: "/decisions" },
    { label: "Actions", value: stats.actions, icon: ListTodo, color: "text-violet-600", bg: "bg-violet-50", path: "/actions" },
    { label: "PV en attente", value: stats.pendingPVs, icon: FileText, color: "text-blue-600", bg: "bg-blue-50", path: "/meetings" },
    { label: "Conflits actifs", value: stats.activeConflicts, icon: ShieldAlert, color: "text-red-600", bg: "bg-red-50", path: "/conflicts" },
  ];

  const totalActions = stats.actions;
  const executionRate = totalActions > 0 ? Math.round((stats.completedActions / totalActions) * 100) : 0;

  const actionsPieData = [
    { name: "Terminées", value: stats.completedActions },
    { name: "En cours", value: stats.inProgressActions },
    { name: "En retard", value: stats.overdueActions },
    { name: "Annulées", value: stats.cancelledActions },
  ].filter(d => d.value > 0);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tableau de bord</h1>
          <p className="text-muted-foreground">Vue d'ensemble de la gouvernance</p>
        </div>
        <Button variant="outline" onClick={() => navigate("/calendar")}>
          <CalendarDays className="w-4 h-4 mr-2" />Calendrier
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((stat) => (
          <Card key={stat.label} className="cursor-pointer hover:shadow-md transition-all group" onClick={() => navigate(stat.path)}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn("p-2.5 rounded-xl", stat.bg, stat.color)}>
                  <stat.icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none">{stat.value}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* KPIs Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Taux d'exécution
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
              <span>basé sur {stats.completedActions} action(s)</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              Alertes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.overdueActions > 0 && (
                <div className="flex items-center justify-between text-sm cursor-pointer hover:bg-muted/50 rounded p-1 -mx-1" onClick={() => navigate("/actions")}>
                  <span className="text-destructive font-medium">{stats.overdueActions} action(s) en retard</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                </div>
              )}
              {stats.pendingPVs > 0 && (
                <div className="flex items-center justify-between text-sm cursor-pointer hover:bg-muted/50 rounded p-1 -mx-1" onClick={() => navigate("/meetings")}>
                  <span className="text-amber-600 font-medium">{stats.pendingPVs} PV en attente</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                </div>
              )}
              {stats.activeConflicts > 0 && (
                <div className="flex items-center justify-between text-sm cursor-pointer hover:bg-muted/50 rounded p-1 -mx-1" onClick={() => navigate("/conflicts")}>
                  <span className="text-red-600 font-medium">{stats.activeConflicts} conflit(s) actif(s)</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                </div>
              )}
              {stats.overdueActions === 0 && stats.pendingPVs === 0 && stats.activeConflicts === 0 && (
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="w-5 h-5" />
                  <p className="text-sm">Tout est à jour</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sessions par mois</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.sessionsByMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.sessionsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(220, 15%, 88%)" />
                  <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(220, 15%, 88%)" }} />
                  <Bar dataKey="count" name="Sessions" fill="hsl(225, 65%, 40%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Aucune donnée</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répartition des actions</CardTitle>
          </CardHeader>
          <CardContent>
            {actionsPieData.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie data={actionsPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                      {actionsPieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {actionsPieData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2 text-sm">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-muted-foreground">{d.name}</span>
                      <span className="font-bold ml-auto">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Aucune action</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lists Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sessions à venir */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Sessions à venir
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/calendar")}>Voir tout</Button>
            </div>
          </CardHeader>
          <CardContent>
            {stats.upcomingSessions.length > 0 ? (
              <div className="space-y-2">
                {stats.upcomingSessions.map((s: any) => (
                  <div key={s.id} className="flex items-center gap-3 py-2 border-b last:border-0 cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1" onClick={() => navigate("/sessions")}>
                    <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex flex-col items-center justify-center text-xs font-bold shrink-0">
                      <span>{new Date(s.session_date).getDate()}</span>
                      <span className="text-[9px] font-normal">{new Date(s.session_date).toLocaleDateString("fr-FR", { month: "short" })}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium text-sm truncate">{s.title}</h4>
                      <p className="text-xs text-muted-foreground">{s.organs?.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm py-4">Aucune session planifiée</p>
            )}
          </CardContent>
        </Card>

        {/* Résolutions récentes */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Gavel className="w-4 h-4 text-amber-600" />
                Résolutions récentes
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/decisions")}>Voir tout</Button>
            </div>
          </CardHeader>
          <CardContent>
            {stats.recentDecisions.length > 0 ? (
              <div className="space-y-2">
                {stats.recentDecisions.map((d: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b last:border-0 cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1" onClick={() => navigate("/decisions")}>
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
              <p className="text-muted-foreground text-sm py-4">Aucune résolution</p>
            )}
          </CardContent>
        </Card>

        {/* Actions proches échéance */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="w-4 h-4 text-violet-600" />
                Échéances proches
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/actions")}>Voir tout</Button>
            </div>
          </CardHeader>
          <CardContent>
            {stats.nearDueActions.length > 0 ? (
              <div className="space-y-2">
                {stats.nearDueActions.map((a: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b last:border-0 cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1" onClick={() => navigate("/actions")}>
                    <div>
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{(a as any).members?.full_name ?? "Non assigné"}</p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {a.due_date ? new Date(a.due_date).toLocaleDateString("fr-FR") : "—"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-emerald-600 py-4">
                <CheckCircle2 className="w-5 h-5" />
                <p className="text-sm">Aucune échéance proche</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
