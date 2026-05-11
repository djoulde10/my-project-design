import React, { useEffect, useState } from "react";
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
import { Plus, Gavel, Download, FileSpreadsheet, MessageSquare } from "lucide-react";
import CommentThread from "@/components/CommentThread";
import EntityPermissionsDialog from "@/components/EntityPermissionsDialog";
import { showSuccess, showError } from "@/lib/toastHelpers";
import { exportTableToPDF, exportTableToCSV } from "@/lib/exportUtils";
import { usePermissions } from "@/hooks/usePermissions";
import { useRealtimeTables } from "@/hooks/useRealtimeTable";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DataTable, type DataTableColumn, type DataTableFilter } from "@/components/ui/data-table";
import PageSkeleton from "@/components/PageSkeleton";

const statutLabels: Record<string, string> = { adoptee: "Adoptée", rejetee: "Rejetée", ajournee: "Ajournée" };
const statutColors: Record<string, string> = {
  adoptee: "bg-emerald-100 text-emerald-800",
  rejetee: "bg-red-100 text-red-800",
  ajournee: "bg-amber-100 text-amber-800",
};
const voteLabels: Record<string, string> = { unanimite: "Unanimité", majorite: "Majorité", abstention: "Abstention" };

export default function Decisions() {
  const { hasPermission } = usePermissions();
  const canCreateDecisions = hasPermission("creer_decisions");
  const isDirectionMember = useIsDirectionMember();
  const [decisions, setDecisions] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [filterStatut, setFilterStatut] = useState<string>("all");
  const [commentingId, setCommentingId] = useState<string | null>(null);
  const [permEntityId, setPermEntityId] = useState<string | null>(null);
  const [permEntityName, setPermEntityName] = useState("");
  const [form, setForm] = useState({
    session_id: "", texte: "", type_vote: "unanimite", responsable_execution: "", date_effet: "",
    statut: "adoptee", vote_pour: 0, vote_contre: 0, vote_abstention: 0,
  });

  const fetchAll = async () => {
    setLoading(true);
    const [decRes, sessRes, memRes] = await Promise.all([
      supabase.from("decisions").select("*, sessions(title, numero_session, organs(type)), members(full_name)").order("created_at", { ascending: false }),
      supabase.from("sessions").select("id, title, numero_session, organs(type)").order("session_date", { ascending: false }),
      supabase.from("members").select("id, full_name").eq("is_active", true),
    ]);
    if (isDirectionMember) {
      setDecisions((decRes.data ?? []).filter((d: any) => d.sessions?.organs?.type === "comite_audit"));
      setSessions((sessRes.data ?? []).filter((s: any) => s.organs?.type === "comite_audit"));
    } else {
      setDecisions(decRes.data ?? []);
      setSessions(sessRes.data ?? []);
    }
    setMembers(memRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [isDirectionMember]);
  useRealtimeTables(["decisions", "sessions"], () => fetchAll());

  const handleCreate = async () => {
    const { error } = await supabase.from("decisions").insert([{
      session_id: form.session_id, texte: form.texte, type_vote: form.type_vote,
      responsable_execution: form.responsable_execution || null,
      date_effet: form.date_effet || null, statut: form.statut,
      vote_pour: form.vote_pour, vote_contre: form.vote_contre, vote_abstention: form.vote_abstention,
    }]);
    if (error) showError(error, "Impossible de créer la résolution");
    else {
      showSuccess("decision_created");
      setOpen(false);
      setForm({ session_id: "", texte: "", type_vote: "unanimite", responsable_execution: "", date_effet: "", statut: "adoptee", vote_pour: 0, vote_contre: 0, vote_abstention: 0 });
      fetchAll();
    }
  };

  const columns: DataTableColumn<any>[] = [
    {
      key: "numero", label: "N° Résolution", width: "w-[130px]",
      accessor: (d) => d.numero_decision ?? "",
      render: (d) => <span className="font-mono text-sm font-medium">{d.numero_decision ?? "—"}</span>,
    },
    {
      key: "session", label: "Session",
      accessor: (d) => d.sessions?.numero_session ?? d.sessions?.title ?? "",
      render: (d) => <span className="text-sm">{d.sessions?.numero_session ?? d.sessions?.title ?? "—"}</span>,
    },
    {
      key: "texte", label: "Texte",
      accessor: (d) => d.texte,
      render: (d) => <span className="text-sm line-clamp-2 max-w-md block">{d.texte}</span>,
    },
    {
      key: "vote", label: "Vote", width: "w-[180px]",
      accessor: (d) => voteLabels[d.type_vote] ?? d.type_vote,
      render: (d) => (
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-xs">{voteLabels[d.type_vote] ?? d.type_vote}</Badge>
          <span className="text-xs text-muted-foreground">({d.vote_pour}/{d.vote_contre}/{d.vote_abstention})</span>
        </div>
      ),
    },
    {
      key: "responsable", label: "Responsable", width: "w-[160px]",
      accessor: (d) => d.members?.full_name ?? "",
      render: (d) => <span className="text-sm">{d.members?.full_name ?? "—"}</span>,
    },
    {
      key: "date_effet", label: "Date effet", width: "w-[120px]", hiddenByDefault: true,
      accessor: (d) => d.date_effet ?? "",
      render: (d) => <span className="text-sm text-muted-foreground">{d.date_effet ? new Date(d.date_effet).toLocaleDateString("fr-FR") : "—"}</span>,
    },
    {
      key: "statut", label: "Statut", width: "w-[110px]",
      accessor: (d) => statutLabels[d.statut] ?? d.statut,
      render: (d) => <Badge className={statutColors[d.statut] ?? ""}>{statutLabels[d.statut] ?? d.statut}</Badge>,
    },
    {
      key: "actions", label: "Actions", width: "w-[80px]", alwaysVisible: true,
      render: (d) => (
        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setCommentingId(commentingId === d.id ? null : d.id); }}>
          <MessageSquare className="w-3.5 h-3.5" />
        </Button>
      ),
    },
  ];

  const filters: DataTableFilter[] = [
    {
      key: "statut", label: "Statut",
      options: Object.entries(statutLabels).map(([v, l]) => ({ value: v, label: l, count: decisions.filter((d) => d.statut === v).length })),
      predicate: (d, v) => d.statut === v,
    },
    {
      key: "vote", label: "Type de vote",
      options: Object.entries(voteLabels).map(([v, l]) => ({ value: v, label: l })),
      predicate: (d, v) => d.type_vote === v,
    },
  ];

  if (loading) return <PageSkeleton />;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2"><Gavel className="w-5 h-5 sm:w-6 sm:h-6" />Résolutions</h1>
          <p className="text-sm text-muted-foreground">Gestion des résolutions issues des sessions</p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline"><Download className="w-4 h-4 mr-2" />Exporter</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => {
                const headers = ["N° Résolution", "Session", "Texte", "Vote", "Pour/Contre/Abst.", "Responsable", "Date effet", "Statut"];
                const rows = decisions.map((d: any) => [
                  d.numero_decision ?? "—", d.sessions?.numero_session ?? d.sessions?.title ?? "—", d.texte,
                  voteLabels[d.type_vote] ?? d.type_vote, `${d.vote_pour}/${d.vote_contre}/${d.vote_abstention}`,
                  d.members?.full_name ?? "—", d.date_effet ? new Date(d.date_effet).toLocaleDateString("fr-FR") : "—",
                  statutLabels[d.statut] ?? d.statut,
                ]);
                exportTableToPDF("Résolutions", headers, rows, "resolutions.pdf");
              }}><Download className="w-4 h-4 mr-2" />Export PDF</DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                const headers = ["N° Résolution", "Session", "Texte", "Type vote", "Pour", "Contre", "Abstention", "Responsable", "Date effet", "Statut"];
                const rows = decisions.map((d: any) => [
                  d.numero_decision ?? "", d.sessions?.numero_session ?? d.sessions?.title ?? "", d.texte,
                  voteLabels[d.type_vote] ?? d.type_vote, String(d.vote_pour), String(d.vote_contre), String(d.vote_abstention),
                  d.members?.full_name ?? "", d.date_effet ?? "", statutLabels[d.statut] ?? d.statut,
                ]);
                exportTableToCSV(headers, rows, "resolutions.csv");
              }}><FileSpreadsheet className="w-4 h-4 mr-2" />Export Excel (CSV)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canCreateDecisions && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Nouvelle résolution</Button></DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>Enregistrer une résolution</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Session</Label>
                    <Select value={form.session_id} onValueChange={(v) => setForm({ ...form, session_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>
                        {sessions.map((s) => (<SelectItem key={s.id} value={s.id}>{s.numero_session ? `${s.numero_session} — ${s.title}` : s.title}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Texte de la résolution</Label>
                    <Textarea className="min-h-[100px]" value={form.texte} onChange={(e) => setForm({ ...form, texte: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Type de vote</Label>
                      <Select value={form.type_vote} onValueChange={(v) => setForm({ ...form, type_vote: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(voteLabels).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Statut</Label>
                      <Select value={form.statut} onValueChange={(v) => setForm({ ...form, statut: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(statutLabels).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2"><Label>Votes Pour</Label><Input type="number" min={0} value={form.vote_pour} onChange={(e) => setForm({ ...form, vote_pour: +e.target.value })} /></div>
                    <div className="space-y-2"><Label>Votes Contre</Label><Input type="number" min={0} value={form.vote_contre} onChange={(e) => setForm({ ...form, vote_contre: +e.target.value })} /></div>
                    <div className="space-y-2"><Label>Abstentions</Label><Input type="number" min={0} value={form.vote_abstention} onChange={(e) => setForm({ ...form, vote_abstention: +e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Responsable exécution</Label>
                      <Select value={form.responsable_execution} onValueChange={(v) => setForm({ ...form, responsable_execution: v })}>
                        <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                        <SelectContent>{members.map((m) => (<SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>))}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label>Date d'effet</Label><Input type="date" value={form.date_effet} onChange={(e) => setForm({ ...form, date_effet: e.target.value })} /></div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
                  <Button onClick={handleCreate} disabled={!form.session_id || !form.texte}>Enregistrer</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Stats cliquables (filtrent le statut) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Object.entries(statutLabels).map(([key, label]) => {
          const count = decisions.filter((d) => d.statut === key).length;
          const isActive = filterStatut === key;
          return (
            <Card key={key} className={cn("cursor-pointer transition-all hover:shadow-md", isActive && "ring-2 ring-primary")} onClick={() => setFilterStatut(isActive ? "all" : key)}>
              <CardContent className="p-4 flex items-center gap-3">
                <div>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <DataTable
        storageKey="decisions"
        data={filterStatut === "all" ? decisions : decisions.filter((d) => d.statut === filterStatut)}
        columns={columns}
        rowKey={(d) => d.id}
        filters={filters}
        searchPlaceholder="Rechercher une résolution…"
        emptyMessage="Aucune résolution"
        defaultPageSize={20}
      />

      {commentingId && (
        <Card><CardContent className="p-4"><CommentThread entityType="decision" entityId={commentingId} /></CardContent></Card>
      )}

      {permEntityId && (
        <EntityPermissionsDialog
          open={!!permEntityId}
          onOpenChange={(open) => { if (!open) setPermEntityId(null); }}
          entityType="decision" entityId={permEntityId} entityName={permEntityName}
        />
      )}
    </div>
  );
}
