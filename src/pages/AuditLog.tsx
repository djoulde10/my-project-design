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

  // ----- Filtres -----
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"all" | Category>("all");
  const [userFilter, setUserFilter] = useState<"all" | string>("all");
  const [range, setRange] = useState<"all" | "today" | "7d" | "30d">("all");
  const [visible, setVisible] = useState(50);

  // Nettoyage : on masque les entités techniques et on enrichit
  const cleaned = useMemo(() => {
    return logs
      .filter((l) => l.entity_type && !HIDDEN_ENTITIES.has(l.entity_type))
      .filter((l) => {
        // Filtrer les "UPDATE" sans changement réel
        if (l.action === "UPDATE" && l.details?.old && l.details?.new) {
          const changed = Object.keys(l.details.new).filter(
            (k) => !["updated_at", "created_at"].includes(k) &&
              JSON.stringify(l.details.old[k]) !== JSON.stringify(l.details.new[k])
          );
          if (changed.length === 0) return false;
        }
        return true;
      })
      .map((l) => ({ ...l, _category: entityToCategory(l.entity_type) as Category }));
  }, [logs]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const ranges: Record<string, number> = { today: 86400000, "7d": 7 * 86400000, "30d": 30 * 86400000 };
    return cleaned.filter((l) => {
      if (category !== "all" && l._category !== category) return false;
      if (userFilter !== "all" && l.user_id !== userFilter) return false;
      if (range !== "all" && now - new Date(l.created_at).getTime() > ranges[range]) return false;
      if (search) {
        const q = search.toLowerCase();
        const userName = (profiles[l.user_id] ?? "système").toLowerCase();
        const sentence = buildSentence(l, userName).toLowerCase();
        if (!sentence.includes(q) && !userName.includes(q)) return false;
      }
      return true;
    });
  }, [cleaned, category, userFilter, range, search, profiles]);

  const grouped = useMemo(() => groupSimilar(filtered), [filtered]);

  // Regroupement par jour pour la timeline
  const byDay = useMemo(() => {
    const map = new Map<string, any[]>();
    grouped.slice(0, visible).forEach((l) => {
      const key = formatDay(l.created_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    });
    return Array.from(map.entries());
  }, [grouped, visible]);

  const userOptions = useMemo(() => {
    const ids = Array.from(new Set(cleaned.map((l) => l.user_id).filter(Boolean)));
    return ids.map((id) => ({ id, name: profiles[id] ?? "Utilisateur" }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [cleaned, profiles]);

  if (loading) return <PageSkeleton />;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70 mb-1">Traçabilité</p>
          <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight flex items-center gap-2">
            <History className="w-7 h-7 text-primary" /> Journal d'activité
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} événement{filtered.length > 1 ? "s" : ""} significatif{filtered.length > 1 ? "s" : ""} — historique complet de la gouvernance.
          </p>
        </div>
      </div>

      {/* Filtres */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un utilisateur, une action, un document…"
              className="pl-9"
            />
          </div>
          <Select value={userFilter} onValueChange={(v) => setUserFilter(v as any)}>
            <SelectTrigger className="w-full lg:w-[200px]"><SelectValue placeholder="Utilisateur" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les utilisateurs</SelectItem>
              {userOptions.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={range} onValueChange={(v) => setRange(v as any)}>
            <SelectTrigger className="w-full lg:w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les dates</SelectItem>
              <SelectItem value="today">Aujourd'hui</SelectItem>
              <SelectItem value="7d">7 derniers jours</SelectItem>
              <SelectItem value="30d">30 derniers jours</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Catégories */}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={() => setCategory("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${category === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-border"}`}
          >
            Toutes
          </button>
          {(Object.keys(categoryMeta) as Category[]).filter((c) => c !== "other").map((c) => {
            const meta = categoryMeta[c];
            const Icon = meta.icon;
            const active = category === c;
            return (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors inline-flex items-center gap-1.5 ${active ? "bg-primary text-primary-foreground border-primary" : `${meta.bg} ${meta.color} border-transparent hover:opacity-80`}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Timeline */}
      {grouped.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <History className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Aucune activité ne correspond à vos filtres.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {byDay.map(([day, items]) => (
            <section key={day}>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-sm font-semibold text-foreground capitalize">{day}</h2>
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">{items.length} événement{items.length > 1 ? "s" : ""}</span>
              </div>

              <ol className="relative space-y-2 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-px before:bg-border">
                {items.map((l) => {
                  const meta = categoryMeta[l._category as Category];
                  const Icon = meta.icon;
                  const userName = profiles[l.user_id] ?? "Système";
                  const sentence = buildSentence(l, userName);
                  const count = l._count ?? 1;
                  return (
                    <li
                      key={l.id}
                      onClick={() => setDetailLog(l)}
                      className="relative flex items-start gap-3 p-3 pl-1 rounded-lg hover:bg-muted/40 cursor-pointer group transition-colors"
                    >
                      <div className={`relative z-10 w-10 h-10 rounded-full ${meta.bg} ${meta.color} flex items-center justify-center ring-4 ring-background flex-shrink-0`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0 pt-1">
                        <p className="text-sm text-foreground leading-snug">
                          {count > 1 && (
                            <Badge variant="secondary" className="mr-2 text-[10px] px-1.5 py-0">×{count}</Badge>
                          )}
                          {sentence}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{formatTime(l.created_at)}</span>
                          <span>•</span>
                          <span className={`inline-flex items-center gap-1 ${meta.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${meta.bg.replace("/10", "")}`} />
                            {meta.label}
                          </span>
                        </div>
                      </div>
                      <Eye className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-2" />
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}

          {grouped.length > visible && (
            <div className="flex justify-center pt-4">
              <Button variant="outline" onClick={() => setVisible((v) => v + 50)}>
                Charger plus d'activité
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Détails */}
      {detailLog && (
        <Dialog open={!!detailLog} onOpenChange={(v) => !v && setDetailLog(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Détail de l'événement
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm">{buildSentence(detailLog, profiles[detailLog.user_id] ?? "Système")}</p>
              <div className="grid grid-cols-2 gap-3 text-sm border-t pt-3">
                <div><span className="text-muted-foreground">Date :</span> {new Date(detailLog.created_at).toLocaleString("fr-FR")}</div>
                <div><span className="text-muted-foreground">Catégorie :</span> {categoryMeta[detailLog._category as Category]?.label ?? "—"}</div>
                <div><span className="text-muted-foreground">Utilisateur :</span> {profiles[detailLog.user_id] ?? "Système"}</div>
                <div><span className="text-muted-foreground">Référence :</span> <code className="text-xs bg-muted px-1 rounded">{detailLog.entity_id?.slice(0, 8) ?? "—"}</code></div>
              </div>
              {detailLog.action === "UPDATE" && detailLog.details?.old && detailLog.details?.new && (
                <div className="space-y-2 border-t pt-3">
                  <h4 className="text-sm font-semibold">Modifications</h4>
                  <ScrollArea className="max-h-72">
                    <div className="space-y-1.5">
                      {Object.keys(detailLog.details.new)
                        .filter((k) => !["id", "created_at", "updated_at", "company_id"].includes(k) &&
                          JSON.stringify(detailLog.details.old[k]) !== JSON.stringify(detailLog.details.new[k]))
                        .map((k) => (
                          <div key={k} className="text-xs grid grid-cols-3 gap-2 p-2 rounded bg-muted/40">
                            <span className="font-medium">{k}</span>
                            <span className="text-destructive/70 truncate line-through">{String(JSON.stringify(detailLog.details.old[k])).slice(0, 60)}</span>
                            <span className="text-emerald-700 dark:text-emerald-400 truncate">{String(JSON.stringify(detailLog.details.new[k])).slice(0, 60)}</span>
                          </div>
                        ))}
                    </div>
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
