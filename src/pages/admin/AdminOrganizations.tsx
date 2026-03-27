import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Search, Building2, Ban, CheckCircle, Trash2, Eye, Star, TestTube, ArrowUpDown, Users, CalendarDays, FileText, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminAuditLog } from "@/hooks/useAdminAuditLog";

export default function AdminOrganizations() {
  const { logAdminAction } = useAdminAuditLog();
  const [orgs, setOrgs] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOrg, setDetailOrg] = useState<any>(null);
  const [orgUsage, setOrgUsage] = useState<any>(null);
  const [orgProfiles, setOrgProfiles] = useState<any[]>([]);
  const [form, setForm] = useState({ nom: "", secteur: "", pays: "", plan_id: "" });

  const fetchOrgs = async () => {
    const { data } = await supabase
      .from("companies")
      .select("*, subscription_plans(name, price_monthly)")
      .order("created_at", { ascending: false });
    setOrgs(data ?? []);
    setLoading(false);
  };

  const fetchPlans = async () => {
    const { data } = await supabase.from("subscription_plans").select("*").eq("is_active", true).order("sort_order");
    setPlans(data ?? []);
  };

  useEffect(() => { fetchOrgs(); fetchPlans(); }, []);

  const toggleStatus = async (org: any) => {
    const newStatus = org.statut === "actif" ? "suspendu" : "actif";
    const { error } = await supabase.from("companies").update({ statut: newStatus }).eq("id", org.id);
    if (error) { toast.error("Erreur"); return; }
    logAdminAction({ action: newStatus === "actif" ? "activation_organisation" : "suspension_organisation", entity_type: "companies", entity_id: org.id, target_company_id: org.id, details: { nom: org.nom, old_statut: org.statut, new_statut: newStatus } });
    toast.success(`Organisation ${newStatus === "actif" ? "activée" : "suspendue"}`);
    fetchOrgs();
  };

  const deleteOrg = async (org: any) => {
    if (!confirm(`Supprimer définitivement "${org.nom}" ? Cette action est irréversible.`)) return;
    const { error } = await supabase.from("companies").delete().eq("id", org.id);
    if (error) { toast.error("Erreur: " + error.message); return; }
    logAdminAction({ action: "suppression_organisation", entity_type: "companies", entity_id: org.id, target_company_id: org.id, details: { nom: org.nom } });
    toast.success("Organisation supprimée");
    setDetailOrg(null);
    fetchOrgs();
  };

  const setSpecialStatus = async (org: any, status: string | null) => {
    const { error } = await supabase.from("companies").update({ special_status: status } as any).eq("id", org.id);
    if (error) { toast.error("Erreur"); return; }
    logAdminAction({ action: "statut_special", entity_type: "companies", entity_id: org.id, target_company_id: org.id, details: { nom: org.nom, special_status: status } });
    toast.success("Statut spécial mis à jour");
    fetchOrgs();
  };

  const changePlan = async (org: any, planId: string) => {
    const { error } = await supabase.from("companies").update({ plan_id: planId }).eq("id", org.id);
    if (error) { toast.error("Erreur"); return; }
    toast.success("Plan modifié");
    fetchOrgs();
  };

  const openDetail = async (org: any) => {
    setDetailOrg(org);
    const [usageRes, profilesRes] = await Promise.all([
      supabase.from("organization_usage").select("*").eq("company_id", org.id).maybeSingle(),
      supabase.from("profiles").select("id, full_name, statut, created_at").eq("company_id", org.id),
    ]);
    setOrgUsage(usageRes.data);
    setOrgProfiles(profilesRes.data ?? []);
  };

  const createOrg = async () => {
    if (!form.nom.trim()) { toast.error("Le nom est requis"); return; }
    const { error } = await supabase.from("companies").insert({
      nom: form.nom, secteur: form.secteur || null, pays: form.pays || null,
      plan_id: form.plan_id || null, statut: "actif",
    });
    if (error) { toast.error("Erreur: " + error.message); return; }
    toast.success("Organisation créée");
    setCreateOpen(false);
    setForm({ nom: "", secteur: "", pays: "", plan_id: "" });
    fetchOrgs();
  };

  // Health score
  const healthScore = (org: any) => {
    let score = 0;
    if (org.statut === "actif") score += 30;
    if (org.plan_id) score += 20;
    // We add arbitrary scores based on existence
    score += Math.min(50, (orgProfiles?.length ?? 0) * 10);
    return Math.min(100, score);
  };

  const filtered = orgs.filter(o => {
    const matchSearch = o.nom.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || o.statut === statusFilter;
    return matchSearch && matchStatus;
  });

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Chargement...</div>;

  return (
    <div className="p-4 lg:p-8 space-y-6 overflow-y-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-['Space_Grotesk']">Organisations</h1>
          <p className="text-muted-foreground text-sm mt-1">{orgs.length} organisation(s)</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Nouvelle organisation</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Créer une organisation</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div><Label>Nom *</Label><Input value={form.nom} onChange={e => setForm(f => ({...f, nom: e.target.value}))} placeholder="Nom" /></div>
              <div><Label>Secteur</Label><Input value={form.secteur} onChange={e => setForm(f => ({...f, secteur: e.target.value}))} /></div>
              <div><Label>Pays</Label><Input value={form.pays} onChange={e => setForm(f => ({...f, pays: e.target.value}))} /></div>
              <div>
                <Label>Plan</Label>
                <Select value={form.plan_id} onValueChange={v => setForm(f => ({...f, plan_id: v}))}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>{plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name} — {p.price_monthly}€/mois</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button onClick={createOrg} className="w-full">Créer</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="actif">Actives</SelectItem>
            <SelectItem value="suspendu">Suspendues</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organisation</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Spécial</TableHead>
                <TableHead>Inscrite le</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(org => (
                <TableRow key={org.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(org)}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p>{org.nom}</p>
                        <p className="text-xs text-muted-foreground">{org.secteur ?? ""} {org.pays ? `· ${org.pays}` : ""}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{(org as any).subscription_plans?.name ?? "—"}</Badge></TableCell>
                  <TableCell><Badge variant={org.statut === "actif" ? "default" : "destructive"}>{org.statut}</Badge></TableCell>
                  <TableCell>
                    {org.special_status && <Badge variant="outline">{org.special_status}</Badge>}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{new Date(org.created_at).toLocaleDateString("fr-FR")}</TableCell>
                  <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openDetail(org)}><Eye className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => toggleStatus(org)}>
                        {org.statut === "actif" ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteOrg(org)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucune organisation trouvée</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!detailOrg} onOpenChange={open => !open && setDetailOrg(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" /> {detailOrg?.nom}
            </DialogTitle>
          </DialogHeader>
          {detailOrg && (
            <Tabs defaultValue="info" className="mt-2">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="info">Info</TabsTrigger>
                <TabsTrigger value="usage">Quotas</TabsTrigger>
                <TabsTrigger value="users">Utilisateurs</TabsTrigger>
                <TabsTrigger value="actions">Actions</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Secteur:</span> <span className="ml-2">{detailOrg.secteur ?? "—"}</span></div>
                  <div><span className="text-muted-foreground">Pays:</span> <span className="ml-2">{detailOrg.pays ?? "—"}</span></div>
                  <div><span className="text-muted-foreground">Statut:</span> <Badge className="ml-2" variant={detailOrg.statut === "actif" ? "default" : "destructive"}>{detailOrg.statut}</Badge></div>
                  <div><span className="text-muted-foreground">Plan:</span> <Badge className="ml-2" variant="secondary">{(detailOrg as any).subscription_plans?.name ?? "—"}</Badge></div>
                  <div><span className="text-muted-foreground">Inscription:</span> <span className="ml-2">{new Date(detailOrg.created_at).toLocaleDateString("fr-FR")}</span></div>
                  <div><span className="text-muted-foreground">Spécial:</span> <span className="ml-2">{detailOrg.special_status ?? "Aucun"}</span></div>
                </div>
              </TabsContent>

              <TabsContent value="usage" className="mt-4">
                {orgUsage ? (
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "Utilisateurs", value: orgUsage.current_users, icon: Users },
                      { label: "Sessions", value: orgUsage.current_sessions, icon: CalendarDays },
                      { label: "Documents", value: orgUsage.current_documents, icon: FileText },
                      { label: "Stockage", value: `${orgUsage.current_storage_mb} Mo`, icon: Activity },
                    ].map(q => (
                      <Card key={q.label}>
                        <CardContent className="p-3 flex items-center gap-3">
                          <q.icon className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">{q.label}</p>
                            <p className="font-bold">{q.value}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucune donnée d'utilisation</p>
                )}
              </TabsContent>

              <TabsContent value="users" className="mt-4">
                <div className="space-y-2">
                  {orgProfiles.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun utilisateur</p>
                  ) : orgProfiles.map(p => (
                    <div key={p.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <span className="text-sm">{p.full_name ?? "Sans nom"}</span>
                      <Badge variant={p.statut === "actif" ? "default" : "secondary"}>{p.statut}</Badge>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="actions" className="mt-4 space-y-3">
                <div>
                  <Label className="text-sm">Changer de plan</Label>
                  <Select onValueChange={v => changePlan(detailOrg, v)} value={detailOrg.plan_id ?? ""}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Sélectionner un plan" /></SelectTrigger>
                    <SelectContent>{plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Statut spécial</Label>
                  <div className="flex gap-2 mt-1">
                    <Button variant="outline" size="sm" onClick={() => setSpecialStatus(detailOrg, "VIP")}><Star className="w-3 h-3 mr-1" /> VIP</Button>
                    <Button variant="outline" size="sm" onClick={() => setSpecialStatus(detailOrg, "test")}><TestTube className="w-3 h-3 mr-1" /> Test</Button>
                    <Button variant="outline" size="sm" onClick={() => setSpecialStatus(detailOrg, null)}>Aucun</Button>
                  </div>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button variant={detailOrg.statut === "actif" ? "destructive" : "default"} onClick={() => { toggleStatus(detailOrg); setDetailOrg(null); }}>
                    {detailOrg.statut === "actif" ? <><Ban className="w-4 h-4 mr-1" /> Suspendre</> : <><CheckCircle className="w-4 h-4 mr-1" /> Activer</>}
                  </Button>
                  <Button variant="destructive" onClick={() => deleteOrg(detailOrg)}>
                    <Trash2 className="w-4 h-4 mr-1" /> Supprimer
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
