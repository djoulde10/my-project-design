import { useEffect, useState } from "react";
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
import { Plus, AlertTriangle, CheckCircle2, Clock, XCircle, Download, FileSpreadsheet, Eye, Pencil } from "lucide-react";
import { showSuccess, showError } from "@/lib/toastHelpers";
import { exportTableToPDF, exportTableToCSV } from "@/lib/exportUtils";
import { usePermissions } from "@/hooks/usePermissions";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  en_cours: { label: "En cours", color: "bg-blue-100 text-blue-800", icon: Clock },
  en_retard: { label: "En retard", color: "bg-red-100 text-red-800", icon: AlertTriangle },
  terminee: { label: "Terminée", color: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
  annulee: { label: "Annulée", color: "bg-muted text-muted-foreground", icon: XCircle },
};

const defaultForm = {
  decision_id: "", title: "", description: "", responsible_member_id: "", due_date: "",
  numero_dossier: "", date_introduction: "", action_type: "Demanderesse", partie_adverse: "",
  objet_litige: "", type_contentieux: "", mode_reglement: "judiciaire", juridiction: "",
  avocat_conseil: "", montant_en_jeu: "", devise: "GNF", probabilite_reussite: "",
  derniere_action: "", prochaine_action: "", observations: "", provisions: "NON",
};

export default function Actions() {
  const { hasPermission } = usePermissions();
  const canManageActions = hasPermission("suivre_actions");
  const isDirectionMember = useIsDirectionMember();
  const [actions, setActions] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<any>(null);
  const [form, setForm] = useState({ ...defaultForm });
  const [editForm, setEditForm] = useState({ ...defaultForm, id: "" });
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchText, setSearchText] = useState("");

  const fetchAll = async () => {
    const [actRes, decRes, memRes] = await Promise.all([
      supabase.from("actions").select("*, decisions(numero_decision, texte, sessions(organs(type))), members(full_name)").order("created_at", { ascending: false }),
      supabase.from("decisions").select("id, numero_decision, texte, sessions(organs(type))"),
      supabase.from("members").select("id, full_name").eq("is_active", true),
    ]);
    if (isDirectionMember) {
      setActions((actRes.data ?? []).filter((a: any) => a.decisions?.sessions?.organs?.type === "comite_audit"));
      setDecisions((decRes.data ?? []).filter((d: any) => d.sessions?.organs?.type === "comite_audit"));
    } else {
      setActions(actRes.data ?? []);
      setDecisions(decRes.data ?? []);
    }
    setMembers(memRes.data ?? []);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleCreate = async () => {
    const { error } = await supabase.from("actions").insert([{
      title: form.title,
      description: form.description || null,
      decision_id: form.decision_id || null,
      responsible_member_id: form.responsible_member_id || null,
      due_date: form.due_date || null,
      numero_dossier: form.numero_dossier || null,
      date_introduction: form.date_introduction || null,
      action_type: form.action_type || null,
      partie_adverse: form.partie_adverse || null,
      objet_litige: form.objet_litige || null,
      type_contentieux: form.type_contentieux || null,
      mode_reglement: form.mode_reglement || null,
      juridiction: form.juridiction || null,
      avocat_conseil: form.avocat_conseil || null,
      montant_en_jeu: form.montant_en_jeu ? Number(form.montant_en_jeu) : null,
      devise: form.devise || null,
      probabilite_reussite: form.probabilite_reussite || null,
      derniere_action: form.derniere_action || null,
      prochaine_action: form.prochaine_action || null,
      observations: form.observations || null,
      provisions: form.provisions || "NON",
    }]);
    if (error) showError(error, "Impossible de créer l'action");
    else { showSuccess("action_created"); setOpen(false); setForm({ ...defaultForm }); fetchAll(); }
  };

  const handleEdit = async () => {
    const { error } = await supabase.from("actions").update({
      title: editForm.title,
      description: editForm.description || null,
      decision_id: editForm.decision_id || null,
      responsible_member_id: editForm.responsible_member_id || null,
      due_date: editForm.due_date || null,
      numero_dossier: editForm.numero_dossier || null,
      date_introduction: editForm.date_introduction || null,
      action_type: editForm.action_type || null,
      partie_adverse: editForm.partie_adverse || null,
      objet_litige: editForm.objet_litige || null,
      type_contentieux: editForm.type_contentieux || null,
      mode_reglement: editForm.mode_reglement || null,
      juridiction: editForm.juridiction || null,
      avocat_conseil: editForm.avocat_conseil || null,
      montant_en_jeu: editForm.montant_en_jeu ? Number(editForm.montant_en_jeu) : null,
      devise: editForm.devise || null,
      probabilite_reussite: editForm.probabilite_reussite || null,
      derniere_action: editForm.derniere_action || null,
      prochaine_action: editForm.prochaine_action || null,
      observations: editForm.observations || null,
      provisions: editForm.provisions || "NON",
    }).eq("id", editForm.id);
    if (error) showError(error, "Impossible de modifier l'action");
    else { showSuccess("action_updated"); setEditOpen(false); fetchAll(); }
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("actions").update({
      status: status as "en_cours" | "en_retard" | "terminee" | "annulee",
      completion_date: status === "terminee" ? new Date().toISOString().split("T")[0] : null,
    }).eq("id", id);
    fetchAll();
  };

  const openEdit = (a: any) => {
    setEditForm({
      id: a.id, title: a.title ?? "", description: a.description ?? "",
      decision_id: a.decision_id ?? "", responsible_member_id: a.responsible_member_id ?? "",
      due_date: a.due_date ?? "", numero_dossier: a.numero_dossier ?? "",
      date_introduction: a.date_introduction ?? "", action_type: a.action_type ?? "Demanderesse",
      partie_adverse: a.partie_adverse ?? "", objet_litige: a.objet_litige ?? "",
      type_contentieux: a.type_contentieux ?? "", mode_reglement: a.mode_reglement ?? "judiciaire",
      juridiction: a.juridiction ?? "", avocat_conseil: a.avocat_conseil ?? "",
      montant_en_jeu: a.montant_en_jeu?.toString() ?? "", devise: a.devise ?? "GNF",
      probabilite_reussite: a.probabilite_reussite ?? "", derniere_action: a.derniere_action ?? "",
      prochaine_action: a.prochaine_action ?? "", observations: a.observations ?? "",
      provisions: a.provisions ?? "NON",
    });
    setEditOpen(true);
  };

  const exportHeaders = ["N°", "N° Dossier", "Date introduction", "Action", "Partie adverse", "Objet du litige", "Statut", "Type contentieux", "Mode règlement", "Juridiction", "Avocats", "Montant", "Devise", "Probabilité", "Dernière action", "Prochaine action", "Observations", "Provisions"];

  const exportRows = (list: any[]) => list.map((a, i) => [
    String(i + 1), a.numero_dossier ?? "", a.date_introduction ? new Date(a.date_introduction).toLocaleDateString("fr-FR") : "",
    a.action_type ?? "", a.partie_adverse ?? "", a.objet_litige ?? a.title ?? "",
    statusConfig[a.status]?.label ?? a.status, a.type_contentieux ?? "", a.mode_reglement ?? "",
    a.juridiction ?? "", a.avocat_conseil ?? "", a.montant_en_jeu?.toLocaleString("fr-FR") ?? "",
    a.devise ?? "", a.probabilite_reussite ?? "", a.derniere_action ?? "", a.prochaine_action ?? "",
    a.observations ?? "", a.provisions ?? "",
  ]);

  const filtered = actions.filter((a) => {
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    if (searchText) {
      const s = searchText.toLowerCase();
      return (a.title?.toLowerCase().includes(s) || a.partie_adverse?.toLowerCase().includes(s) || a.numero_dossier?.toLowerCase().includes(s) || a.objet_litige?.toLowerCase().includes(s));
    }
    return true;
  });

  const renderFormFields = (f: typeof defaultForm, setF: (v: any) => void) => (
    <ScrollArea className="max-h-[65vh] pr-3">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>N° de dossier</Label>
            <Input value={f.numero_dossier} onChange={(e) => setF({ ...f, numero_dossier: e.target.value })} placeholder="DAJC/DCR/0104" />
          </div>
          <div className="space-y-2">
            <Label>Date d'introduction</Label>
            <Input type="date" value={f.date_introduction} onChange={(e) => setF({ ...f, date_introduction: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Action</Label>
            <Select value={f.action_type} onValueChange={(v) => setF({ ...f, action_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Demanderesse">Demanderesse</SelectItem>
                <SelectItem value="Défenderesse">Défenderesse</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Partie adverse</Label>
            <Input value={f.partie_adverse} onChange={(e) => setF({ ...f, partie_adverse: e.target.value })} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Objet du litige / Titre</Label>
          <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={2} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Type de contentieux</Label>
            <Select value={f.type_contentieux} onValueChange={(v) => setF({ ...f, type_contentieux: v })}>
              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>
                {["correctionnel", "civil", "commercial", "social", "administratif", "pénal", "autre"].map((t) => (
                  <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Mode de règlement</Label>
            <Select value={f.mode_reglement} onValueChange={(v) => setF({ ...f, mode_reglement: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["judiciaire", "arbitrage", "médiation", "amiable", "autre"].map((t) => (
                  <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Juridiction</Label>
            <Input value={f.juridiction} onChange={(e) => setF({ ...f, juridiction: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Avocats / Conseils</Label>
            <Input value={f.avocat_conseil} onChange={(e) => setF({ ...f, avocat_conseil: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Montant en jeu</Label>
            <Input type="number" value={f.montant_en_jeu} onChange={(e) => setF({ ...f, montant_en_jeu: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Devise</Label>
            <Select value={f.devise} onValueChange={(v) => setF({ ...f, devise: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["GNF", "USD", "EUR", "XOF"].map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Probabilité de réussite</Label>
            <Select value={f.probabilite_reussite} onValueChange={(v) => setF({ ...f, probabilite_reussite: v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {["Élevée", "Moyenne", "Faible", "Incertaine"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Résolution source</Label>
            <Select value={f.decision_id} onValueChange={(v) => setF({ ...f, decision_id: v })}>
              <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
              <SelectContent>
                {decisions.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.numero_decision ? `${d.numero_decision} — ` : ""}{d.texte?.substring(0, 40)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Responsable</Label>
            <Select value={f.responsible_member_id} onValueChange={(v) => setF({ ...f, responsible_member_id: v })}>
              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>{members.map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Échéance</Label>
            <Input type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Provisions</Label>
            <Select value={f.provisions} onValueChange={(v) => setF({ ...f, provisions: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="OUI">OUI</SelectItem>
                <SelectItem value="NON">NON</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Dernière action</Label>
          <Input value={f.derniere_action} onChange={(e) => setF({ ...f, derniere_action: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Prochaine action</Label>
          <Input value={f.prochaine_action} onChange={(e) => setF({ ...f, prochaine_action: e.target.value })} />
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
          <h1 className="text-xl sm:text-2xl font-bold">Suivi des actions</h1>
          <p className="text-sm text-muted-foreground">Tableau de suivi des contentieux et actions</p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline"><Download className="w-4 h-4 mr-2" />Exporter</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => exportTableToPDF("Suivi des actions", exportHeaders, exportRows(actions), "actions.pdf")}>
                <Download className="w-4 h-4 mr-2" />Export PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportTableToCSV(exportHeaders, exportRows(actions), "actions.csv")}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />Export Excel (CSV)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canManageActions && <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Nouvelle action</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh]">
              <DialogHeader><DialogTitle>Créer une action</DialogTitle></DialogHeader>
              {renderFormFields(form, setForm)}
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
                <Button onClick={handleCreate} disabled={!form.title}>Créer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Object.entries(statusConfig).map(([key, cfg]) => {
          const count = actions.filter((a) => a.status === key).length;
          const isActive = filterStatus === key;
          return (
            <Card key={key} className={cn("cursor-pointer transition-all hover:shadow-md", isActive && "ring-2 ring-primary")} onClick={() => setFilterStatus(isActive ? "all" : key)}>
              <CardContent className="p-4 flex items-center gap-3">
                <cfg.icon className="w-5 h-5" />
                <div>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground">{cfg.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="relative max-w-md">
        <Input placeholder="Rechercher (titre, dossier, partie adverse...)" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[1400px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">N°</TableHead>
                <TableHead>N° Dossier</TableHead>
                <TableHead>Date intro.</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Partie adverse</TableHead>
                <TableHead>Objet du litige</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Règlement</TableHead>
                <TableHead>Juridiction</TableHead>
                <TableHead>Avocats</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Probabilité</TableHead>
                <TableHead>Provisions</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={15} className="text-center text-muted-foreground py-8">Aucune action</TableCell></TableRow>
              ) : filtered.map((a, idx) => {
                const cfg = statusConfig[a.status] ?? statusConfig.en_cours;
                return (
                  <TableRow key={a.id}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-mono text-xs">{a.numero_dossier ?? "—"}</TableCell>
                    <TableCell className="text-sm">{a.date_introduction ? new Date(a.date_introduction).toLocaleDateString("fr-FR") : "—"}</TableCell>
                    <TableCell className="text-sm">{a.action_type ?? "—"}</TableCell>
                    <TableCell className="text-sm max-w-[120px] truncate">{a.partie_adverse ?? "—"}</TableCell>
                    <TableCell className="text-sm max-w-[160px] truncate font-medium">{a.objet_litige || a.title}</TableCell>
                    <TableCell><Badge className={cfg.color}>{cfg.label}</Badge></TableCell>
                    <TableCell className="text-sm">{a.type_contentieux ?? "—"}</TableCell>
                    <TableCell className="text-sm">{a.mode_reglement ?? "—"}</TableCell>
                    <TableCell className="text-sm max-w-[120px] truncate">{a.juridiction ?? "—"}</TableCell>
                    <TableCell className="text-sm max-w-[100px] truncate">{a.avocat_conseil ?? "—"}</TableCell>
                    <TableCell className="text-sm font-mono">{a.montant_en_jeu ? `${Number(a.montant_en_jeu).toLocaleString("fr-FR")} ${a.devise ?? ""}` : "—"}</TableCell>
                    <TableCell className="text-sm">{a.probabilite_reussite ?? "—"}</TableCell>
                    <TableCell className="text-sm">{a.provisions ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedAction(a); setViewOpen(true); }}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {canManageActions && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(a)}>
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

      {/* View Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-lg max-h-[90vh]">
          <DialogHeader><DialogTitle>Détails de l'action</DialogTitle></DialogHeader>
          {selectedAction && (
            <ScrollArea className="max-h-[65vh]">
              <div className="space-y-3 text-sm">
                {[
                  ["N° Dossier", selectedAction.numero_dossier],
                  ["Date introduction", selectedAction.date_introduction ? new Date(selectedAction.date_introduction).toLocaleDateString("fr-FR") : null],
                  ["Action", selectedAction.action_type],
                  ["Partie adverse", selectedAction.partie_adverse],
                  ["Objet / Titre", selectedAction.objet_litige || selectedAction.title],
                  ["Description", selectedAction.description],
                  ["Statut", statusConfig[selectedAction.status]?.label],
                  ["Type contentieux", selectedAction.type_contentieux],
                  ["Mode règlement", selectedAction.mode_reglement],
                  ["Juridiction", selectedAction.juridiction],
                  ["Avocats", selectedAction.avocat_conseil],
                  ["Montant", selectedAction.montant_en_jeu ? `${Number(selectedAction.montant_en_jeu).toLocaleString("fr-FR")} ${selectedAction.devise ?? ""}` : null],
                  ["Probabilité", selectedAction.probabilite_reussite],
                  ["Responsable", (selectedAction as any).members?.full_name],
                  ["Échéance", selectedAction.due_date ? new Date(selectedAction.due_date).toLocaleDateString("fr-FR") : null],
                  ["Dernière action", selectedAction.derniere_action],
                  ["Prochaine action", selectedAction.prochaine_action],
                  ["Observations", selectedAction.observations],
                  ["Provisions", selectedAction.provisions],
                  ["Résolution", (selectedAction as any).decisions?.numero_decision],
                ].map(([label, value]) => value ? (
                  <div key={label as string} className="flex gap-2">
                    <span className="font-medium text-muted-foreground min-w-[130px]">{label} :</span>
                    <span>{value}</span>
                  </div>
                ) : null)}
                {canManageActions && selectedAction.status !== "terminee" && selectedAction.status !== "annulee" && (
                  <div className="pt-3 flex gap-2">
                    <Button size="sm" onClick={() => { updateStatus(selectedAction.id, "terminee"); setViewOpen(false); }}>
                      <CheckCircle2 className="w-4 h-4 mr-1" />Terminer
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { updateStatus(selectedAction.id, "annulee"); setViewOpen(false); }}>
                      <XCircle className="w-4 h-4 mr-1" />Annuler
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader><DialogTitle>Modifier l'action</DialogTitle></DialogHeader>
          {renderFormFields(editForm, setEditForm)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button onClick={handleEdit} disabled={!editForm.title}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
