import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsDirectionMember } from "@/hooks/useIsDirectionMember";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, AlertTriangle, CheckCircle2, Clock, XCircle, Download, FileSpreadsheet, Eye, Pencil, ListChecks, ExternalLink, Search } from "lucide-react";
import { showSuccess, showError } from "@/lib/toastHelpers";
import { exportTableToPDF, exportTableToCSV } from "@/lib/exportUtils";
import { usePermissions } from "@/hooks/usePermissions";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link } from "react-router-dom";

type Status = "a_faire" | "en_cours" | "terminee" | "en_retard" | "annulee";

const statusConfig: Record<Status, { label: string; color: string; icon: any }> = {
  a_faire: { label: "À faire", color: "bg-slate-100 text-slate-700 border-slate-200", icon: ListChecks },
  en_cours: { label: "En cours", color: "bg-blue-100 text-blue-800 border-blue-200", icon: Clock },
  terminee: { label: "Fait", color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: CheckCircle2 },
  en_retard: { label: "En retard", color: "bg-red-100 text-red-800 border-red-200", icon: AlertTriangle },
  annulee: { label: "Annulée", color: "bg-muted text-muted-foreground border-border", icon: XCircle },
};

const defaultForm = {
  decision_id: "",
  title: "",
  description: "",
  responsible_member_id: "",
  due_date: "",
  status: "a_faire" as Status,
  observations: "",
};

const formatDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const sessionTypeLabel = (t?: string | null) =>
  t === "extraordinaire" ? "EXTRAORDINAIRE" : t === "ordinaire" ? "ORDINAIRE" : "—";

const sessionTypeBadge = (t?: string | null) => {
  if (t === "extraordinaire") return "bg-orange-100 text-orange-800 border-orange-200";
  if (t === "ordinaire") return "bg-indigo-100 text-indigo-800 border-indigo-200";
  return "bg-muted text-muted-foreground";
};

export default function Actions() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("suivre_actions");
  const isDirectionMember = useIsDirectionMember();

  const [actions, setActions] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState({ ...defaultForm });
  const [editForm, setEditForm] = useState({ ...defaultForm, id: "" });
  const [filterStatus, setFilterStatus] = useState<Status | "all">("all");
  const [filterResp, setFilterResp] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");

  const fetchAll = async () => {
    const [actRes, decRes, memRes] = await Promise.all([
      supabase
        .from("actions")
        .select("*, decisions(id, numero_decision, texte, session_id, sessions(id, title, session_date, session_type, organs(type, name))), members(full_name)")
        .order("created_at", { ascending: false }),
      supabase
        .from("decisions")
        .select("id, numero_decision, texte, session_id, sessions(title, session_date, session_type, organs(type, name))")
        .order("created_at", { ascending: false }),
      supabase.from("members").select("id, full_name").eq("is_active", true).order("full_name"),
    ]);

    let acts = actRes.data ?? [];
    let decs = decRes.data ?? [];
    if (isDirectionMember) {
      acts = acts.filter((a: any) => a.decisions?.sessions?.organs?.type === "comite_audit");
      decs = decs.filter((d: any) => d.sessions?.organs?.type === "comite_audit");
    }

    // Auto-detect "en_retard" : due_date dépassée et non terminée/annulée
    const today = new Date().toISOString().split("T")[0];
    const enriched = acts.map((a: any) => {
      if (a.due_date && a.due_date < today && !["terminee", "annulee", "en_retard"].includes(a.status)) {
        return { ...a, _autoLate: true };
      }
      return a;
    });

    setActions(enriched);
    setDecisions(decs);
    setMembers(memRes.data ?? []);
  };

  useEffect(() => {
    fetchAll();
  }, [isDirectionMember]);

  const handleCreate = async () => {
    const { error } = await supabase.from("actions").insert([{
      title: form.title,
      description: form.description || null,
      decision_id: form.decision_id || null,
      responsible_member_id: form.responsible_member_id || null,
      due_date: form.due_date || null,
      status: form.status,
      observations: form.observations || null,
    }]);
    if (error) showError(error, "Impossible de créer le suivi");
    else { showSuccess("Résolution ajoutée au suivi"); setOpen(false); setForm({ ...defaultForm }); fetchAll(); }
  };

  const handleEdit = async () => {
    const { error } = await supabase.from("actions").update({
      title: editForm.title,
      description: editForm.description || null,
      decision_id: editForm.decision_id || null,
      responsible_member_id: editForm.responsible_member_id || null,
      due_date: editForm.due_date || null,
      status: editForm.status,
      observations: editForm.observations || null,
      completion_date: editForm.status === "terminee" ? new Date().toISOString().split("T")[0] : null,
    }).eq("id", editForm.id);
    if (error) showError(error, "Impossible de modifier");
    else { showSuccess("Suivi mis à jour"); setEditOpen(false); fetchAll(); }
  };

  const updateStatus = async (id: string, status: Status) => {
    await supabase.from("actions").update({
      status,
      completion_date: status === "terminee" ? new Date().toISOString().split("T")[0] : null,
    }).eq("id", id);
    fetchAll();
  };

  const openEdit = (a: any) => {
    setEditForm({
      id: a.id,
      title: a.title ?? "",
      description: a.description ?? "",
      decision_id: a.decision_id ?? "",
      responsible_member_id: a.responsible_member_id ?? "",
      due_date: a.due_date ?? "",
      status: (a.status as Status) ?? "a_faire",
      observations: a.observations ?? "",
    });
    setEditOpen(true);
  };

  // Lorsqu'une résolution est sélectionnée, pré-remplir le titre avec son texte
  const onPickDecision = (id: string, target: "create" | "edit") => {
    const d = decisions.find((x) => x.id === id);
    if (target === "create") {
      setForm((f) => ({ ...f, decision_id: id, title: f.title || (d?.texte ?? "") }));
    } else {
      setEditForm((f) => ({ ...f, decision_id: id, title: f.title || (d?.texte ?? "") }));
    }
  };

  // Données effectives pour les colonnes Date / O-E / Objet
  const enrich = (a: any) => {
    const session = a.decisions?.sessions;
    return {
      date: session?.session_date ?? a.created_at,
      typeSession: session?.session_type ?? null,
      objet: a.title || a.decisions?.texte || "—",
      organName: session?.organs?.name ?? null,
      sessionId: session?.id ?? null,
    };
  };

  const filtered = useMemo(() => {
    return actions.filter((a) => {
      const effectiveStatus: Status = a._autoLate ? "en_retard" : a.status;
      if (filterStatus !== "all" && effectiveStatus !== filterStatus) return false;
      if (filterResp !== "all" && a.responsible_member_id !== filterResp) return false;
      const e = enrich(a);
      if (filterType !== "all" && e.typeSession !== filterType) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          e.objet.toLowerCase().includes(s) ||
          (a.members?.full_name ?? "").toLowerCase().includes(s) ||
          (a.observations ?? "").toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [actions, filterStatus, filterResp, filterType, search]);

  const counts: Record<Status, number> = {
    a_faire: 0, en_cours: 0, terminee: 0, en_retard: 0, annulee: 0,
  };
  actions.forEach((a) => {
    const s: Status = a._autoLate ? "en_retard" : a.status;
    counts[s] = (counts[s] ?? 0) + 1;
  });

  const exportHeaders = ["Date", "O/E", "Objet de la Résolution", "Responsable", "État d'avancement", "Délai de mise en œuvre"];
  const exportRows = (list: any[]) => list.map((a) => {
    const e = enrich(a);
    const s: Status = a._autoLate ? "en_retard" : a.status;
    return [
      formatDate(e.date),
      sessionTypeLabel(e.typeSession),
      e.objet,
      a.members?.full_name ?? "—",
      statusConfig[s]?.label ?? s,
      formatDate(a.due_date),
    ];
  });

  const renderForm = (
    f: typeof defaultForm,
    setF: (v: any) => void,
    target: "create" | "edit",
  ) => (
    <ScrollArea className="max-h-[65vh] pr-3">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Résolution source (optionnel)</Label>
          <Select value={f.decision_id || "none"} onValueChange={(v) => onPickDecision(v === "none" ? "" : v, target)}>
            <SelectTrigger><SelectValue placeholder="Sélectionner une résolution adoptée" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Aucune (saisie libre)</SelectItem>
              {decisions.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.numero_decision ? `${d.numero_decision} — ` : ""}
                  {(d.texte ?? "").substring(0, 60)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">La date et le type (O/E) sont récupérés automatiquement depuis la session liée.</p>
        </div>

        <div className="space-y-2">
          <Label>Objet de la résolution <span className="text-destructive">*</span></Label>
          <Textarea
            value={f.title}
            onChange={(e) => setF({ ...f, title: e.target.value })}
            rows={3}
            placeholder="Texte ou résumé de la résolution à suivre"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Responsable</Label>
            <Select value={f.responsible_member_id || "none"} onValueChange={(v) => setF({ ...f, responsible_member_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>État d'avancement</Label>
            <Select value={f.status} onValueChange={(v: Status) => setF({ ...f, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(statusConfig) as Status[]).map((k) => (
                  <SelectItem key={k} value={k}>{statusConfig[k].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Délai de mise en œuvre</Label>
          <Input type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} />
        </div>

        <div className="space-y-2">
          <Label>Observations</Label>
          <Textarea value={f.observations} onChange={(e) => setF({ ...f, observations: e.target.value })} rows={2} />
        </div>
      </div>
    </ScrollArea>
  );

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Suivi des résolutions du Conseil</h1>
          <p className="text-sm text-muted-foreground">Tableau de suivi de la mise en œuvre des résolutions adoptées</p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline"><Download className="w-4 h-4 mr-2" />Exporter</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => exportTableToPDF("Tableau de suivi des résolutions du Conseil", exportHeaders, exportRows(filtered), "suivi-resolutions.pdf")}>
                <Download className="w-4 h-4 mr-2" />Export PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportTableToCSV(exportHeaders, exportRows(filtered), "suivi-resolutions.csv")}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />Export Excel (CSV)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canManage && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Nouveau suivi</Button></DialogTrigger>
              <DialogContent className="max-w-xl max-h-[90vh]">
                <DialogHeader><DialogTitle>Ajouter une résolution au suivi</DialogTitle></DialogHeader>
                {renderForm(form, setForm, "create")}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
                  <Button onClick={handleCreate} disabled={!form.title}>Ajouter</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {(Object.keys(statusConfig) as Status[]).map((key) => {
          const cfg = statusConfig[key];
          const isActive = filterStatus === key;
          return (
            <Card
              key={key}
              className={cn("cursor-pointer transition-all hover:shadow-md", isActive && "ring-2 ring-primary")}
              onClick={() => setFilterStatus(isActive ? "all" : key)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <cfg.icon className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold leading-none">{counts[key]}</p>
                  <p className="text-xs text-muted-foreground mt-1">{cfg.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filtres */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher (objet, responsable, observations)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger><SelectValue placeholder="Type session" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous types</SelectItem>
            <SelectItem value="ordinaire">Ordinaire</SelectItem>
            <SelectItem value="extraordinaire">Extraordinaire</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterResp} onValueChange={setFilterResp}>
          <SelectTrigger><SelectValue placeholder="Responsable" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous responsables</SelectItem>
            {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Tableau */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[1000px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">Date</TableHead>
                <TableHead className="w-[130px]">O/E</TableHead>
                <TableHead>Objet de la Résolution</TableHead>
                <TableHead className="w-[160px]">Responsable</TableHead>
                <TableHead className="w-[140px]">État d'avancement</TableHead>
                <TableHead className="w-[140px]">Délai mise en œuvre</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    Aucune résolution à suivre. Ajoutez-en une via « Nouveau suivi ».
                  </TableCell>
                </TableRow>
              ) : filtered.map((a) => {
                const e = enrich(a);
                const effectiveStatus: Status = a._autoLate ? "en_retard" : a.status;
                const cfg = statusConfig[effectiveStatus] ?? statusConfig.a_faire;
                const today = new Date().toISOString().split("T")[0];
                const soon = a.due_date && a.due_date >= today && a.due_date <= new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
                return (
                  <TableRow key={a.id} className={cn(a._autoLate && "bg-red-50/40 dark:bg-red-950/10")}>
                    <TableCell className="text-sm">{formatDate(e.date)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[10px] font-bold", sessionTypeBadge(e.typeSession))}>
                        {sessionTypeLabel(e.typeSession)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm max-w-[420px]">
                      <p className="line-clamp-2">{e.objet}</p>
                      {a.decisions?.numero_decision && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">{a.decisions.numero_decision}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{a.members?.full_name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("gap-1", cfg.color)}>
                        <cfg.icon className="w-3 h-3" />
                        {cfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className={cn(a._autoLate && "text-destructive font-medium", soon && !a._autoLate && "text-amber-600 font-medium")}>
                        {formatDate(a.due_date)}
                      </span>
                      {a._autoLate && <p className="text-[10px] text-destructive">En retard</p>}
                      {soon && !a._autoLate && <p className="text-[10px] text-amber-600">Échéance proche</p>}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelected(a); setViewOpen(true); }} title="Voir détails">
                          <Eye className="w-4 h-4" />
                        </Button>
                        {canManage && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(a)} title="Modifier">
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Détails */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-lg max-h-[90vh]">
          <DialogHeader><DialogTitle>Détails du suivi</DialogTitle></DialogHeader>
          {selected && (() => {
            const e = enrich(selected);
            const effectiveStatus: Status = selected._autoLate ? "en_retard" : selected.status;
            const cfg = statusConfig[effectiveStatus];
            return (
              <ScrollArea className="max-h-[65vh]">
                <div className="space-y-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("text-[10px] font-bold", sessionTypeBadge(e.typeSession))}>
                      {sessionTypeLabel(e.typeSession)}
                    </Badge>
                    <Badge variant="outline" className={cn("gap-1", cfg.color)}>
                      <cfg.icon className="w-3 h-3" />
                      {cfg.label}
                    </Badge>
                  </div>

                  {[
                    ["Date de la session", formatDate(e.date)],
                    ["Organe", e.organName],
                    ["N° résolution", selected.decisions?.numero_decision],
                    ["Objet", e.objet],
                    ["Responsable", selected.members?.full_name],
                    ["Délai de mise en œuvre", formatDate(selected.due_date)],
                    ["Date de réalisation", formatDate(selected.completion_date)],
                    ["Description", selected.description],
                    ["Observations", selected.observations],
                  ].map(([label, value]) => value ? (
                    <div key={label as string} className="grid grid-cols-3 gap-2">
                      <span className="font-medium text-muted-foreground">{label}</span>
                      <span className="col-span-2">{value as string}</span>
                    </div>
                  ) : null)}

                  {e.sessionId && (
                    <Link to="/sessions" className="inline-flex items-center gap-1 text-primary text-xs hover:underline">
                      <ExternalLink className="w-3 h-3" />
                      Voir la session source
                    </Link>
                  )}

                  {canManage && effectiveStatus !== "terminee" && effectiveStatus !== "annulee" && (
                    <div className="pt-3 flex flex-wrap gap-2 border-t">
                      <Button size="sm" onClick={() => { updateStatus(selected.id, "en_cours"); setViewOpen(false); }}>
                        <Clock className="w-4 h-4 mr-1" />En cours
                      </Button>
                      <Button size="sm" onClick={() => { updateStatus(selected.id, "terminee"); setViewOpen(false); }}>
                        <CheckCircle2 className="w-4 h-4 mr-1" />Marquer fait
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { updateStatus(selected.id, "annulee"); setViewOpen(false); }}>
                        <XCircle className="w-4 h-4 mr-1" />Annuler
                      </Button>
                    </div>
                  )}
                </div>
              </ScrollArea>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Édition */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-xl max-h-[90vh]">
          <DialogHeader><DialogTitle>Modifier le suivi</DialogTitle></DialogHeader>
          {renderForm(editForm, setEditForm, "edit")}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button onClick={handleEdit} disabled={!editForm.title}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
