import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, RefreshCw, Shield, Building2, User, FileText, Package, ScrollText } from "lucide-react";

const ACTION_LABELS: Record<string, { verb: string; icon: any }> = {
  creation_organisation: { verb: "a créé l'organisation", icon: Building2 },
  suppression_organisation: { verb: "a supprimé l'organisation", icon: Building2 },
  activation_organisation: { verb: "a réactivé l'organisation", icon: Building2 },
  suspension_organisation: { verb: "a suspendu l'organisation", icon: Building2 },
  changement_plan: { verb: "a changé le plan de", icon: Package },
  statut_special: { verb: "a défini un statut spécial pour", icon: Building2 },
  activation_utilisateur: { verb: "a réactivé l'utilisateur", icon: User },
  desactivation_utilisateur: { verb: "a désactivé l'utilisateur", icon: User },
  diffusion_globale: { verb: "a envoyé une annonce globale", icon: ScrollText },
};

export default function AdminAuditGlobal() {
  const [logs, setLogs] = useState<any[]>([]);
  const [companies, setCompanies] = useState<Map<string, string>>(new Map());
  const [profiles, setProfiles] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  const fetchAll = async () => {
    setLoading(true);
    const [logsRes, cRes, pRes] = await Promise.all([
      supabase.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("companies").select("id, nom"),
      supabase.from("profiles").select("id, full_name"),
    ]);
    setLogs(logsRes.data ?? []);
    setCompanies(new Map((cRes.data ?? []).map((c: any) => [c.id, c.nom])));
    setProfiles(new Map((pRes.data ?? []).map((p: any) => [p.id, p.full_name ?? "Utilisateur"])));
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = useMemo(() => logs.filter(l => {
    const s = search.toLowerCase();
    if (actionFilter !== "all" && l.action !== actionFilter) return false;
    if (!s) return true;
    const actorName = profiles.get(l.user_id) ?? "";
    const orgName = companies.get(l.target_company_id) ?? "";
    return actorName.toLowerCase().includes(s) || orgName.toLowerCase().includes(s) || l.action.includes(s);
  }), [logs, search, actionFilter, profiles, companies]);

  const uniqueActions = useMemo(() => Array.from(new Set(logs.map(l => l.action))), [logs]);

  return (
    <div className="p-4 lg:p-8 space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-['Space_Grotesk'] flex items-center gap-2">
            <Shield className="w-6 h-6 text-destructive" /> Journal d'audit global
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Toutes les actions effectuées par les Super Admin</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll}><RefreshCw className="w-4 h-4 mr-2" /> Actualiser</Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="Rechercher acteur, organisation, action..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Toutes actions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les actions</SelectItem>
            {uniqueActions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {loading ? (
              <p className="text-center py-8 text-muted-foreground text-sm">Chargement...</p>
            ) : filtered.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">Aucune action enregistrée</p>
            ) : filtered.map(l => {
              const meta = ACTION_LABELS[l.action] ?? { verb: `a effectué ${l.action}`, icon: FileText };
              const Icon = meta.icon;
              const actor = profiles.get(l.user_id) ?? "Un administrateur";
              const org = companies.get(l.target_company_id) ?? (l.details?.nom ?? "");
              return (
                <div key={l.id} className="flex items-start gap-3 p-4 hover:bg-muted/30">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{actor}</span>{" "}
                      <span className="text-muted-foreground">{meta.verb}</span>{" "}
                      {org && <span className="font-medium">{org}</span>}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {new Date(l.created_at).toLocaleString("fr-FR")}
                      </span>
                      <Badge variant="outline" className="text-[10px]">{l.entity_type}</Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}