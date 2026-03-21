import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, CalendarDays, FileText, TrendingUp, AlertCircle, DollarSign, UserCheck, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { cn } from "@/lib/utils";

interface Stats {
  totalOrgs: number;
  activeOrgs: number;
  suspendedOrgs: number;
  totalUsers: number;
  activeUsers: number;
  totalSessions: number;
  totalDocuments: number;
  mrr: number;
  arr: number;
  newOrgsThisMonth: number;
  newUsersThisMonth: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalOrgs: 0, activeOrgs: 0, suspendedOrgs: 0,
    totalUsers: 0, activeUsers: 0, totalSessions: 0, totalDocuments: 0,
    mrr: 0, arr: 0, newOrgsThisMonth: 0, newUsersThisMonth: 0,
  });
  const [recentOrgs, setRecentOrgs] = useState<any[]>([]);
  const [growthData, setGrowthData] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const [orgsRes, profilesRes, sessionsRes, docsRes, plansRes] = await Promise.all([
        supabase.from("companies").select("id, statut, created_at, plan_id"),
        supabase.from("profiles").select("id, created_at, statut"),
        supabase.from("sessions").select("id", { count: "exact" }),
        supabase.from("documents").select("id", { count: "exact" }),
        supabase.from("subscription_plans").select("*"),
      ]);

      const orgs = orgsRes.data ?? [];
      const profiles = profilesRes.data ?? [];
      const plans = plansRes.data ?? [];
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const mrr = orgs.reduce((sum, org) => {
        if (org.statut !== "actif") return sum;
        const plan = plans.find(p => p.id === org.plan_id);
        return sum + (plan?.price_monthly ?? 0);
      }, 0);

      setStats({
        totalOrgs: orgs.length,
        activeOrgs: orgs.filter(o => o.statut === "actif").length,
        suspendedOrgs: orgs.filter(o => o.statut === "suspendu").length,
        totalUsers: profiles.length,
        activeUsers: profiles.filter(p => p.statut === "actif").length,
        totalSessions: sessionsRes.count ?? 0,
        totalDocuments: docsRes.count ?? 0,
        mrr,
        arr: mrr * 12,
        newOrgsThisMonth: orgs.filter(o => new Date(o.created_at) >= thisMonthStart).length,
        newUsersThisMonth: profiles.filter(p => new Date(p.created_at) >= thisMonthStart).length,
      });

      // Growth data - last 6 months
      const growth = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const label = d.toLocaleDateString("fr-FR", { month: "short" });
        const orgCount = orgs.filter(o => new Date(o.created_at) <= end).length;
        const userCount = profiles.filter(p => new Date(p.created_at) <= end).length;
        const monthMrr = orgs
          .filter(o => new Date(o.created_at) <= end && o.statut === "actif")
          .reduce((s, o) => {
            const plan = plans.find(p => p.id === o.plan_id);
            return s + (plan?.price_monthly ?? 0);
          }, 0);
        return { name: label, organisations: orgCount, utilisateurs: userCount, mrr: monthMrr };
      });
      setGrowthData(growth);
      setRevenueData(growth);

      const { data: recent } = await supabase
        .from("companies")
        .select("id, nom, statut, created_at, plan_id, special_status, subscription_plans(name)")
        .order("created_at", { ascending: false })
        .limit(8);
      setRecentOrgs(recent ?? []);
      setLoading(false);
    };
    fetchStats();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Chargement...</div>;
  }

  const kpiCards = [
    { label: "MRR", value: `${stats.mrr.toFixed(0)}€`, icon: DollarSign, color: "text-success", trend: "+12%", up: true },
    { label: "ARR", value: `${stats.arr.toFixed(0)}€`, icon: TrendingUp, color: "text-primary", trend: "+12%", up: true },
    { label: "Organisations", value: stats.totalOrgs, icon: Building2, color: "text-primary", trend: `+${stats.newOrgsThisMonth}`, up: true },
    { label: "Utilisateurs", value: stats.totalUsers, icon: Users, color: "text-primary", trend: `+${stats.newUsersThisMonth}`, up: true },
    { label: "Actifs", value: stats.activeUsers, icon: UserCheck, color: "text-success" },
    { label: "Suspendues", value: stats.suspendedOrgs, icon: AlertCircle, color: "text-destructive" },
    { label: "Sessions", value: stats.totalSessions, icon: CalendarDays, color: "text-accent-foreground" },
    { label: "Documents", value: stats.totalDocuments, icon: FileText, color: "text-muted-foreground" },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-6 overflow-y-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-['Space_Grotesk']">Vue d'ensemble</h1>
        <p className="text-muted-foreground text-sm mt-1">Statistiques globales de la plateforme</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpiCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <s.icon className={cn("w-4 h-4", s.color)} />
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                </div>
                {s.trend && (
                  <span className={cn("text-[10px] flex items-center gap-0.5 font-medium", s.up ? "text-success" : "text-destructive")}>
                    {s.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {s.trend}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Croissance</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" fontSize={11} className="fill-muted-foreground" />
                <YAxis fontSize={11} className="fill-muted-foreground" />
                <Tooltip />
                <Line type="monotone" dataKey="organisations" name="Organisations" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="utilisateurs" name="Utilisateurs" stroke="hsl(var(--accent-foreground))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Revenus mensuels (MRR)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" fontSize={11} className="fill-muted-foreground" />
                <YAxis fontSize={11} className="fill-muted-foreground" />
                <Tooltip formatter={(v: number) => `${v}€`} />
                <Area type="monotone" dataKey="mrr" name="MRR" stroke="hsl(var(--success))" fill="hsl(var(--success) / 0.15)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orgs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Organisations récentes</CardTitle>
        </CardHeader>
        <CardContent>
          {recentOrgs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune organisation</p>
          ) : (
            <div className="space-y-2">
              {recentOrgs.map((org) => (
                <div key={org.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div>
                    <p className="font-medium text-sm">{org.nom}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(org.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {(org as any).subscription_plans?.name ?? "—"}
                    </Badge>
                    {org.special_status && (
                      <Badge variant="outline" className="text-[10px]">{org.special_status}</Badge>
                    )}
                    <Badge variant={org.statut === "actif" ? "default" : "destructive"} className="text-[10px]">
                      {org.statut}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
