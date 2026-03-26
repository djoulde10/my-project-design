import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Activity, Key, Building2, AlertTriangle, Clock, CheckCircle2, XCircle,
  Search, Ban, RefreshCw, BarChart3, Zap, Shield, TrendingUp,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";

const STATUS_COLORS: Record<string, string> = {
  "200": "hsl(var(--chart-2))",
  "201": "hsl(var(--chart-2))",
  "400": "hsl(var(--chart-4))",
  "401": "hsl(var(--destructive))",
  "403": "hsl(var(--chart-5))",
  "404": "hsl(var(--chart-3))",
  "429": "hsl(var(--chart-4))",
  "500": "hsl(var(--destructive))",
};

export default function AdminApiManagement() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("dashboard");
  const [logFilter, setLogFilter] = useState({ search: "", status: "all", period: "7" });
  const [keyFilter, setKeyFilter] = useState("");

  // Fetch all API keys (cross-org)
  const { data: allKeys = [], isLoading: keysLoading } = useQuery({
    queryKey: ["admin-api-keys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_keys")
        .select("*, companies:company_id(nom)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch request logs
  const { data: requestLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["admin-api-logs", logFilter.period],
    queryFn: async () => {
      const fromDate = subDays(new Date(), parseInt(logFilter.period)).toISOString();
      const { data, error } = await supabase
        .from("api_request_logs")
        .select("*, companies:company_id(nom), api_keys:api_key_id(name, key_prefix)")
        .gte("created_at", fromDate)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data;
    },
  });

  // Fetch companies for context
  const { data: companies = [] } = useQuery({
    queryKey: ["admin-companies-api"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, nom").order("nom");
      if (error) throw error;
      return data;
    },
  });

  // Toggle key status
  const toggleKeyMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const update: Record<string, unknown> = { is_active };
      if (!is_active) update.revoked_at = new Date().toISOString();
      else update.revoked_at = null;
      const { error } = await supabase.from("api_keys").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-api-keys"] });
      toast({ title: "Clé API mise à jour" });
    },
  });

  const deleteKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("api_keys").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-api-keys"] });
      toast({ title: "Clé API supprimée" });
    },
  });

  // --- Dashboard stats ---
  const stats = useMemo(() => {
    const totalRequests = requestLogs.length;
    const activeKeys = allKeys.filter((k: any) => k.is_active && !k.revoked_at).length;
    const orgsUsingApi = new Set(allKeys.filter((k: any) => k.is_active).map((k: any) => k.company_id)).size;
    const errorRequests = requestLogs.filter((l: any) => l.status_code >= 400).length;
    const errorRate = totalRequests > 0 ? ((errorRequests / totalRequests) * 100).toFixed(1) : "0";
    const avgResponseTime = totalRequests > 0
      ? Math.round(requestLogs.reduce((sum: number, l: any) => sum + (l.response_time_ms || 0), 0) / totalRequests)
      : 0;
    return { totalRequests, activeKeys, orgsUsingApi, errorRate, avgResponseTime, errorRequests };
  }, [requestLogs, allKeys]);

  // --- Charts data ---
  const dailyChartData = useMemo(() => {
    const days = parseInt(logFilter.period);
    const buckets: Record<string, { date: string; requests: number; errors: number }> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "yyyy-MM-dd");
      buckets[d] = { date: format(subDays(new Date(), i), "dd MMM", { locale: fr }), requests: 0, errors: 0 };
    }
    requestLogs.forEach((l: any) => {
      const d = format(new Date(l.created_at), "yyyy-MM-dd");
      if (buckets[d]) {
        buckets[d].requests++;
        if (l.status_code >= 400) buckets[d].errors++;
      }
    });
    return Object.values(buckets);
  }, [requestLogs, logFilter.period]);

  const endpointChartData = useMemo(() => {
    const map: Record<string, number> = {};
    requestLogs.forEach((l: any) => {
      const r = l.resource || "unknown";
      map[r] = (map[r] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));
  }, [requestLogs]);

  const statusPieData = useMemo(() => {
    const map: Record<string, number> = {};
    requestLogs.forEach((l: any) => {
      const s = String(l.status_code);
      map[s] = (map[s] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({
      name: `HTTP ${name}`,
      value,
      fill: STATUS_COLORS[name] || "hsl(var(--muted))",
    }));
  }, [requestLogs]);

  // --- Abuse detection ---
  const abuseAlerts = useMemo(() => {
    const keyReqCount: Record<string, { count: number; key: any }> = {};
    requestLogs.forEach((l: any) => {
      if (!l.api_key_id) return;
      if (!keyReqCount[l.api_key_id]) {
        keyReqCount[l.api_key_id] = { count: 0, key: l.api_keys };
      }
      keyReqCount[l.api_key_id].count++;
    });
    const alerts: { type: string; message: string; severity: "warning" | "critical" }[] = [];
    Object.entries(keyReqCount).forEach(([keyId, { count, key }]) => {
      const days = parseInt(logFilter.period);
      const avgPerDay = count / days;
      if (avgPerDay > 500) {
        alerts.push({
          type: "high_volume",
          message: `Clé "${key?.name || key?.key_prefix || keyId}" : ${count} requêtes (${Math.round(avgPerDay)}/jour)`,
          severity: "critical",
        });
      } else if (avgPerDay > 200) {
        alerts.push({
          type: "elevated_volume",
          message: `Clé "${key?.name || key?.key_prefix || keyId}" : volume élevé (${Math.round(avgPerDay)}/jour)`,
          severity: "warning",
        });
      }
    });
    const errorRate = stats.totalRequests > 0 ? (stats.errorRequests / stats.totalRequests) : 0;
    if (errorRate > 0.2 && stats.totalRequests > 50) {
      alerts.push({
        type: "high_error_rate",
        message: `Taux d'erreurs élevé : ${(errorRate * 100).toFixed(1)}% des requêtes`,
        severity: "critical",
      });
    }
    return alerts;
  }, [requestLogs, logFilter.period, stats]);

  // --- Filtered keys ---
  const filteredKeys = useMemo(() => {
    if (!keyFilter) return allKeys;
    const s = keyFilter.toLowerCase();
    return allKeys.filter((k: any) =>
      k.name?.toLowerCase().includes(s) ||
      k.key_prefix?.toLowerCase().includes(s) ||
      (k.companies as any)?.nom?.toLowerCase().includes(s)
    );
  }, [allKeys, keyFilter]);

  // --- Filtered logs ---
  const filteredLogs = useMemo(() => {
    return requestLogs.filter((l: any) => {
      if (logFilter.status !== "all") {
        if (logFilter.status === "success" && l.status_code >= 400) return false;
        if (logFilter.status === "error" && l.status_code < 400) return false;
      }
      if (logFilter.search) {
        const s = logFilter.search.toLowerCase();
        if (
          !l.endpoint?.toLowerCase().includes(s) &&
          !l.resource?.toLowerCase().includes(s) &&
          !(l.companies as any)?.nom?.toLowerCase().includes(s) &&
          !l.method?.toLowerCase().includes(s)
        ) return false;
      }
      return true;
    });
  }, [requestLogs, logFilter]);

  // --- Per-org stats ---
  const orgStats = useMemo(() => {
    const map: Record<string, { nom: string; keys: number; activeKeys: number; requests: number; errors: number }> = {};
    allKeys.forEach((k: any) => {
      const cid = k.company_id;
      if (!map[cid]) map[cid] = { nom: (k.companies as any)?.nom || "—", keys: 0, activeKeys: 0, requests: 0, errors: 0 };
      map[cid].keys++;
      if (k.is_active && !k.revoked_at) map[cid].activeKeys++;
    });
    requestLogs.forEach((l: any) => {
      const cid = l.company_id;
      if (!map[cid]) map[cid] = { nom: (l.companies as any)?.nom || "—", keys: 0, activeKeys: 0, requests: 0, errors: 0 };
      map[cid].requests++;
      if (l.status_code >= 400) map[cid].errors++;
    });
    return Object.entries(map)
      .map(([id, s]) => ({ id, ...s }))
      .sort((a, b) => b.requests - a.requests);
  }, [allKeys, requestLogs]);

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-['Space_Grotesk']">API Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Supervision globale de l'API publique</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          queryClient.invalidateQueries({ queryKey: ["admin-api-keys"] });
          queryClient.invalidateQueries({ queryKey: ["admin-api-logs"] });
        }}>
          <RefreshCw className="w-4 h-4 mr-2" /> Actualiser
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="dashboard"><BarChart3 className="w-4 h-4 mr-1.5" /> Dashboard</TabsTrigger>
          <TabsTrigger value="keys"><Key className="w-4 h-4 mr-1.5" /> Clés API</TabsTrigger>
          <TabsTrigger value="organizations"><Building2 className="w-4 h-4 mr-1.5" /> Organisations</TabsTrigger>
          <TabsTrigger value="logs"><Activity className="w-4 h-4 mr-1.5" /> Logs</TabsTrigger>
          <TabsTrigger value="security"><Shield className="w-4 h-4 mr-1.5" /> Sécurité</TabsTrigger>
        </TabsList>

        {/* ===== DASHBOARD ===== */}
        <TabsContent value="dashboard" className="space-y-6 mt-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: "Total requêtes", value: stats.totalRequests.toLocaleString(), icon: Activity, color: "text-primary" },
              { label: "Clés actives", value: stats.activeKeys, icon: Key, color: "text-chart-2" },
              { label: "Organisations", value: stats.orgsUsingApi, icon: Building2, color: "text-chart-3" },
              { label: "Taux d'erreurs", value: `${stats.errorRate}%`, icon: AlertTriangle, color: parseFloat(stats.errorRate) > 10 ? "text-destructive" : "text-chart-2" },
              { label: "Temps moyen", value: `${stats.avgResponseTime}ms`, icon: Clock, color: stats.avgResponseTime > 500 ? "text-chart-4" : "text-chart-2" },
            ].map((kpi) => (
              <Card key={kpi.label}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-muted ${kpi.color}`}>
                      <kpi.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                      <p className="text-xs text-muted-foreground">{kpi.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Alerts */}
          {abuseAlerts.length > 0 && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-5 h-5" /> Alertes détectées ({abuseAlerts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {abuseAlerts.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-background border">
                    <Badge variant={a.severity === "critical" ? "destructive" : "secondary"} className="text-xs">
                      {a.severity === "critical" ? "Critique" : "Attention"}
                    </Badge>
                    <span className="text-sm text-foreground">{a.message}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Charts */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Requêtes par jour</CardTitle>
                <div className="flex gap-2">
                  {["7", "14", "30"].map((p) => (
                    <Button key={p} size="sm" variant={logFilter.period === p ? "default" : "outline"} onClick={() => setLogFilter(prev => ({ ...prev, period: p }))}>
                      {p}j
                    </Button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={dailyChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                    <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Area type="monotone" dataKey="requests" name="Requêtes" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.15)" strokeWidth={2} />
                    <Area type="monotone" dataKey="errors" name="Erreurs" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive)/0.1)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Endpoints les plus utilisés</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={endpointChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                    <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="value" name="Requêtes" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Status distribution */}
          <div className="grid lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Distribution des statuts</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={statusPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false}>
                      {statusPieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Top organisations par utilisation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {orgStats.slice(0, 5).map((org) => (
                    <div key={org.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/40">
                      <div>
                        <p className="text-sm font-medium text-foreground">{org.nom}</p>
                        <p className="text-xs text-muted-foreground">{org.activeKeys} clé(s) active(s)</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">{org.requests.toLocaleString()} req</p>
                        {org.errors > 0 && <p className="text-xs text-destructive">{org.errors} erreurs</p>}
                      </div>
                    </div>
                  ))}
                  {orgStats.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Aucune donnée</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ===== KEYS ===== */}
        <TabsContent value="keys" className="space-y-4 mt-6">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Rechercher une clé ou organisation..." value={keyFilter} onChange={(e) => setKeyFilter(e.target.value)} className="pl-10" />
            </div>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Préfixe</TableHead>
                    <TableHead>Organisation</TableHead>
                    <TableHead>Scopes</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Créée le</TableHead>
                    <TableHead>Dernière utilisation</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keysLoading ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
                  ) : filteredKeys.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Aucune clé API trouvée</TableCell></TableRow>
                  ) : filteredKeys.map((key: any) => (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium text-foreground">{key.name}</TableCell>
                      <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{key.key_prefix}•••</code></TableCell>
                      <TableCell className="text-sm">{(key.companies as any)?.nom || "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {key.scopes?.map((s: string) => (
                            <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {key.is_active && !key.revoked_at ? (
                          <Badge className="bg-chart-2/15 text-chart-2 border-chart-2/30 text-xs"><CheckCircle2 className="w-3 h-3 mr-1" />Actif</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs"><XCircle className="w-3 h-3 mr-1" />Désactivé</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(key.created_at), "dd/MM/yyyy", { locale: fr })}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{key.last_used_at ? format(new Date(key.last_used_at), "dd/MM/yyyy HH:mm", { locale: fr }) : "Jamais"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => toggleKeyMutation.mutate({ id: key.id, is_active: !(key.is_active && !key.revoked_at) })}>
                            {key.is_active && !key.revoked_at ? <Ban className="w-3 h-3 mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                            {key.is_active && !key.revoked_at ? "Désactiver" : "Réactiver"}
                          </Button>
                          <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => { if (confirm("Supprimer définitivement cette clé ?")) deleteKeyMutation.mutate(key.id); }}>
                            Supprimer
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== ORGANIZATIONS ===== */}
        <TabsContent value="organizations" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Utilisation API par organisation</CardTitle>
              <CardDescription>Vue détaillée de la consommation API de chaque organisation</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organisation</TableHead>
                    <TableHead>Clés totales</TableHead>
                    <TableHead>Clés actives</TableHead>
                    <TableHead>Requêtes ({logFilter.period}j)</TableHead>
                    <TableHead>Erreurs</TableHead>
                    <TableHead>Taux d'erreurs</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orgStats.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucune organisation n'utilise l'API</TableCell></TableRow>
                  ) : orgStats.map((org) => {
                    const errRate = org.requests > 0 ? ((org.errors / org.requests) * 100).toFixed(1) : "0";
                    return (
                      <TableRow key={org.id}>
                        <TableCell className="font-medium text-foreground">{org.nom}</TableCell>
                        <TableCell>{org.keys}</TableCell>
                        <TableCell>{org.activeKeys}</TableCell>
                        <TableCell className="font-medium">{org.requests.toLocaleString()}</TableCell>
                        <TableCell>{org.errors > 0 ? <span className="text-destructive font-medium">{org.errors}</span> : "0"}</TableCell>
                        <TableCell>
                          <Badge variant={parseFloat(errRate) > 10 ? "destructive" : "secondary"} className="text-xs">{errRate}%</Badge>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={async () => {
                            if (!confirm(`Désactiver toutes les clés API de "${org.nom}" ?`)) return;
                            const keys = allKeys.filter((k: any) => k.company_id === org.id && k.is_active);
                            for (const k of keys) {
                              await supabase.from("api_keys").update({ is_active: false, revoked_at: new Date().toISOString() }).eq("id", k.id);
                            }
                            queryClient.invalidateQueries({ queryKey: ["admin-api-keys"] });
                            toast({ title: `Accès API de "${org.nom}" bloqué`, description: `${keys.length} clé(s) désactivée(s)` });
                          }}>
                            <Ban className="w-3 h-3 mr-1" /> Bloquer API
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== LOGS ===== */}
        <TabsContent value="logs" className="space-y-4 mt-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Rechercher endpoint, organisation, méthode..." value={logFilter.search} onChange={(e) => setLogFilter(prev => ({ ...prev, search: e.target.value }))} className="pl-10" />
            </div>
            <Select value={logFilter.status} onValueChange={(v) => setLogFilter(prev => ({ ...prev, status: v }))}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="success">Succès</SelectItem>
                <SelectItem value="error">Erreurs</SelectItem>
              </SelectContent>
            </Select>
            <Select value={logFilter.period} onValueChange={(v) => setLogFilter(prev => ({ ...prev, period: v }))}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">24h</SelectItem>
                <SelectItem value="7">7 jours</SelectItem>
                <SelectItem value="14">14 jours</SelectItem>
                <SelectItem value="30">30 jours</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline">{filteredLogs.length} résultats</Badge>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Organisation</TableHead>
                    <TableHead>Méthode</TableHead>
                    <TableHead>Endpoint</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Temps</TableHead>
                    <TableHead>Clé API</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
                  ) : filteredLogs.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun log trouvé</TableCell></TableRow>
                  ) : filteredLogs.slice(0, 100).map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(log.created_at), "dd/MM HH:mm:ss", { locale: fr })}</TableCell>
                      <TableCell className="text-sm">{(log.companies as any)?.nom || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-mono">{log.method}</Badge>
                      </TableCell>
                      <TableCell><code className="text-xs text-foreground">{log.endpoint}</code></TableCell>
                      <TableCell>
                        <Badge variant={log.status_code < 400 ? "secondary" : "destructive"} className="text-xs">
                          {log.status_code}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{log.response_time_ms ? `${log.response_time_ms}ms` : "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{(log.api_keys as any)?.name || (log.api_keys as any)?.key_prefix || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== SECURITY ===== */}
        <TabsContent value="security" className="space-y-6 mt-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-chart-4" /> Détection d'abus</CardTitle>
                <CardDescription>Comportements suspects détectés automatiquement</CardDescription>
              </CardHeader>
              <CardContent>
                {abuseAlerts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-chart-2" />
                    <p className="text-sm">Aucun comportement suspect détecté</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {abuseAlerts.map((a, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20">
                        {a.severity === "critical" ? <XCircle className="w-5 h-5 text-destructive mt-0.5" /> : <AlertTriangle className="w-5 h-5 text-chart-4 mt-0.5" />}
                        <div>
                          <p className="text-sm font-medium text-foreground">{a.message}</p>
                          <Badge variant={a.severity === "critical" ? "destructive" : "secondary"} className="text-[10px] mt-1">
                            {a.severity === "critical" ? "Critique" : "Attention"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Zap className="w-5 h-5 text-primary" /> Rate Limiting</CardTitle>
                <CardDescription>Configuration globale des limites</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg border bg-muted/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-foreground font-medium">Limite globale</span>
                    <Badge variant="outline">100 req/min</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Appliqué par clé API. Les requêtes au-delà de cette limite reçoivent un HTTP 429.</p>
                </div>
                <div className="p-4 rounded-lg border bg-muted/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-foreground font-medium">Fenêtre de temps</span>
                    <Badge variant="outline">1 minute</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Le compteur se réinitialise après chaque fenêtre d'une minute.</p>
                </div>
                <div className="p-4 rounded-lg border bg-muted/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-foreground font-medium">Headers de réponse</span>
                    <Badge variant="outline">Activé</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset inclus dans chaque réponse.</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-5 h-5 text-chart-3" /> Monitoring temps réel</CardTitle>
              <CardDescription>Dernières requêtes API</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {requestLogs.slice(0, 10).map((log: any) => (
                  <div key={log.id} className="flex items-center gap-3 p-2 rounded-lg border bg-muted/10 text-sm">
                    <Badge variant={log.status_code < 400 ? "secondary" : "destructive"} className="text-[10px] w-12 justify-center">{log.status_code}</Badge>
                    <Badge variant="outline" className="text-[10px] font-mono w-14 justify-center">{log.method}</Badge>
                    <code className="text-xs text-foreground flex-1 truncate">{log.endpoint}</code>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{log.response_time_ms}ms</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(log.created_at), "HH:mm:ss")}</span>
                  </div>
                ))}
                {requestLogs.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Aucune requête récente</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
