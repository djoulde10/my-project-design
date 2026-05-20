import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  History, User, Eye, Search, CalendarDays, FileText, Users, Shield, FolderOpen,
  Gavel, ClipboardCheck, Sparkles, Mail, Download, Key, Building2, AlertCircle,
  CheckCircle2, Trash2, Pencil, PlusCircle,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import PageSkeleton from "@/components/PageSkeleton";

// ------------- Catégorisation métier -------------
type Category =
  | "meetings" | "minutes" | "documents" | "decisions" | "actions"
  | "members" | "permissions" | "ai" | "convocations" | "other";

const categoryMeta: Record<Category, { label: string; icon: any; color: string; bg: string; ring: string }> = {
  meetings:     { label: "Réunions",      icon: CalendarDays,    color: "text-blue-600 dark:text-blue-400",    bg: "bg-blue-500/10",    ring: "ring-blue-500/20" },
  minutes:      { label: "Procès-verbaux",icon: ClipboardCheck,  color: "text-violet-600 dark:text-violet-400",bg: "bg-violet-500/10",  ring: "ring-violet-500/20" },
  documents:    { label: "Documents",     icon: FolderOpen,      color: "text-amber-600 dark:text-amber-400",  bg: "bg-amber-500/10",   ring: "ring-amber-500/20" },
  decisions:    { label: "Décisions",     icon: Gavel,           color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", ring: "ring-emerald-500/20" },
  actions:      { label: "Actions",       icon: CheckCircle2,    color: "text-sky-600 dark:text-sky-400",      bg: "bg-sky-500/10",     ring: "ring-sky-500/20" },
  members:      { label: "Membres",       icon: Users,           color: "text-indigo-600 dark:text-indigo-400",bg: "bg-indigo-500/10",  ring: "ring-indigo-500/20" },
  permissions:  { label: "Permissions",   icon: Shield,          color: "text-rose-600 dark:text-rose-400",    bg: "bg-rose-500/10",    ring: "ring-rose-500/20" },
  ai:           { label: "Intelligence",  icon: Sparkles,        color: "text-fuchsia-600 dark:text-fuchsia-400", bg: "bg-fuchsia-500/10", ring: "ring-fuchsia-500/20" },
  convocations: { label: "Convocations",  icon: Mail,            color: "text-cyan-600 dark:text-cyan-400",    bg: "bg-cyan-500/10",    ring: "ring-cyan-500/20" },
  other:        { label: "Autre",         icon: History,         color: "text-muted-foreground",                bg: "bg-muted",          ring: "ring-border" },
};

// Tables techniques à masquer complètement de l'interface métier
const HIDDEN_ENTITIES = new Set([
  "notifications", "api_request_logs", "login_logs", "system_logs",
  "organization_usage", "feature_flags", "audit_log", "admin_audit_log",
  "session_attendees", // bruité, agrégé via "members" / "convocations"
  "minute_versions",   // versionnage interne, agrégé via "minutes"
]);

const entityToCategory = (entity: string): Category => {
  switch (entity) {
    case "sessions": case "meetings": case "agenda_items": case "meeting_templates":
      return "meetings";
    case "minutes": return "minutes";
    case "documents": case "document_downloads": return "documents";
    case "decisions": case "solutions": return "decisions";
    case "actions": return "actions";
    case "members": case "profiles": case "user_roles": return "members";
    case "entity_permissions": case "role_permissions": case "roles": case "api_keys":
      return "permissions";
    case "meeting_ai_analysis": return "ai";
    case "convocation_views": return "convocations";
    default: return "other";
  }
};

const entityNouns: Record<string, { sing: string; plur: string; det: string }> = {
  sessions:           { sing: "la session",          plur: "sessions",         det: "une session" },
  meetings:           { sing: "la réunion",          plur: "réunions",         det: "une réunion" },
  agenda_items:       { sing: "le point d'ordre du jour", plur: "points d'ordre du jour", det: "un point d'ordre du jour" },
  meeting_templates:  { sing: "le modèle de PV",     plur: "modèles de PV",    det: "un modèle de PV" },
  minutes:            { sing: "le procès-verbal",    plur: "procès-verbaux",   det: "un procès-verbal" },
  documents:          { sing: "le document",         plur: "documents",        det: "un document" },
  document_downloads: { sing: "le téléchargement",   plur: "téléchargements",  det: "un téléchargement" },
  decisions:          { sing: "la décision",         plur: "décisions",        det: "une décision" },
  actions:            { sing: "l'action",            plur: "actions",          det: "une action" },
  members:            { sing: "le membre",           plur: "membres",          det: "un membre" },
  profiles:           { sing: "le profil",           plur: "profils",          det: "un profil" },
  user_roles:         { sing: "le rôle",             plur: "rôles",            det: "un rôle" },
  entity_permissions: { sing: "la permission",       plur: "permissions",      det: "une permission" },
  role_permissions:   { sing: "la permission de rôle", plur: "permissions de rôle", det: "une permission" },
  roles:              { sing: "le rôle",             plur: "rôles",            det: "un rôle" },
  api_keys:           { sing: "la clé API",          plur: "clés API",         det: "une clé API" },
  meeting_ai_analysis:{ sing: "l'analyse IA",        plur: "analyses IA",      det: "une analyse IA" },
  convocation_views:  { sing: "la convocation",      plur: "convocations",     det: "une convocation" },
  organs:             { sing: "l'organe",            plur: "organes",          det: "un organe" },
  approval_requests:  { sing: "la demande d'approbation", plur: "demandes d'approbation", det: "une demande d'approbation" },
  comments:           { sing: "le commentaire",      plur: "commentaires",     det: "un commentaire" },
  conflict_of_interests: { sing: "la déclaration de conflit", plur: "déclarations de conflit", det: "une déclaration de conflit" },
};

const verbFor = (action: string, entity: string): string => {
  if (action === "INSERT") {
    if (entity === "convocation_views") return "a envoyé";
    if (entity === "document_downloads") return "a téléchargé";
    if (entity === "comments") return "a publié";
    return "a créé";
  }
  if (action === "DELETE") return "a supprimé";
  if (action === "UPDATE") {
    if (entity === "minutes") return "a mis à jour";
    if (entity === "user_roles" || entity === "role_permissions") return "a modifié";
    return "a modifié";
  }
  return action.toLowerCase();
};

const pickTitle = (details: any): string | null => {
  if (!details) return null;
  const obj = details.new ?? details;
  if (!obj || typeof obj !== "object") return null;
  for (const k of ["title", "name", "full_name", "nom", "texte", "subject"]) {
    if (obj[k] && typeof obj[k] === "string") return String(obj[k]).slice(0, 80);
  }
  return null;
};

const buildSentence = (log: any, userName: string): string => {
  const { action, entity_type, details } = log;
  const noun = entityNouns[entity_type] ?? { sing: "un élément", plur: "éléments", det: "un élément" };
  const verb = verbFor(action, entity_type);
  const title = pickTitle(details);

  // Cas spéciaux humanisés
  if (entity_type === "minutes" && action === "UPDATE" && details?.new?.pv_status) {
    const status = String(details.new.pv_status);
    const labels: Record<string, string> = {
      brouillon: "remis en brouillon",
      en_attente_validation: "transmis pour validation",
      valide: "validé",
      signe: "signé",
    };
    if (details.old?.pv_status !== details.new.pv_status) {
      return `${userName} a ${labels[status] ?? "mis à jour"} ${noun.sing}${title ? " « " + title + " »" : ""}.`;
    }
    if (details.new.is_published === true && details.old?.is_published === false) {
      return `${userName} a publié ${noun.sing}${title ? " « " + title + " »" : ""}.`;
    }
  }
  if (entity_type === "user_roles") {
    const role = details?.new?.role ?? details?.role ?? "";
    return `${userName} ${verb} l'attribution du rôle « ${role} ».`;
  }
  if (entity_type === "convocation_views" && action === "INSERT") {
    return `${userName} a envoyé une convocation${title ? " (« " + title + " »)" : ""}.`;
  }
  if (entity_type === "document_downloads") {
    return `${userName} a téléchargé un document.`;
  }

  return `${userName} ${verb} ${noun.det}${title ? " « " + title + " »" : ""}.`;
};

// Regroupement intelligent : événements identiques rapprochés dans le temps
const groupSimilar = (rows: any[]): any[] => {
  const out: any[] = [];
  for (const r of rows) {
    const last = out[out.length - 1];
    const sameKind =
      last &&
      last.user_id === r.user_id &&
      last.action === r.action &&
      last.entity_type === r.entity_type &&
      Math.abs(new Date(last.created_at).getTime() - new Date(r.created_at).getTime()) < 5 * 60_000;
    if (sameKind) {
      last._count = (last._count ?? 1) + 1;
      last._oldest = r.created_at;
      continue;
    }
    out.push({ ...r, _count: 1, _oldest: r.created_at });
  }
  return out;
};

const formatDay = (iso: string) => {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  const dd = new Date(d); dd.setHours(0, 0, 0, 0);
  if (dd.getTime() === today.getTime()) return "Aujourd'hui";
  if (dd.getTime() === yest.getTime()) return "Hier";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

export default function AuditLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [detailLog, setDetailLog] = useState<any | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      const [logsRes, profilesRes] = await Promise.all([
        supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(2000),
        supabase.from("profiles").select("id, full_name"),
      ]);
      const map: Record<string, string> = {};
      (profilesRes.data ?? []).forEach((p) => { map[p.id] = p.full_name ?? "Utilisateur inconnu"; });
      setProfiles(map);
      setLogs(logsRes.data ?? []);
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

  if (loading) return <PageSkeleton />;

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
