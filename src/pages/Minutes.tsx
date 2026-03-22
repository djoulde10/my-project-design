import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import CommentThread from "@/components/CommentThread";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import RichTextEditor from "@/components/RichTextEditor";
import CollaborativeEditor from "@/components/CollaborativeEditor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit3, X } from "lucide-react";
import { showSuccess, showError } from "@/lib/toastHelpers";

const pvStatusLabels: Record<string, string> = {
  brouillon: "Brouillon",
  valide: "Validé",
  signe: "Signé",
};

const pvStatusColors: Record<string, string> = {
  brouillon: "bg-muted text-muted-foreground",
  valide: "bg-primary/10 text-primary",
  signe: "bg-emerald-100 text-emerald-800",
};

type PvStatus = "brouillon" | "valide" | "signe";

export default function Minutes() {
  const [minutes, setMinutes] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [pvOpen, setPvOpen] = useState(false);
  const [pvForm, setPvForm] = useState<{ session_id: string; content: string; pv_status: PvStatus }>({ session_id: "", content: "", pv_status: "brouillon" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<PvStatus>("brouillon");
  const [editingContentId, setEditingContentId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");

  const fetchAll = async () => {
    const [minRes, sessRes] = await Promise.all([
      supabase.from("minutes").select("*, sessions(title)").order("created_at", { ascending: false }),
      supabase.from("sessions").select("id, title").order("session_date", { ascending: false }),
    ]);
    setMinutes(minRes.data ?? []);
    setSessions(sessRes.data ?? []);
  };

  useEffect(() => { fetchAll(); }, []);

  const createPV = async () => {
    const { error } = await supabase.from("minutes").insert([pvForm]);
    if (error) showError(error, "Impossible de créer le procès-verbal");
    else { showSuccess("pv_created"); setPvOpen(false); setPvForm({ session_id: "", content: "", pv_status: "brouillon" }); fetchAll(); }
  };

  const updateStatus = async (id: string, status: PvStatus) => {
    const { error } = await supabase.from("minutes").update({ pv_status: status }).eq("id", id);
    if (error) showError(error, "Impossible de mettre à jour le statut du PV");
    else { showSuccess("pv_status_updated"); setEditingId(null); fetchAll(); }
  };

  const openCollaborativeEdit = (m: any) => {
    setEditingContentId(m.id);
    setEditingContent(m.content || "");
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Procès-verbaux</h1>
          <p className="text-muted-foreground">Gestion des procès-verbaux des sessions</p>
        </div>
        <Dialog open={pvOpen} onOpenChange={setPvOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Nouveau PV</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Rédiger un procès-verbal</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Session</Label>
                <Select value={pvForm.session_id} onValueChange={(v) => setPvForm({ ...pvForm, session_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>{sessions.map((s) => (<SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Contenu du PV</Label>
                <RichTextEditor content={pvForm.content} onChange={(html) => setPvForm({ ...pvForm, content: html })} minHeight="200px" />
              </div>
              <div className="space-y-2">
                <Label>Statut</Label>
                <Select value={pvForm.pv_status} onValueChange={(v) => setPvForm({ ...pvForm, pv_status: v as PvStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(pvStatusLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPvOpen(false)}>Annuler</Button>
              <Button onClick={createPV} disabled={!pvForm.session_id}>Enregistrer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Collaborative editing panel */}
      {editingContentId && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">
                Édition collaborative — {minutes.find(m => m.id === editingContentId)?.sessions?.title || "PV"}
              </h3>
              <Button variant="ghost" size="icon" onClick={() => { setEditingContentId(null); fetchAll(); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <CollaborativeEditor
              documentId={editingContentId}
              documentType="minute"
              tableName="minutes"
              content={editingContent}
              onChange={setEditingContent}
              minHeight="300px"
              placeholder="Rédigez le procès-verbal ici..."
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Session</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {minutes.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Aucun PV</TableCell></TableRow>
              ) : (
                minutes.map((m) => (
                  <TableRow key={m.id} className={editingContentId === m.id ? "bg-primary/5" : ""}>
                    <TableCell className="font-medium">{(m as any).sessions?.title}</TableCell>
                    <TableCell>
                      {editingId === m.id ? (
                        <Select value={editStatus} onValueChange={(v) => { const s = v as PvStatus; setEditStatus(s); updateStatus(m.id, s); }}>
                          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(pvStatusLabels).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={pvStatusColors[m.pv_status] ?? "bg-muted text-muted-foreground"}>
                          {pvStatusLabels[m.pv_status] ?? m.pv_status ?? "Brouillon"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(m.created_at).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openCollaborativeEdit(m)}>
                          <Edit3 className="w-4 h-4 mr-1" /> Éditer
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { setEditingId(m.id); setEditStatus(m.pv_status ?? "brouillon"); }}>
                          Statut
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
