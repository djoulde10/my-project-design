import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History, User, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DataTable, type DataTableColumn, type DataTableFilter } from "@/components/ui/data-table";

const actionLabels: Record<string, string> = {
  INSERT: "Création", UPDATE: "Modification", DELETE: "Suppression",
  creation_utilisateur: "Création utilisateur", modification_role: "Modification rôle",
  suspension_utilisateur: "Suspension", activation_utilisateur: "Activation",
  liaison_membre_utilisateur: "Liaison membre", telechargement: "Téléchargement",
};

const actionColors: Record<string, string> = {
  INSERT: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  UPDATE: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  DELETE: "bg-destructive/10 text-destructive",
  creation_utilisateur: "bg-emerald-100 text-emerald-800",
  modification_role: "bg-amber-100 text-amber-800",
  suspension_utilisateur: "bg-destructive/10 text-destructive",
  activation_utilisateur: "bg-emerald-100 text-emerald-800",
  liaison_membre_utilisateur: "bg-blue-100 text-blue-800",
  telechargement: "bg-sky-100 text-sky-800",
};

const entityLabels: Record<string, string> = {
  sessions: "Sessions", agenda_items: "Points ODJ", documents: "Documents",
  minutes: "Procès-verbaux", minute_versions: "Versions PV", solutions: "Résolutions",
  actions: "Actions", members: "Membres", session_attendees: "Participants",
  decisions: "Résolutions", organs: "Organes", meetings: "Réunions",
  meeting_templates: "Modèles", profiles: "Profils", notifications: "Notifications",
  api_keys: "Clés API", comments: "Commentaires", companies: "Organisations",
  conflict_of_interests: "Conflits d'intérêts", entity_permissions: "Permissions entités",
  feature_flags: "Feature flags", role_permissions: "Permissions rôles", roles: "Rôles",
  support_tickets: "Tickets support", approval_requests: "Approbations",
  meeting_ai_analysis: "Analyses IA", invoices: "Factures",
  subscription_plans: "Plans d'abonnement", organization_usage: "Usage organisations",
  user_roles: "Rôles utilisateurs", login_logs: "Connexions", system_logs: "Logs système",
  document_downloads: "Téléchargements", signatures: "Signatures",
};

export default function AuditLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [detailLog, setDetailLog] = useState<any | null>(null);

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
      const { data } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(2000);
      setLogs(data ?? []);
      setLoading(false);
    };
    fetchLogs();
  }, []);

  const renderSummary = (log: any) => {
    const { action, details } = log;
    if (!details) return <span className="text-muted-foreground">—</span>;
    if (action === "UPDATE" && details.old && details.new) {
      const changed = Object.keys(details.new).filter(
        (k) => !["id", "created_at", "updated_at", "company_id"].includes(k) &&
          JSON.stringify(details.old[k]) !== JSON.stringify(details.new[k])
      );
      if (changed.length === 0) return <span className="text-muted-foreground">Aucun changement</span>;
      return <span className="text-xs">{changed.length} champ(s) modifié(s)</span>;
    }
    const obj = details.new ?? details.old ?? details;
    const titleField = Object.keys(obj).find((k) => ["title", "name", "full_name", "texte", "nom"].includes(k));
    if (titleField) return <span className="text-xs font-medium truncate max-w-xs block">{String(obj[titleField]).slice(0, 60)}</span>;
    return <span className="text-muted-foreground">—</span>;
  };

  const columns: DataTableColumn<any>[] = [
    {
      key: "date", label: "Date", width: "w-[150px]",
      accessor: (l) => l.created_at,
      render: (l) => (
        <span className="text-xs whitespace-nowrap">
          {new Date(l.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </span>
      ),
    },
    {
      key: "user", label: "Utilisateur", width: "w-[180px]",
      accessor: (l) => profiles[l.user_id] ?? "Système",
      render: (l) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0"><User className="w-3 h-3 text-primary" /></div>
          <span className="text-sm truncate max-w-[120px]">{profiles[l.user_id] ?? "Système"}</span>
        </div>
      ),
    },
    {
      key: "action", label: "Action", width: "w-[140px]",
      accessor: (l) => actionLabels[l.action] ?? l.action,
      render: (l) => <Badge className={actionColors[l.action] ?? "bg-muted text-muted-foreground"}>{actionLabels[l.action] ?? l.action}</Badge>,
    },
    {
      key: "entity", label: "Entité", width: "w-[150px]",
      accessor: (l) => entityLabels[l.entity_type] ?? l.entity_type ?? "",
      render: (l) => <Badge variant="outline" className="text-xs">{entityLabels[l.entity_type] ?? l.entity_type}</Badge>,
    },
    { key: "summary", label: "Résumé", render: renderSummary },
    {
      key: "actions", label: "", width: "w-[60px]", alwaysVisible: true,
      render: (l) => (
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setDetailLog(l); }}>
          <Eye className="w-3.5 h-3.5" />
        </Button>
      ),
    },
  ];

  const filters: DataTableFilter[] = [
    {
      key: "action", label: "Action",
      options: [
        { value: "INSERT", label: "Création" },
        { value: "UPDATE", label: "Modification" },
        { value: "DELETE", label: "Suppression" },
      ],
      predicate: (l, v) => l.action === v,
    },
    {
      key: "entity", label: "Entité",
      options: Object.entries(entityLabels).map(([v, l]) => ({ value: v, label: l })),
      predicate: (l, v) => l.entity_type === v,
    },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><History className="w-6 h-6" />Journal d'audit</h1>
        <p className="text-muted-foreground">Traçabilité complète des actions — {logs.length} enregistrements</p>
      </div>

      <DataTable
        storageKey="audit-log"
        data={logs}
        columns={columns}
        loading={loading}
        rowKey={(l) => l.id}
        filters={filters}
        searchPlaceholder="Rechercher (action, entité, utilisateur)…"
        searchableFields={[(l) => profiles[l.user_id] ?? ""]}
        emptyMessage="Aucun enregistrement"
        onRowClick={(l) => setDetailLog(l)}
        defaultPageSize={50}
        dense
      />

      {detailLog && (
        <Dialog open={!!detailLog} onOpenChange={(v) => !v && setDetailLog(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Détails — {actionLabels[detailLog.action] ?? detailLog.action} sur {entityLabels[detailLog.entity_type] ?? detailLog.entity_type}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Date :</span> {new Date(detailLog.created_at).toLocaleString("fr-FR")}</div>
                <div><span className="text-muted-foreground">Utilisateur :</span> {profiles[detailLog.user_id] ?? "Système"}</div>
                <div><span className="text-muted-foreground">ID entité :</span> <code className="text-xs bg-muted px-1 rounded">{detailLog.entity_id?.slice(0, 8)}...</code></div>
              </div>
              {detailLog.action === "UPDATE" && detailLog.details?.old && detailLog.details?.new ? (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Champs modifiés</h4>
                  <ScrollArea className="max-h-72">
                    <Table>
                      <TableHeader>
                        <TableRow><TableHead className="text-xs">Champ</TableHead><TableHead className="text-xs">Ancienne</TableHead><TableHead className="text-xs">Nouvelle</TableHead></TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.keys(detailLog.details.new).filter((k) => JSON.stringify(detailLog.details.old[k]) !== JSON.stringify(detailLog.details.new[k])).map((k) => (
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
                    <pre className="text-xs font-mono bg-muted rounded-lg p-3 whitespace-pre-wrap">{JSON.stringify(detailLog.details, null, 2)}</pre>
                  </ScrollArea>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
