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
import { toast } from "sonner";
import { Plus, Search, Building2, Ban, CheckCircle } from "lucide-react";

export default function AdminOrganizations() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ nom: "", secteur: "", pays: "", plan_id: "" });

  const fetchOrgs = async () => {
    const { data } = await supabase
      .from("companies")
      .select("*, subscription_plans(name)")
      .order("created_at", { ascending: false });
    setOrgs(data ?? []);
    setLoading(false);
  };

  const fetchPlans = async () => {
    const { data } = await supabase.from("subscription_plans").select("*").eq("is_active", true).order("sort_order");
    setPlans(data ?? []);
  };

  useEffect(() => {
    fetchOrgs();
    fetchPlans();
  }, []);

  const toggleStatus = async (org: any) => {
    const newStatus = org.statut === "actif" ? "suspendu" : "actif";
    const { error } = await supabase.from("companies").update({ statut: newStatus }).eq("id", org.id);
    if (error) {
      toast.error("Erreur lors de la mise à jour");
      return;
    }
    toast.success(`Organisation ${newStatus === "actif" ? "activée" : "suspendue"}`);
    fetchOrgs();
  };

  const createOrg = async () => {
    if (!form.nom.trim()) { toast.error("Le nom est requis"); return; }
    const { error } = await supabase.from("companies").insert({
      nom: form.nom,
      secteur: form.secteur || null,
      pays: form.pays || null,
      plan_id: form.plan_id || null,
      statut: "actif",
    });
    if (error) {
      toast.error("Erreur: " + error.message);
      return;
    }
    toast.success("Organisation créée");
    setCreateOpen(false);
    setForm({ nom: "", secteur: "", pays: "", plan_id: "" });
    fetchOrgs();
  };

  const filtered = orgs.filter(o =>
    o.nom.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Chargement...</div>;

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-['Space_Grotesk']">Organisations</h1>
          <p className="text-muted-foreground text-sm mt-1">{orgs.length} organisation(s) inscrite(s)</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Nouvelle organisation</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Créer une organisation</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Nom *</Label>
                <Input value={form.nom} onChange={e => setForm(f => ({...f, nom: e.target.value}))} placeholder="Nom de l'organisation" />
              </div>
              <div>
                <Label>Secteur</Label>
                <Input value={form.secteur} onChange={e => setForm(f => ({...f, secteur: e.target.value}))} placeholder="Finance, Tech..." />
              </div>
              <div>
                <Label>Pays</Label>
                <Input value={form.pays} onChange={e => setForm(f => ({...f, pays: e.target.value}))} placeholder="France, Maroc..." />
              </div>
              <div>
                <Label>Plan d'abonnement</Label>
                <Select value={form.plan_id} onValueChange={v => setForm(f => ({...f, plan_id: v}))}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un plan" /></SelectTrigger>
                  <SelectContent>
                    {plans.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name} — {p.price_monthly}€/mois</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={createOrg} className="w-full">Créer</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-10" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organisation</TableHead>
                <TableHead>Secteur</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Inscrite le</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(org => (
                <TableRow key={org.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      {org.nom}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{org.secteur ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{(org as any).subscription_plans?.name ?? org.plan_abonnement ?? "—"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={org.statut === "actif" ? "default" : "destructive"}>
                      {org.statut}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(org.created_at).toLocaleDateString("fr-FR")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => toggleStatus(org)}>
                      {org.statut === "actif" ? (
                        <><Ban className="w-4 h-4 mr-1" /> Suspendre</>
                      ) : (
                        <><CheckCircle className="w-4 h-4 mr-1" /> Activer</>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Aucune organisation trouvée
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
