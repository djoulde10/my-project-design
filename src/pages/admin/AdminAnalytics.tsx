import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { TrendingUp, DollarSign, Users, Building2, FileText, CalendarDays, Download, Shield } from "lucide-react";

export default function AdminAnalytics() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [orgUsage, setOrgUsage] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [o, p, pr, s, d, al, ou] = await Promise.all([
        supabase.from("companies").select("id, nom, statut, created_at, plan_abonnement, plan_id"),
        supabase.from("subscription_plans").select("*"),
        supabase.from("profiles").select("id, created_at, company_id, statut"),
        supabase.from("sessions").select("id, created_at, company_id, status"),
        supabase.from("documents").select("id, created_at, company_id"),
        supabase.from("admin_audit_log").select("id, action, created_at, entity_type").order("created_at", { ascending: false }).limit(500),
        supabase.from("organization_usage").select("*, companies:company_id(nom)"),
      ]);
      setOrgs(o.data ?? []);
      setPlans(p.data ?? []);
      setProfiles(pr.data ?? []);
      setSessions(s.data ?? []);
      setDocuments(d.data ?? []);
      setAuditLogs(al.data ?? []);
      setOrgUsage(ou.data ?? []);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Chargement...</div>;

  // Plan distribution
  const planDistribution = plans.map(plan => ({
    name: plan.name,
    count: orgs.filter(o => o.plan_id === plan.id).length,
  })).filter(p => p.count > 0);

  // MRR
  const mrr = orgs.reduce((sum, org) => {
    const plan = plans.find(p => p.id === org.plan_id);
    return sum + (plan?.price_monthly ?? 0);
  }, 0);

  // Growth - last 6 months
  const now = new Date();
  const growthData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const label = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const orgCount = orgs.filter(o => new Date(o.created_at) <= end).length;
    const userCount = profiles.filter(p => new Date(p.created_at) <= end).length;
    const sessionCount = sessions.filter(s => new Date(s.created_at) <= end).length;
    return { name: label, organisations: orgCount, utilisateurs: userCount, sessions: sessionCount };
  });

  // Status distribution
  const statusData = [
    { name: "Actives", value: orgs.filter(o => o.statut === "actif").length },
    { name: "Suspendues", value: orgs.filter(o => o.statut === "suspendu").length },
    { name: "Autres", value: orgs.filter(o => !["actif", "suspendu"].includes(o.statut ?? "")).length },
  ].filter(d => d.value > 0);

  // Audit activity by type
  const auditByType = auditLogs.reduce((acc, log) => {
    const action = log.action || "unknown";
    acc[action] = (acc[action] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const auditTypeData = Object.entries(auditByType).map(([name, value]) => ({ name, value: value as number })).sort((a, b) => b.value - a.value).slice(0, 6);

  // Top orgs by usage
  const topOrgs = orgUsage
    .map((u: any) => ({
      name: u.companies?.nom ?? "—",
      users: u.current_users,
      sessions: u.current_sessions,
      documents: u.current_documents,
      storage: u.current_storage_mb,
    }))
    .sort((a: any, b: any) => b.sessions - a.sessions)
    .slice(0, 10);

  const COLORS = ["hsl(152, 60%, 40%)", "hsl(0, 72%, 51%)", "hsl(220, 15%, 60%)"];

  return (
    <div className="p-4 lg:p-8 space-y-6 overflow-y-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-['Space_Grotesk']">Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">Métriques de performance du SaaS</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-success" />
              <span className="text-xs text-muted-foreground">MRR</span>
            </div>
            <p className="text-2xl font-bold">{mrr.toFixed(0)}€</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">ARR</span>
            </div>
            <p className="text-2xl font-bold">{(mrr * 12).toFixed(0)}€</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Organisations</span>
            </div>
            <p className="text-2xl font-bold">{orgs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Utilisateurs</span>
            </div>
            <p className="text-2xl font-bold">{profiles.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Sessions totales</span>
            </div>
            <p className="text-2xl font-bold">{sessions.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Documents</span>
            </div>
            <p className="text-2xl font-bold">{documents.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Actions auditées</span>
            </div>
            <p className="text-2xl font-bold">{auditLogs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-success" />
              <span className="text-xs text-muted-foreground">Taux actifs</span>
            </div>
            <p className="text-2xl font-bold">
              {profiles.length > 0 ? Math.round((profiles.filter(p => p.statut === "actif").length / profiles.length) * 100) : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Croissance globale</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="organisations" name="Organisations" stroke="hsl(225, 65%, 40%)" strokeWidth={2} />
                <Line type="monotone" dataKey="utilisateurs" name="Utilisateurs" stroke="hsl(42, 90%, 55%)" strokeWidth={2} />
                <Line type="monotone" dataKey="sessions" name="Sessions" stroke="hsl(152, 60%, 40%)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Statut des organisations</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Distribution par plan</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={planDistribution}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="count" name="Organisations" fill="hsl(225, 65%, 40%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Activité d'audit (admin)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={auditTypeData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" fontSize={12} />
                <YAxis type="category" dataKey="name" fontSize={11} width={80} />
                <Tooltip />
                <Bar dataKey="value" name="Actions" fill="hsl(42, 90%, 55%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Organizations Usage */}
      {topOrgs.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Top organisations par activité</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organisation</TableHead>
                  <TableHead className="text-center">Utilisateurs</TableHead>
                  <TableHead className="text-center">Sessions</TableHead>
                  <TableHead className="text-center">Documents</TableHead>
                  <TableHead className="text-center">Stockage (MB)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topOrgs.map((org, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell className="text-center">{org.users}</TableCell>
                    <TableCell className="text-center">{org.sessions}</TableCell>
                    <TableCell className="text-center">{org.documents}</TableCell>
                    <TableCell className="text-center">{org.storage}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
