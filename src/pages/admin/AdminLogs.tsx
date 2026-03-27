import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, RefreshCw, Eye, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 50;

const adminActionLabels: Record<string, string> = {
  INSERT: "Création",
  UPDATE: "Modification",
  DELETE: "Suppression",
  suspension_organisation: "Suspension org.",
  activation_organisation: "Activation org.",
  changement_plan: "Changement plan",
  statut_special: "Statut spécial",
  suppression_organisation: "Suppression org.",
  creation_organisation: "Création org.",
  toggle_feature_flag: "Toggle Feature Flag",
  enable_all_features: "Activation globale features",
  reponse_ticket: "Réponse ticket",
  changement_statut_ticket: "Changement statut ticket",
  creation_plan: "Création plan",
  modification_plan: "Modification plan",
  revocation_cle_api: "Révocation clé API",
  suppression_cle_api: "Suppression clé API",
};

const adminEntityLabels: Record<string, string> = {
  companies: "Organisations",
  subscription_plans: "Plans",
  invoices: "Factures",
  feature_flags: "Feature Flags",
  support_tickets: "Tickets support",
  user_roles: "Rôles utilisateurs",
  organization_usage: "Usage org.",
  api_keys: "Clés API",
  profiles: "Profils",
  system_logs: "Logs système",
  login_logs: "Connexions",
};

export default function AdminLogs() {
  const [adminLogs, setAdminLogs] = useState<any[]>([]);
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("admin");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [detailLog, setDetailLog] = useState<any | null>(null);

  useEffect(() => {
    supabase.from("profiles").select("id, full_name").then(({ data }) => {
      const map: Record<string, string> = {};
      (data ?? []).forEach((p) => { map[p.id] = p.full_name ?? "Super Admin"; });
      setProfiles(map);
    });
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    const [adminRes, sysRes] = await Promise.all([
      (() => {
        let q = (supabase.from("admin_audit_log" as any) as any)
          .select("*", { count: "exact" })
          .order("created_at", { ascending: false })
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        if (filter !== "all") q = q.eq("entity_type", filter);
        return q;
      })(),
      (() => {
        let q = supabase.from("system_logs").select("*, companies:company_id(nom)").order("created_at", { ascending: false }).limit(300);
        if (levelFilter !== "all") q = q.eq("level", levelFilter);
        return q;
      })(),
    ]);
    setAdminLogs(adminRes.data ?? []);
    setTotal(adminRes.count ?? 0);
    setSystemLogs(sysRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, [filter, levelFilter, page]);

  const actionColor = (action: string) => {
    if (action === "DELETE" || action.includes("suppression") || action.includes("revocation")) return "destructive";
    if (action === "INSERT" || action.includes("creation") || action.includes("activation")) return "default";
    return "secondary";
  };

  const levelColor = (level: string) => {
    switch (level) {
      case "error": return "destructive";
      case "warning": return "secondary";
      default: return "outline";
    }
  };

  const entityTypes = [...new Set(adminLogs.map(l => l.entity_type).filter(Boolean))];
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const filteredAdmin = adminLogs.filter(l =>
    !search || JSON.stringify(l).toLowerCase().includes(search.toLowerCase())
  );

  const filteredSystem = systemLogs.filter(l =>
    !search || l.message?.toLowerCase().includes(search.toLowerCase())
  );

  const renderSummary = (log: any) => {
    const { action, details } = log;
    if (!details) return <span className="text-muted-foreground">—</span>;

    if (action === "UPDATE" && details.old && details.new) {
      const changed = Object.keys(details.new).filter(
        (k) => !["id", "created_at", "updated_at"].includes(k) &&
          JSON.stringify(details.old[k]) !== JSON.stringify(details.new[k])
      );
      if (changed.length === 0) return <span className="text-muted-foreground">Aucun changement</span>;
      return (
        <div className="space-y-0.5 max-w-sm">
          {changed.slice(0, 2).map((k) => (
            <div key={k} className="text-xs truncate">
              <span className="font-medium text-foreground">{k}</span>:{" "}
              <span className="text-destructive/70 line-through">{JSON.stringify(details.old[k])?.slice(0, 25)}</span>{" "}
              → <span className="text-emerald-700 dark:text-emerald-400">{JSON.stringify(details.new[k])?.slice(0, 25)}</span>
            </div>
          ))}
          {changed.length > 2 && <span className="text-xs text-muted-foreground">+{changed.length - 2} champs</span>}
        </div>
      );
    }

    // Custom actions or INSERT/DELETE
    const obj = details.new ?? details.old ?? details;
    const titleField = Object.keys(obj).find((k) => ["nom", "name", "subject", "feature_key", "title"].includes(k));
    if (titleField) {
      return <span className="text-xs font-medium">{String(obj[titleField]).slice(0, 60)}</span>;
    }

    return <span className="text-xs text-muted-foreground truncate">{JSON.stringify(obj).slice(0, 60)}</span>;
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-['Space_Grotesk']">Logs système</h1>
          <p className="text-muted-foreground text-sm mt-1">Journal d'activité Super Admin & système — {total} actions admin</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchLogs}><RefreshCw className="w-4 h-4 mr-2" /> Actualiser</Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v); setPage(0); }}>
        <TabsList>
          <TabsTrigger value="admin">Actions Admin ({total})</TabsTrigger>
          <TabsTrigger value="system">Système ({systemLogs.length})</TabsTrigger>
        </TabsList>

        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-10" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {tab === "admin" && (
            <Select value={filter} onValueChange={(v) => { setFilter(v); setPage(0); }}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {entityTypes.map(t => <SelectItem key={t} value={t!}>{adminEntityLabels[t!] ?? t}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {tab === "system" && (
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Niveau" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        <TabsContent value="admin" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entité</TableHead>
                    <TableHead>Org. cible</TableHead>
                    <TableHead>Résumé</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
                  ) : filteredAdmin.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucune action admin</TableCell></TableRow>
                  ) : filteredAdmin.map(log => (
                    <TableRow key={log.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailLog(log)}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </TableCell>
                      <TableCell className="text-sm truncate max-w-[120px]">
                        {profiles[log.user_id] ?? "Super Admin"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={actionColor(log.action) as any}>
                          {adminActionLabels[log.action] ?? log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {adminEntityLabels[log.entity_type] ?? log.entity_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.target_company_id ? log.target_company_id.slice(0, 8) + "..." : "—"}
                      </TableCell>
                      <TableCell>{renderSummary(log)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setDetailLog(log); }}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">Page {page + 1} sur {totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Précédent
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  Suivant <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="system" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Niveau</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Organisation</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
                  ) : filteredSystem.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucun log</TableCell></TableRow>
                  ) : filteredSystem.map(log => (
                    <TableRow key={log.id}>
                      <TableCell><Badge variant={levelColor(log.level) as any}>{log.level}</Badge></TableCell>
                      <TableCell className="text-sm">{log.category}</TableCell>
                      <TableCell className="text-sm max-w-xs truncate">{log.message}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{(log as any).companies?.nom ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(log.created_at).toLocaleString("fr-FR")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={!!detailLog} onOpenChange={(v) => !v && setDetailLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Détails — {adminActionLabels[detailLog?.action] ?? detailLog?.action} sur {adminEntityLabels[detailLog?.entity_type] ?? detailLog?.entity_type}
            </DialogTitle>
          </DialogHeader>
          {detailLog && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Date :</span> {new Date(detailLog.created_at).toLocaleString("fr-FR")}</div>
                <div><span className="text-muted-foreground">Admin :</span> {profiles[detailLog.user_id] ?? "Super Admin"}</div>
                <div><span className="text-muted-foreground">ID entité :</span> <code className="text-xs bg-muted px-1 rounded">{detailLog.entity_id?.slice(0, 8)}...</code></div>
                <div><span className="text-muted-foreground">Org. cible :</span> <code className="text-xs bg-muted px-1 rounded">{detailLog.target_company_id?.slice(0, 8) ?? "—"}</code></div>
              </div>

              {detailLog.action === "UPDATE" && detailLog.details?.old && detailLog.details?.new ? (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Champs modifiés</h4>
                  <ScrollArea className="max-h-72">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Champ</TableHead>
                          <TableHead className="text-xs">Ancienne valeur</TableHead>
                          <TableHead className="text-xs">Nouvelle valeur</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.keys(detailLog.details.new)
                          .filter((k) => JSON.stringify(detailLog.details.old[k]) !== JSON.stringify(detailLog.details.new[k]))
                          .map((k) => (
                            <TableRow key={k}>
                              <TableCell className="font-mono text-xs font-medium">{k}</TableCell>
                              <TableCell className="text-xs text-destructive/70 max-w-[200px] truncate">{JSON.stringify(detailLog.details.old[k])}</TableCell>
                              <TableCell className="text-xs text-emerald-700 dark:text-emerald-400 max-w-[200px] truncate">{JSON.stringify(detailLog.details.new[k])}</TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              ) : (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Données</h4>
                  <ScrollArea className="max-h-72">
                    <pre className="text-xs font-mono bg-muted rounded-lg p-3 whitespace-pre-wrap">
                      {JSON.stringify(detailLog.details, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
