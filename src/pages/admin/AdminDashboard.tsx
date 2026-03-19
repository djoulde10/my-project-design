import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, CalendarDays, FileText, TrendingUp, AlertCircle } from "lucide-react";

interface Stats {
  totalOrgs: number;
  activeOrgs: number;
  suspendedOrgs: number;
  totalUsers: number;
  totalSessions: number;
  totalDocuments: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalOrgs: 0, activeOrgs: 0, suspendedOrgs: 0,
    totalUsers: 0, totalSessions: 0, totalDocuments: 0,
  });
  const [recentOrgs, setRecentOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const [orgsRes, profilesRes, sessionsRes, docsRes] = await Promise.all([
        supabase.from("companies").select("id, statut", { count: "exact" }),
        supabase.from("profiles").select("id", { count: "exact" }),
        supabase.from("sessions").select("id", { count: "exact" }),
        supabase.from("documents").select("id", { count: "exact" }),
      ]);

      const orgs = orgsRes.data ?? [];
      setStats({
        totalOrgs: orgsRes.count ?? 0,
        activeOrgs: orgs.filter(o => o.statut === "actif").length,
        suspendedOrgs: orgs.filter(o => o.statut === "suspendu").length,
        totalUsers: profilesRes.count ?? 0,
        totalSessions: sessionsRes.count ?? 0,
        totalDocuments: docsRes.count ?? 0,
      });

      const { data: recent } = await supabase
        .from("companies")
        .select("id, nom, statut, created_at, plan_abonnement")
        .order("created_at", { ascending: false })
        .limit(5);
      setRecentOrgs(recent ?? []);
      setLoading(false);
    };
    fetchStats();
  }, []);

  const statCards = [
    { label: "Organisations", value: stats.totalOrgs, icon: Building2, color: "text-primary" },
    { label: "Actives", value: stats.activeOrgs, icon: TrendingUp, color: "text-success" },
    { label: "Suspendues", value: stats.suspendedOrgs, icon: AlertCircle, color: "text-destructive" },
    { label: "Utilisateurs", value: stats.totalUsers, icon: Users, color: "text-primary" },
    { label: "Sessions", value: stats.totalSessions, icon: CalendarDays, color: "text-accent-foreground" },
    { label: "Documents", value: stats.totalDocuments, icon: FileText, color: "text-muted-foreground" },
  ];

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Chargement...</div>;
  }

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-['Space_Grotesk']">Vue d'ensemble</h1>
        <p className="text-muted-foreground text-sm mt-1">Statistiques globales de la plateforme</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <s.icon className={cn("w-4 h-4", s.color)} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organisations récentes</CardTitle>
        </CardHeader>
        <CardContent>
          {recentOrgs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune organisation</p>
          ) : (
            <div className="space-y-3">
              {recentOrgs.map((org) => (
                <div key={org.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div>
                    <p className="font-medium text-sm">{org.nom}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(org.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-secondary px-2 py-0.5 rounded">{org.plan_abonnement ?? "standard"}</span>
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded",
                      org.statut === "actif" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                    )}>
                      {org.statut}
                    </span>
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

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
