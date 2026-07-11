import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Users, ShieldCheck, ShieldOff, RefreshCw, UserCog } from "lucide-react";
import { toast } from "sonner";
import { useAdminAuditLog } from "@/hooks/useAdminAuditLog";

export default function AdminUsers() {
  const { logAdminAction } = useAdminAuditLog();
  const [users, setUsers] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [orgFilter, setOrgFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchAll = async () => {
    setLoading(true);
    const [profilesRes, orgsRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name, statut, company_id, created_at, roles(nom), companies(nom)").order("created_at", { ascending: false }).limit(500),
      supabase.from("companies").select("id, nom").order("nom"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const rolesByUser = new Map<string, string[]>();
    (rolesRes.data ?? []).forEach((r: any) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    });
    setUsers((profilesRes.data ?? []).map((p: any) => ({ ...p, app_roles: rolesByUser.get(p.id) ?? [] })));
    setOrgs(orgsRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const toggleStatus = async (u: any) => {
    const newStatus = u.statut === "actif" ? "inactif" : "actif";
    const { error } = await supabase.from("profiles").update({ statut: newStatus }).eq("id", u.id);
    if (error) { toast.error("Erreur: " + error.message); return; }
    logAdminAction({ action: newStatus === "actif" ? "activation_utilisateur" : "desactivation_utilisateur", entity_type: "profiles", entity_id: u.id, target_company_id: u.company_id, details: { full_name: u.full_name, old: u.statut, new: newStatus } });
    toast.success(newStatus === "actif" ? "Utilisateur réactivé" : "Utilisateur désactivé");
    fetchAll();
  };

  const filtered = useMemo(() => users.filter(u => {
    const s = search.toLowerCase();
    const matchS = !s || (u.full_name ?? "").toLowerCase().includes(s) || (u.companies?.nom ?? "").toLowerCase().includes(s);
    const matchO = orgFilter === "all" || u.company_id === orgFilter;
    const matchSt = statusFilter === "all" || u.statut === statusFilter;
    return matchS && matchO && matchSt;
  }), [users, search, orgFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter(u => u.statut === "actif").length,
    inactive: users.filter(u => u.statut !== "actif").length,
    admins: users.filter(u => u.app_roles.some((r: string) => r.startsWith("admin") || r === "super_admin")).length,
  }), [users]);

  return (
    <div className="p-4 lg:p-8 space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-['Space_Grotesk']">Utilisateurs globaux</h1>
          <p className="text-muted-foreground text-sm mt-1">Tous les utilisateurs de la plateforme, toutes organisations confondues</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll}><RefreshCw className="w-4 h-4 mr-2" /> Actualiser</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, icon: Users, color: "text-foreground" },
          { label: "Actifs", value: stats.active, icon: ShieldCheck, color: "text-success" },
          { label: "Inactifs", value: stats.inactive, icon: ShieldOff, color: "text-muted-foreground" },
          { label: "Admins", value: stats.admins, icon: UserCog, color: "text-destructive" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={"w-5 h-5 " + s.color} />
              <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl font-bold">{s.value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="Rechercher nom ou organisation..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={orgFilter} onValueChange={setOrgFilter}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Organisation" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes organisations</SelectItem>
            {orgs.map(o => <SelectItem key={o.id} value={o.id}>{o.nom}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="actif">Actifs</SelectItem>
            <SelectItem value="inactif">Inactifs</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Organisation</TableHead>
                <TableHead>Rôle métier</TableHead>
                <TableHead>Rôle application</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Créé le</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun utilisateur</TableCell></TableRow>
              ) : filtered.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name ?? "—"}</TableCell>
                  <TableCell className="text-sm">{u.companies?.nom ?? "—"}</TableCell>
                  <TableCell className="text-sm">{u.roles?.nom ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.app_roles.length === 0 ? <span className="text-xs text-muted-foreground">—</span> :
                        u.app_roles.map((r: string) => (
                          <Badge key={r} variant={r.includes("super_admin") ? "destructive" : r.includes("admin") ? "default" : "secondary"} className="text-[10px]">{r}</Badge>
                        ))}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant={u.statut === "actif" ? "default" : "secondary"}>{u.statut}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString("fr-FR")}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => toggleStatus(u)}>
                      {u.statut === "actif" ? <ShieldOff className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}