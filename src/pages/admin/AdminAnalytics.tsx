import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { TrendingUp, DollarSign, Users, Building2 } from "lucide-react";

export default function AdminAnalytics() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [o, p, pr] = await Promise.all([
        supabase.from("companies").select("id, nom, statut, created_at, plan_abonnement, plan_id"),
        supabase.from("subscription_plans").select("*"),
        supabase.from("profiles").select("id, created_at, company_id"),
      ]);
      setOrgs(o.data ?? []);
      setPlans(p.data ?? []);
      setProfiles(pr.data ?? []);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Chargement...</div>;

  // Org by plan
  const planDistribution = plans.map(plan => ({
    name: plan.name,
    count: orgs.filter(o => o.plan_id === plan.id).length,
  })).filter(p => p.count > 0);

  // MRR calculation
  const mrr = orgs.reduce((sum, org) => {
    const plan = plans.find(p => p.id === org.plan_id);
    return sum + (plan?.price_monthly ?? 0);
  }, 0);

  // Growth - last 6 months
  const now = new Date();
  const growthData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const label = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
    const orgCount = orgs.filter(o => new Date(o.created_at) <= new Date(d.getFullYear(), d.getMonth() + 1, 0)).length;
    const userCount = profiles.filter(p => new Date(p.created_at) <= new Date(d.getFullYear(), d.getMonth() + 1, 0)).length;
    return { name: label, organisations: orgCount, utilisateurs: userCount };
  });

  // Status distribution
  const statusData = [
    { name: "Actives", value: orgs.filter(o => o.statut === "actif").length },
    { name: "Suspendues", value: orgs.filter(o => o.statut === "suspendu").length },
    { name: "Autres", value: orgs.filter(o => !["actif", "suspendu"].includes(o.statut ?? "")).length },
  ].filter(d => d.value > 0);

  const COLORS = ["hsl(152, 60%, 40%)", "hsl(0, 72%, 51%)", "hsl(220, 15%, 60%)"];

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-['Space_Grotesk']">Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">Métriques de performance du SaaS</p>
      </div>

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
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Croissance</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 88%)" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="organisations" stroke="hsl(225, 65%, 40%)" strokeWidth={2} />
                <Line type="monotone" dataKey="utilisateurs" stroke="hsl(42, 90%, 55%)" strokeWidth={2} />
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

        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">Distribution par plan</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={planDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 88%)" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(225, 65%, 40%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
