import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Edit, Package, Users, CalendarDays, HardDrive, FileText } from "lucide-react";
import { useAdminAuditLog } from "@/hooks/useAdminAuditLog";

export default function AdminPlans() {
  const { logAdminAction } = useAdminAuditLog();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editPlan, setEditPlan] = useState<any>(null);
  const [form, setForm] = useState({
    name: "", slug: "", description: "",
    price_monthly: 0, price_yearly: 0,
    max_users: 5, max_sessions: 10, max_storage_mb: 500, max_documents: 100,
    is_active: true,
  });

  const fetchPlans = async () => {
    const { data } = await supabase.from("subscription_plans").select("*").order("sort_order");
    setPlans(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchPlans(); }, []);

  const openEdit = (plan: any) => {
    setEditPlan(plan);
    setForm({
      name: plan.name, slug: plan.slug, description: plan.description ?? "",
      price_monthly: plan.price_monthly, price_yearly: plan.price_yearly,
      max_users: plan.max_users, max_sessions: plan.max_sessions,
      max_storage_mb: plan.max_storage_mb, max_documents: plan.max_documents,
      is_active: plan.is_active,
    });
  };

  const openCreate = () => {
    setEditPlan("new");
    setForm({
      name: "", slug: "", description: "",
      price_monthly: 0, price_yearly: 0,
      max_users: 5, max_sessions: 10, max_storage_mb: 500, max_documents: 100,
      is_active: true,
    });
  };

  const savePlan = async () => {
    if (!form.name || !form.slug) { toast.error("Nom et slug requis"); return; }

    if (editPlan === "new") {
      const { error } = await supabase.from("subscription_plans").insert({
        ...form, sort_order: plans.length + 1,
      });
      if (error) { toast.error(error.message); return; }
      toast.success("Plan créé");
    } else {
      const { error } = await supabase.from("subscription_plans").update(form).eq("id", editPlan.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Plan mis à jour");
    }
    setEditPlan(null);
    fetchPlans();
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Chargement...</div>;

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-['Space_Grotesk']">Plans & Tarifs</h1>
          <p className="text-muted-foreground text-sm mt-1">Gérez les plans d'abonnement</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Nouveau plan</Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {plans.map(plan => (
          <Card key={plan.id} className={!plan.is_active ? "opacity-60" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  {plan.name}
                </CardTitle>
                {!plan.is_active && <Badge variant="secondary">Inactif</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">{plan.description || plan.slug}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center py-3 bg-muted/30 rounded-lg">
                <p className="text-3xl font-bold text-foreground">{plan.price_monthly}€</p>
                <p className="text-xs text-muted-foreground">/ mois</p>
                <p className="text-sm text-muted-foreground mt-1">{plan.price_yearly}€ / an</p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span>{plan.max_users === -1 ? "Illimité" : plan.max_users} utilisateurs</span>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-muted-foreground" />
                  <span>{plan.max_sessions === -1 ? "Illimité" : plan.max_sessions} sessions</span>
                </div>
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-muted-foreground" />
                  <span>{plan.max_storage_mb === -1 ? "Illimité" : `${plan.max_storage_mb} Mo`} stockage</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span>{plan.max_documents === -1 ? "Illimité" : plan.max_documents} documents</span>
                </div>
              </div>

              <Button variant="outline" className="w-full" onClick={() => openEdit(plan)}>
                <Edit className="w-4 h-4 mr-2" /> Modifier
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!editPlan} onOpenChange={open => !open && setEditPlan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editPlan === "new" ? "Nouveau plan" : "Modifier le plan"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nom</Label>
                <Input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
              </div>
              <div>
                <Label>Slug</Label>
                <Input value={form.slug} onChange={e => setForm(f => ({...f, slug: e.target.value}))} />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Input value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Prix mensuel (€)</Label>
                <Input type="number" value={form.price_monthly} onChange={e => setForm(f => ({...f, price_monthly: +e.target.value}))} />
              </div>
              <div>
                <Label>Prix annuel (€)</Label>
                <Input type="number" value={form.price_yearly} onChange={e => setForm(f => ({...f, price_yearly: +e.target.value}))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Max utilisateurs (-1 = illimité)</Label>
                <Input type="number" value={form.max_users} onChange={e => setForm(f => ({...f, max_users: +e.target.value}))} />
              </div>
              <div>
                <Label>Max sessions</Label>
                <Input type="number" value={form.max_sessions} onChange={e => setForm(f => ({...f, max_sessions: +e.target.value}))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Stockage max (Mo)</Label>
                <Input type="number" value={form.max_storage_mb} onChange={e => setForm(f => ({...f, max_storage_mb: +e.target.value}))} />
              </div>
              <div>
                <Label>Max documents</Label>
                <Input type="number" value={form.max_documents} onChange={e => setForm(f => ({...f, max_documents: +e.target.value}))} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({...f, is_active: v}))} />
              <Label>Plan actif</Label>
            </div>
            <Button onClick={savePlan} className="w-full">Enregistrer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
