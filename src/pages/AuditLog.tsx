import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, History, ChevronLeft, ChevronRight, User, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

const actionLabels: Record<string, string> = {
  INSERT: "Création",
  UPDATE: "Modification",
  DELETE: "Suppression",
  creation_utilisateur: "Création utilisateur",
  modification_role: "Modification rôle",
  suspension_utilisateur: "Suspension",
  activation_utilisateur: "Activation",
  liaison_membre_utilisateur: "Liaison membre",
};

const actionColors: Record<string, string> = {
  INSERT: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  UPDATE: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  DELETE: "bg-destructive/10 text-destructive",
  creation_utilisateur: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  modification_role: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  suspension_utilisateur: "bg-destructive/10 text-destructive",
  activation_utilisateur: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  liaison_membre_utilisateur: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

const entityLabels: Record<string, string> = {
  sessions: "Sessions",
  agenda_items: "Points ODJ",
  documents: "Documents",
  minutes: "Procès-verbaux",
  minute_versions: "Versions PV",
  solutions: "Résolutions",
  actions: "Actions",
  members: "Membres",
  session_attendees: "Participants",
  decisions: "Résolutions",
  organs: "Organes",
  signatures: "Signatures",
  meetings: "Réunions",
  meeting_templates: "Modèles",
  profiles: "Profils",
  notifications: "Notifications",
};

const PAGE_SIZE = 50;

export default function AuditLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [filterEntity, setFilterEntity] = useState("all");
  const [filterAction, setFilterAction] = useState("all");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailLog, setDetailLog] = useState<any | null>(null);

  // Fetch profiles for user names
  useEffect(() => {
    supabase.from("profiles").select("id, full_name").then(({ data }) => {
      const map: Record<string, string> = {};
      (data ?? []).forEach((p) => { map[p.id] = p.full_name ?? "Utilisateur inconnu"; });
      setProfiles(map);
    });
  }, []);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      let query = supabase
        .from("audit_log")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (filterEntity !== "all") {
        query = query.eq("entity_type", filterEntity);
      }
      if (filterAction !== "all") {
        query = query.eq("action", filterAction);
      }

      const { data, count } = await query;
      setLogs(data ?? []);
      setTotal(count ?? 0);
      setLoading(false);
    };
    fetchLogs();
  }, [filterEntity, filterAction, page]);

  const filtered = useMemo(() => {
    if (!search) return logs;
    const s = search.toLowerCase();
    return logs.filter((l) =>
      (actionLabels[l.action] ?? l.action)?.toLowerCase().includes(s) ||
      (entityLabels[l.entity_type] ?? l.entity_type)?.toLowerCase().includes(s) ||
      profiles[l.user_id]?.toLowerCase().includes(s)
    );
  }, [logs, search, profiles]);

  const entityTypes = Object.keys(entityLabels);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const renderSummary = (log: any) => {
    const { action, entity_type, details } = log;
    if (!details) return <span className="text-muted-foreground">—</span>;

    // For UPDATE, show changed fields
    if (action === "UPDATE" && details.old && details.new) {
      const oldObj = details.old;
      const newObj = details.new;
      const changed = Object.keys(newObj).filter(
        (k) => !["id", "created_at", "updated_at", "company_id"].includes(k) &&
          JSON.stringify(oldObj[k]) !== JSON.stringify(newObj[k])
      );
      if (changed.length === 0) return <span className="text-muted-foreground">Aucun changement</span>;
      return (
        <div className="space-y-0.5 max-w-sm">
          {changed.slice(0, 3).map((k) => (
            <div key={k} className="text-xs truncate">
              <span className="font-medium text-foreground">{k}</span>:{" "}
              <span className="text-destructive/70 line-through">{JSON.stringify(oldObj[k])?.slice(0, 30)}</span>{" "}
              → <span className="text-emerald-700 dark:text-emerald-400">{JSON.stringify(newObj[k])?.slice(0, 30)}</span>
            </div>
          ))}
          {changed.length > 3 && (
            <span className="text-xs text-muted-foreground">+{changed.length - 3} autres champs</span>
          )}
        </div>
      );
    }

    // For INSERT/DELETE or custom actions, show key fields
    const obj = details.new ?? details.old ?? details;
    const keys = Object.keys(obj).filter(
      (k) => !["id", "created_at", "updated_at", "company_id", "old", "new"].includes(k)
    );
    if (keys.length === 0) return <span className="text-muted-foreground">—</span>;

    // Show a meaningful summary
    const titleField = keys.find((k) => ["title", "name", "full_name", "texte", "nom"].includes(k));
    if (titleField) {
      return (
        <span className="text-xs font-medium">
          {String(obj[titleField]).slice(0, 60)}
        </span>
      );
    }

    return (
      <div className="text-xs max-w-xs truncate">
        {keys.slice(0, 2).map((k) => (
          <span key={k} className="mr-2">
            <span className="text-muted-foreground">{k}:</span> {JSON.stringify(obj[k])?.slice(0, 25)}
          </span>
        ))}
      </div>
    );
  };

  const renderDetailDialog = () => {
    if (!detailLog) return null;
    const { action, details } = detailLog;
    let content: any = details;

    return (
      <Dialog open={!!detailLog} onOpenChange={(v) => !v && setDetailLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Détails — {actionLabels[action] ?? action} sur {entityLabels[detailLog.entity_type] ?? detailLog.entity_type}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Date :</span>{" "}
                {new Date(detailLog.created_at).toLocaleString("fr-FR")}
              </div>
              <div>
                <span className="text-muted-foreground">Utilisateur :</span>{" "}
                {profiles[detailLog.user_id] ?? "Système"}
              </div>
              <div>
                <span className="text-muted-foreground">ID entité :</span>{" "}
                <code className="text-xs bg-muted px-1 rounded">{detailLog.entity_id?.slice(0, 8)}...</code>
              </div>
            </div>

            {action === "UPDATE" && content?.old && content?.new ? (
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
                      {Object.keys(content.new)
                        .filter((k) => JSON.stringify(content.old[k]) !== JSON.stringify(content.new[k]))
                        .map((k) => (
                          <TableRow key={k}>
                            <TableCell className="font-mono text-xs font-medium">{k}</TableCell>
                            <TableCell className="text-xs text-destructive/70 max-w-[200px] truncate">
                              {JSON.stringify(content.old[k])}
                            </TableCell>
                            <TableCell className="text-xs text-emerald-700 dark:text-emerald-400 max-w-[200px] truncate">
                              {JSON.stringify(content.new[k])}
                            </TableCell>
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
                    {JSON.stringify(content, null, 2)}
                  </pre>
                </ScrollArea>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <History className="w-6 h-6" />
          Journal d'audit
        </h1>
        <p className="text-muted-foreground">
          Traçabilité complète de toutes les actions des utilisateurs — {total} enregistrements
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Rechercher par action, entité, utilisateur..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterAction} onValueChange={(v) => { setFilterAction(v); setPage(0); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Toutes les actions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les actions</SelectItem>
            <SelectItem value="INSERT">Création</SelectItem>
            <SelectItem value="UPDATE">Modification</SelectItem>
            <SelectItem value="DELETE">Suppression</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterEntity} onValueChange={(v) => { setFilterEntity(v); setPage(0); }}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Toutes les entités" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les entités</SelectItem>
            {entityTypes.map((t) => (
              <SelectItem key={t} value={t}>{entityLabels[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entité</TableHead>
                <TableHead>Résumé</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Aucun enregistrement
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((l) => (
                  <TableRow key={l.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailLog(l)}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString("fr-FR", {
                        day: "2-digit", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <User className="w-3 h-3 text-primary" />
                        </div>
                        <span className="text-sm truncate max-w-[120px]">
                          {profiles[l.user_id] ?? "Système"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={actionColors[l.action] ?? "bg-muted text-muted-foreground"}>
                        {actionLabels[l.action] ?? l.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {entityLabels[l.entity_type] ?? l.entity_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{renderSummary(l)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setDetailLog(l); }}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page + 1} sur {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Précédent
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
              Suivant <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {renderDetailDialog()}
    </div>
  );
}
