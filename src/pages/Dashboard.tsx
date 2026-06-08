import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CalendarDays, Users, ListTodo, AlertTriangle, CheckCircle2, Clock, TrendingUp,
  Target, Gavel, FileText, ArrowRight, Sparkles, Mic, Pause, Play, Square,
  Bell, FileSignature, FolderOpen, Activity, Eye, ChevronRight, Zap, Building2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { useUserQuality } from "@/hooks/useUserQuality";
import { usePermissions } from "@/hooks/usePermissions";
import { useAppData } from "@/contexts/AppDataContext";
import { useAuth } from "@/lib/auth";
import { useRecording, formatDuration } from "@/contexts/RecordingContext";
import PageSkeleton from "@/components/PageSkeleton";

interface DashboardData {
  sessionsOrdinaires: number;
  sessionsExtraordinaires: number;
  reunionsAudit: number;
  decisions: number;
  actions: number;
  overdueActions: number;
  completedActions: number;
  inProgressActions: number;
  activeMembers: number;
  pvTotal: number;
  pvPending: number;
  pvValidated: number;
  unreadConvocations: number;
  upcomingSessions: any[];
  recentDecisions: any[];
  nearDueActions: any[];
  pendingPVsCA: number;
  pendingPVsAudit: number;
  pendingPVsList: any[];
  sessionsByMonth: { month: string; count: number }[];
  recentNotifications: any[];
  recentDocuments: any[];
  recentAudit: any[];
  todaySessions: number;
  fullName: string;
}

const MONTH_NAMES = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { displayName, branding } = useAppData();
  const { canSeePendingCA, canSeePendingAudit, canSeeAnyPending, isPCA, isPresidentAudit } = useUserQuality();
  const { hasPermission } = usePermissions();
  const recording = useRecording();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);

  const canSeeDocs = hasPermission("consulter_documents") || hasPermission("gerer_documents");
  const canSeeMembers = hasPermission("gerer_membres");
  const canSeeAudit = hasPermission("consulter_audit");
  const canSeeActions = hasPermission("suivre_actions") || hasPermission("consulter_documents");

  // Scope PV visibility by role:
  // - PCA → CA only
  // - Président du Comité d'Audit → audit only
  // - Others with valider_pv or consulter_documents → both
  const pvScope: "ca" | "audit" | "both" | "none" =
    isPCA && !isPresidentAudit ? "ca" :
    isPresidentAudit && !isPCA ? "audit" :
    (canSeePendingCA && canSeePendingAudit) || hasPermission("valider_pv") || hasPermission("consulter_documents") ? "both" :
    "none";
  const matchesScope = (t?: string) =>
    pvScope === "both" ? (t === "ca" || t === "comite_audit") :
    pvScope === "ca" ? t === "ca" :
    pvScope === "audit" ? t === "comite_audit" :
    false;

  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      const now = new Date();
      const nowIso = now.toISOString();
      const nearDue = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

      const [
        publishedRes, decisionsRes, actionsRes, overdueRes, completedRes, inProgressRes,
        upcomingRes, recentDecisionsRes, nearDueRes, pendingPVRes, sessionsAllRes,
        membersRes, allMinutesRes, convocationsRes, notifRes, docsRes, auditRes, profileRes, todayRes,
      ] = await Promise.all([
        supabase.from("sessions").select("id, session_type, organs(type)").eq("is_published", true),
        supabase.from("decisions").select("id", { count: "exact", head: true }),
        supabase.from("actions").select("id", { count: "exact", head: true }),
        supabase.from("actions").select("id", { count: "exact", head: true }).eq("status", "en_retard"),
        supabase.from("actions").select("id", { count: "exact", head: true }).eq("status", "terminee"),
        supabase.from("actions").select("id", { count: "exact", head: true }).eq("status", "en_cours"),
        supabase.from("sessions").select("id, title, session_date, status, session_type, organs(name, type)").gte("session_date", nowIso).order("session_date", { ascending: true }).limit(5),
        supabase.from("decisions").select("id, numero_decision, texte, statut, created_at, sessions(title)").order("created_at", { ascending: false }).limit(5),
        supabase.from("actions").select("id, title, due_date, members(full_name)").eq("status", "en_cours").lte("due_date", nearDue).order("due_date").limit(5),
        supabase.from("minutes").select("id, session_id, pv_status, updated_at, sessions!inner(title, organs!inner(type, name))").in("pv_status", ["brouillon", "en_attente_validation"]).order("updated_at", { ascending: false }).limit(10),
        supabase.from("sessions").select("session_date").eq("is_published", true).order("session_date", { ascending: false }).limit(200),
        canSeeMembers
          ? supabase.from("members_directory").select("id", { count: "exact", head: true }).eq("is_active", true)
          : Promise.resolve({ count: 0 } as any),
        supabase.from("minutes").select("id, pv_status, is_published, sessions!inner(organs!inner(type))"),
        user ? supabase.from("convocation_views").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("viewed_at", null) : Promise.resolve({ count: 0 } as any),
        user ? supabase.from("notifications").select("id, type, title, message, link, is_read, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(6) : Promise.resolve({ data: [] } as any),
        canSeeDocs ? supabase.from("documents").select("id, name, category, created_at, sessions(title)").order("created_at", { ascending: false }).limit(5) : Promise.resolve({ data: [] } as any),
        canSeeAudit ? supabase.from("audit_log").select("id, action, entity_type, created_at, user_id").order("created_at", { ascending: false }).limit(6) : Promise.resolve({ data: [] } as any),
        user ? supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null } as any),
        supabase.from("sessions").select("id", { count: "exact", head: true }).gte("session_date", todayStart).lt("session_date", todayEnd),
      ]);

      if (cancelled) return;

      const published = publishedRes.data ?? [];
      const sessionsOrdinaires = published.filter((s: any) => s.session_type === "ordinaire" && (s.organs as any)?.type === "ca").length;
      const sessionsExtraordinaires = published.filter((s: any) => s.session_type === "extraordinaire" && (s.organs as any)?.type === "ca").length;
      const reunionsAudit = published.filter((s: any) => (s.organs as any)?.type === "comite_audit").length;

      const monthCounts: Record<string, number> = {};
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
        const [, m] = key.split("-");
        return { month: MONTH_NAMES[parseInt(m) - 1], count };
      });

      const pendingList = (pendingPVRes.data ?? []) as any[];
      const pendingPVsCA = pendingList.filter((m) => m?.sessions?.organs?.type === "ca").length;
      const pendingPVsAudit = pendingList.filter((m) => m?.sessions?.organs?.type === "comite_audit").length;

      const allMinutes = ((allMinutesRes as any).data ?? []) as any[];
      const scopedMinutes = allMinutes.filter((m) => matchesScope(m?.sessions?.organs?.type));
      const pvTotal = scopedMinutes.length;
      const pvPending = scopedMinutes.filter((m) => m.pv_status === "brouillon" || m.pv_status === "en_attente_validation").length;
      const pvValidated = scopedMinutes.filter((m) => m.is_published || m.pv_status === "valide" || m.pv_status === "publie").length;

      setData({
        sessionsOrdinaires, sessionsExtraordinaires, reunionsAudit,
        decisions: decisionsRes.count ?? 0,
        actions: actionsRes.count ?? 0,
        overdueActions: overdueRes.count ?? 0,
        completedActions: completedRes.count ?? 0,
        inProgressActions: inProgressRes.count ?? 0,
        activeMembers: (membersRes as any).count ?? 0,
        pvTotal, pvPending, pvValidated,
        unreadConvocations: (convocationsRes as any).count ?? 0,
        upcomingSessions: upcomingRes.data ?? [],
        recentDecisions: recentDecisionsRes.data ?? [],
        nearDueActions: nearDueRes.data ?? [],
        pendingPVsCA, pendingPVsAudit,
        pendingPVsList: pendingList,
        sessionsByMonth,
        recentNotifications: (notifRes as any).data ?? [],
        recentDocuments: (docsRes as any).data ?? [],
        recentAudit: (auditRes as any).data ?? [],
        todaySessions: (todayRes as any).count ?? 0,
        fullName: (profileRes as any).data?.full_name?.split(" ")[0] ?? "",
      });
      setLoading(false);
    };
    fetchAll();
    return () => { cancelled = true; };
  }, [user, canSeeMembers, canSeeDocs, canSeeAudit]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 6) return "Bonsoir";
    if (h < 12) return "Bonjour";
    if (h < 18) return "Bon après-midi";
    return "Bonsoir";
  }, []);

  if (loading || !data) return <PageSkeleton />;

  const totalPendingPV = (canSeePendingCA ? data.pendingPVsCA : 0) + (canSeePendingAudit ? data.pendingPVsAudit : 0);
  const executionRate = data.actions > 0 ? Math.round((data.completedActions / data.actions) * 100) : 0;

  const insights: { icon: any; text: string; tone: "info" | "warn" | "danger" | "ok"; action?: () => void }[] = [];
  if (data.todaySessions > 0) insights.push({ icon: CalendarDays, text: `${data.todaySessions} réunion${data.todaySessions > 1 ? "s" : ""} prévue${data.todaySessions > 1 ? "s" : ""} aujourd'hui`, tone: "info", action: () => navigate("/sessions") });
  if (data.unreadConvocations > 0) insights.push({ icon: Bell, text: `${data.unreadConvocations} convocation${data.unreadConvocations > 1 ? "s" : ""} non consultée${data.unreadConvocations > 1 ? "s" : ""}`, tone: "warn", action: () => navigate("/sessions") });
  if (totalPendingPV > 0) insights.push({ icon: FileText, text: `${totalPendingPV} PV en attente de validation`, tone: "warn", action: () => navigate("/meetings") });
  if (data.overdueActions > 0) insights.push({ icon: AlertTriangle, text: `${data.overdueActions} action${data.overdueActions > 1 ? "s" : ""} en retard`, tone: "danger", action: () => navigate("/actions") });
  if (insights.length === 0) insights.push({ icon: CheckCircle2, text: "Tout est à jour. Excellente gouvernance.", tone: "ok" });

  // Grandes cartes principales (héros) — limitées à 5 pour rester aérées
  const totalReunions = data.sessionsOrdinaires + data.sessionsExtraordinaires + data.reunionsAudit;
  const heroStats = [
    { label: "Réunions", sublabel: `${data.sessionsOrdinaires + data.sessionsExtraordinaires} CA · ${data.reunionsAudit} audit`, value: totalReunions, icon: CalendarDays, color: "text-primary", bg: "bg-primary/10", path: "/sessions" },
    ...(canSeeAnyPending ? [{ label: "PV en attente", sublabel: "À valider", value: totalPendingPV, icon: FileText, color: "text-amber-600", bg: "bg-amber-100", path: "/meetings" }] : []),
    ...(canSeeDocs ? [{ label: "Documents signés", sublabel: "Publiés", value: data.signedDocs, icon: FileSignature, color: "text-emerald-600", bg: "bg-emerald-100", path: "/documents" }] : []),
    { label: "Convocations non lues", sublabel: "À consulter", value: data.unreadConvocations, icon: Bell, color: "text-rose-600", bg: "bg-rose-100", path: "/sessions" },
    ...(canSeeMembers ? [{ label: "Membres actifs", sublabel: "Dans l'organisation", value: data.activeMembers, icon: Users, color: "text-violet-600", bg: "bg-violet-100", path: "/members" }] : []),
  ];

  const toneClass = (tone: string) =>
    tone === "danger" ? "bg-destructive/10 text-destructive border-destructive/20" :
    tone === "warn" ? "bg-amber-50 text-amber-700 border-amber-200" :
    tone === "ok" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
    "bg-primary/10 text-primary border-primary/20";

  // Wrapper de section avec titre uniforme (vraie hiérarchie visuelle)
  const SectionHeader = ({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: { label: string; onClick: () => void } }) => (
    <div className="flex items-end justify-between mb-4">
      <div>
        {eyebrow && <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70 mb-1">{eyebrow}</p>}
        <h2 className="text-lg lg:text-xl font-semibold tracking-tight">{title}</h2>
      </div>
      {action && (
        <Button variant="ghost" size="sm" onClick={action.onClick} className="text-muted-foreground hover:text-foreground">
          {action.label}<ChevronRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      )}
    </div>
  );

  return (
    <div className="p-6 lg:p-10 space-y-10 lg:space-y-12 max-w-[1600px] mx-auto animate-in fade-in duration-300">
      {/* Premium hero header */}
      <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 lg:p-10">
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-10 w-72 h-72 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-16 h-16 rounded-2xl bg-background/80 backdrop-blur border border-border/60 flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
              {branding.logo_url ? (
                <img src={branding.logo_url} alt={branding.nom} className="w-full h-full object-cover" />
              ) : (
                <Building2 className="w-7 h-7 text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                {branding.nom} · Centre de gouvernance
              </p>
              <h1 className="text-2xl lg:text-4xl font-bold text-foreground tracking-tight mt-1 truncate">
                {greeting}{data.fullName ? `, ${data.fullName}` : ""}
              </h1>
              <p className="text-muted-foreground mt-2 text-sm lg:text-base max-w-xl">
                {insights[0]?.text || `Bienvenue sur ${displayName}.`}
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => navigate("/calendar")} className="bg-background/60 backdrop-blur">
              <CalendarDays className="w-4 h-4 mr-2" />Calendrier
            </Button>
            {hasPermission("creer_session") && (
              <Button size="sm" onClick={() => navigate("/sessions")} className="shadow-md">
                <Sparkles className="w-4 h-4 mr-2" />Nouvelle session
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* AI Recording widget (when active) */}
      {recording.status !== "idle" && (
        <Card className="border-primary/30 bg-gradient-to-r from-primary/5 via-primary/10 to-transparent">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
                recording.status === "recording" ? "bg-destructive/15 text-destructive animate-pulse" : "bg-amber-100 text-amber-700")}>
                <Mic className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm truncate">{recording.meta?.title ?? "Écoute IA"}</p>
                  <Badge variant={recording.status === "recording" ? "destructive" : "secondary"} className="text-[10px]">
                    {recording.status === "recording" ? "En direct" : "En pause"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  {formatDuration(recording.elapsedMs)} · {(recording.transcript + " " + recording.partialText).trim().split(/\s+/).filter(Boolean).length} mots transcrits
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {recording.status === "recording" ? (
                <Button size="sm" variant="outline" onClick={() => recording.pause()}><Pause className="w-4 h-4 mr-1" />Pause</Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => recording.resume()}><Play className="w-4 h-4 mr-1" />Reprendre</Button>
              )}
              <Button size="sm" variant="destructive" onClick={() => recording.stop()}><Square className="w-4 h-4 mr-1" />Arrêter</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* === SECTION : VUE D'ENSEMBLE === */}
      <section>
        <SectionHeader eyebrow="Vue d'ensemble" title="Indicateurs clés" />
        <div className={cn("grid gap-4 grid-cols-1 sm:grid-cols-2", heroStats.length >= 5 ? "lg:grid-cols-5" : heroStats.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
          {heroStats.map((stat) => (
            <Card
              key={stat.label}
              className="group cursor-pointer hover:shadow-xl hover:-translate-y-1 hover:border-primary/40 transition-all duration-300 relative overflow-hidden"
              onClick={() => navigate(stat.path)}
            >
              <CardContent className="p-5 lg:p-6">
                <div className="flex items-start justify-between gap-2 mb-4">
                  <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", stat.bg, stat.color)}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-3xl lg:text-4xl font-bold leading-none tabular-nums tracking-tight">{stat.value}</p>
                <p className="text-sm font-semibold mt-3">{stat.label}</p>
                <p className="text-xs text-muted-foreground mt-1 truncate">{stat.sublabel}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* === SECTION : INTELLIGENCE & ACTIONS URGENTES === */}
      <section>
        <SectionHeader eyebrow="Assistance" title="Synthèse intelligente" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 border-primary/20 bg-gradient-to-br from-primary/[0.03] to-transparent">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                <Sparkles className="w-4 h-4 text-primary" />Recommandations IA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                {insights.map((ins, i) => (
                  <button
                    key={i}
                    onClick={ins.action}
                    className={cn("flex items-center gap-3 px-4 py-3 rounded-lg border text-sm text-left transition-all hover:shadow-sm hover:-translate-y-px", toneClass(ins.tone))}
                  >
                    <ins.icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1 font-medium">{ins.text}</span>
                    {ins.action && <ChevronRight className="w-4 h-4 opacity-50" />}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                <Zap className="w-4 h-4 text-amber-600" />Actions urgentes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.overdueActions === 0 && totalPendingPV === 0 && data.unreadConvocations === 0 ? (
                <div className="flex items-center gap-2 text-emerald-600 py-2">
                  <CheckCircle2 className="w-5 h-5" /><p className="text-sm">Aucune action urgente</p>
                </div>
              ) : (
                <>
                  {data.overdueActions > 0 && (
                    <button onClick={() => navigate("/actions")} className="flex w-full items-center justify-between text-sm px-3 py-2.5 rounded-md bg-destructive/5 hover:bg-destructive/10 transition-colors">
                      <span className="text-destructive font-medium">{data.overdueActions} action(s) en retard</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {canSeePendingCA && data.pendingPVsCA > 0 && (
                    <button onClick={() => navigate("/meetings")} className="flex w-full items-center justify-between text-sm px-3 py-2.5 rounded-md bg-amber-50 hover:bg-amber-100 transition-colors">
                      <span className="text-amber-700 font-medium">{data.pendingPVsCA} PV CA à valider</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {canSeePendingAudit && data.pendingPVsAudit > 0 && (
                    <button onClick={() => navigate("/audit-meetings")} className="flex w-full items-center justify-between text-sm px-3 py-2.5 rounded-md bg-amber-50 hover:bg-amber-100 transition-colors">
                      <span className="text-amber-700 font-medium">{data.pendingPVsAudit} PV Audit à valider</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {data.unreadConvocations > 0 && (
                    <button onClick={() => navigate("/sessions")} className="flex w-full items-center justify-between text-sm px-3 py-2.5 rounded-md bg-primary/5 hover:bg-primary/10 transition-colors">
                      <span className="text-primary font-medium">{data.unreadConvocations} convocation(s) non lue(s)</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* === SECTION : PERFORMANCE & ACTIVITÉ === */}
      <section>
        <SectionHeader eyebrow="Performance" title="Activité de gouvernance" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {canSeeActions && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="w-4 h-4 text-emerald-600" />Taux de réalisation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold tracking-tight">{executionRate}%</span>
              <span className="text-sm text-muted-foreground mb-1.5">terminées</span>
            </div>
            <Progress value={executionRate} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground pt-1">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />{data.completedActions} OK</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary" />{data.inProgressActions} en cours</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-destructive" />{data.overdueActions} retard</span>
            </div>
          </CardContent>
        </Card>
        )}

        <Card className={cn(canSeeActions ? "lg:col-span-2" : "lg:col-span-3")}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Activity className="w-4 h-4 text-primary" />Sessions (6 derniers mois)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.sessionsByMonth}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Bar dataKey="count" name="Sessions" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        </div>
      </section>

      {/* === SECTION : RÉUNIONS & PV === */}
      <section>
        <SectionHeader eyebrow="Gouvernance" title="Réunions & procès-verbaux" action={{ label: "Voir le calendrier", onClick: () => navigate("/calendar") }} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />Prochaines réunions
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/calendar")}>Voir tout</Button>
            </div>
          </CardHeader>
          <CardContent>
            {data.upcomingSessions.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                <CalendarDays className="w-8 h-8 opacity-30" />
                <p className="text-sm">Aucune session planifiée</p>
              </div>
            ) : (
              <div className="space-y-1">
                {data.upcomingSessions.map((s: any) => {
                  const isAudit = s.organs?.type === "comite_audit";
                  const d = new Date(s.session_date);
                  return (
                    <div key={s.id} className="flex items-center gap-3 py-3 px-3 -mx-3 rounded-lg hover:bg-muted/50 transition-colors group/row">
                      <div className="w-14 h-14 rounded-xl bg-primary/10 text-primary flex flex-col items-center justify-center text-xs font-bold shrink-0 border border-primary/10">
                        <span className="text-base leading-none">{d.getDate()}</span>
                        <span className="text-[10px] font-medium mt-0.5 uppercase">{d.toLocaleDateString("fr-FR", { month: "short" })}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-sm truncate">{s.title}</h4>
                          <Badge variant="outline" className="text-[10px] shrink-0">{s.status}</Badge>
                          {isAudit && <Badge variant="secondary" className="text-[10px]">Audit</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {s.organs?.name} · {d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <div className="hidden sm:flex gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                        <Button size="sm" variant="ghost" onClick={() => navigate(isAudit ? "/audit-meetings" : "/sessions")} title="Voir">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => navigate("/agenda-items")} title="Ordre du jour">
                          <ListTodo className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {canSeeAnyPending && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-600" />PV en attente
                </CardTitle>
                <Badge variant="secondary">{totalPendingPV}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {(() => {
                const filtered = data.pendingPVsList.filter((m: any) => {
                  const t = m?.sessions?.organs?.type;
                  return (t === "ca" && canSeePendingCA) || (t === "comite_audit" && canSeePendingAudit);
                }).slice(0, 5);
                if (filtered.length === 0) {
                  return (
                    <div className="flex flex-col items-center gap-2 py-8 text-emerald-600">
                      <CheckCircle2 className="w-8 h-8 opacity-60" />
                      <p className="text-sm">Tout est validé</p>
                    </div>
                  );
                }
                return (
                  <div className="space-y-1">
                    {filtered.map((m: any) => {
                      const isAudit = m.sessions?.organs?.type === "comite_audit";
                      return (
                        <button key={m.id} onClick={() => navigate(isAudit ? "/audit-meetings" : "/meetings")}
                          className="w-full text-left py-2.5 px-3 -mx-3 rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold truncate">{m.sessions?.title || "Session"}</p>
                            <Badge variant={m.pv_status === "en_attente_validation" ? "default" : "outline"} className="text-[10px] shrink-0">
                              {m.pv_status === "en_attente_validation" ? "À valider" : "Brouillon"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{m.sessions?.organs?.name}{isAudit ? " · Audit" : ""}</p>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}
        </div>
      </section>

      {/* === SECTION : NOTIFICATIONS, DOCUMENTS, RÉSOLUTIONS === */}
      <section>
        <SectionHeader eyebrow="Flux récents" title="Notifications & contenus" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentNotifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <Bell className="w-7 h-7 opacity-30" />
                <p className="text-sm">Tout est lu</p>
              </div>
            ) : (
              <div className="space-y-1">
                {data.recentNotifications.slice(0, 5).map((n: any) => (
                  <button key={n.id} onClick={() => n.link && navigate(n.link)}
                    className={cn("w-full text-left py-2.5 px-3 -mx-3 rounded-lg hover:bg-muted/50 transition-colors", !n.is_read && "bg-primary/5")}>
                    <div className="flex items-start gap-2">
                      {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{n.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {canSeeDocs && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-emerald-600" />Documents récents
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate("/documents")}>Voir tout</Button>
              </div>
            </CardHeader>
            <CardContent>
              {data.recentDocuments.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <FolderOpen className="w-7 h-7 opacity-30" />
                  <p className="text-sm">Aucun document</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {data.recentDocuments.map((d: any) => (
                    <button key={d.id} onClick={() => navigate("/documents")}
                      className="w-full text-left py-2.5 px-3 -mx-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold truncate">{d.name}</p>
                        <Badge variant="outline" className="text-[10px] shrink-0">{d.category}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {d.sessions?.title} · {new Date(d.created_at).toLocaleDateString("fr-FR")}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Gavel className="w-4 h-4 text-amber-600" />Résolutions récentes
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/decisions")}>Voir tout</Button>
            </div>
          </CardHeader>
          <CardContent>
            {data.recentDecisions.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <Gavel className="w-7 h-7 opacity-30" />
                <p className="text-sm">Aucune résolution</p>
              </div>
            ) : (
              <div className="space-y-1">
                {data.recentDecisions.map((d: any) => (
                  <button key={d.id} onClick={() => navigate("/decisions")}
                    className="w-full text-left py-2.5 px-3 -mx-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-xs text-muted-foreground">{d.numero_decision}</p>
                      <Badge className={cn(
                        d.statut === "adoptee" ? "bg-emerald-100 text-emerald-800" :
                        d.statut === "rejetee" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800",
                        "text-[10px]"
                      )}>{d.statut}</Badge>
                    </div>
                    <p className="text-sm truncate mt-1">{d.texte}</p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </section>

      {/* === SECTION : ÉCHÉANCES & AUDIT === */}
      {(canSeeActions || canSeeAudit) && (
      <section>
        <SectionHeader eyebrow="Suivi" title="Échéances & traçabilité" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {canSeeActions && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="w-4 h-4 text-violet-600" />Échéances proches
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate("/actions")}>Voir tout</Button>
              </div>
            </CardHeader>
            <CardContent>
              {data.nearDueActions.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-emerald-600">
                  <CheckCircle2 className="w-8 h-8 opacity-60" /><p className="text-sm">Aucune échéance proche</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {data.nearDueActions.map((a: any) => (
                    <button key={a.id} onClick={() => navigate("/actions")}
                      className="w-full text-left flex items-center justify-between py-2.5 px-3 -mx-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{a.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{a.members?.full_name ?? "Non assigné"}</p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {a.due_date ? new Date(a.due_date).toLocaleDateString("fr-FR") : "—"}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {canSeeAudit && (
          <Card className={cn(!canSeeActions && "lg:col-span-2")}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-4 h-4 text-muted-foreground" />Activité récente
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate("/audit")}>Audit</Button>
              </div>
            </CardHeader>
            <CardContent>
              {data.recentAudit.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <Activity className="w-7 h-7 opacity-30" />
                  <p className="text-sm">Aucune activité</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {data.recentAudit.map((a: any) => (
                    <div key={a.id} className="flex items-center gap-3 py-2 px-3 -mx-3 rounded-md hover:bg-muted/40 text-sm transition-colors">
                      <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                      <span className="font-mono text-xs text-muted-foreground w-16 shrink-0">{a.action}</span>
                      <span className="truncate flex-1">{a.entity_type}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(a.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
        </div>
      </section>
      )}
    </div>
  );
}
