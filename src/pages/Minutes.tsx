import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import CommentThread from "@/components/CommentThread";
import SignatureDialog from "@/components/signature/SignatureDialog";
import SignatureDisplay from "@/components/signature/SignatureDisplay";
import PermissionGate from "@/components/PermissionGate";
import CollaborativeEditor from "@/components/CollaborativeEditor";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import RichTextEditor from "@/components/RichTextEditor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit3, X, MessageSquare, PenTool, Lock, XCircle } from "lucide-react";
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
  const [commentingId, setCommentingId] = useState<string | null>(null);
  const [signingMinute, setSigningMinute] = useState<any | null>(null);

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
    const minute = minutes.find(m => m.id === id);
    if (minute?.pv_status === "signe") {
      showError(new Error("Document signé"), "Ce document est signé et ne peut plus être modifié");
      setEditingId(null);
      return;
    }
    // Block manual setting to "signe" — only signature flow can do that
    if (status === "signe") {
      showError(new Error("Action non autorisée"), "Le statut 'Signé' ne peut être défini que via la signature électronique");
      setEditingId(null);
      return;
    }
    const { error } = await supabase.from("minutes").update({ pv_status: status }).eq("id", id);
    if (error) showError(error, "Impossible de mettre à jour le statut du PV");
    else { showSuccess("pv_status_updated"); setEditingId(null); fetchAll(); }
  };

  const cancelSignature = async (minuteId: string) => {
    // Delete the signature record
    const { error: sigError } = await supabase
      .from("signatures")
      .delete()
      .eq("entity_type", "minute")
      .eq("entity_id", minuteId);

    if (sigError) {
      showError(sigError, "Impossible de supprimer la signature");
      return;
    }

    // Reset minute status to "valide"
    const { error: updateError } = await supabase
      .from("minutes")
      .update({ pv_status: "valide", signed_at: null } as any)
      .eq("id", minuteId);

    if (updateError) {
      showError(updateError, "Impossible de réinitialiser le statut du PV");
      return;
    }

    showSuccess("pv_status_updated");
    fetchAll();
  };

  const openRealtimeEdit = (m: any) => {
    if (m.pv_status === "signe") {
      showError(new Error("Document signé"), "Ce document est signé et ne peut plus être modifié");
      return;
    }
    setEditingContentId(m.id);
    setEditingContent(m.content || "");
  };

  const isSigned = (m: any) => m.pv_status === "signe";
  const isReadyToSign = (m: any) => m.pv_status === "valide";

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
                    <SelectItem value="brouillon">Brouillon</SelectItem>
                    <SelectItem value="valide">Validé</SelectItem>
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
                  <React.Fragment key={m.id}>
                  <TableRow>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {isSigned(m) && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
                        {(m as any).sessions?.title}
                      </div>
                    </TableCell>
                    <TableCell>
                      {editingId === m.id && !isSigned(m) ? (
                        <Select value={editStatus} onValueChange={(v) => { const s = v as PvStatus; setEditStatus(s); updateStatus(m.id, s); }}>
                          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="brouillon">Brouillon</SelectItem>
                            <SelectItem value="valide">Validé</SelectItem>
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
                        {!isSigned(m) && (
                          <Button variant="ghost" size="sm" onClick={() => { setEditingId(m.id); setEditStatus(m.pv_status ?? "brouillon"); }}>
                            Statut
                          </Button>
                        )}
                        {/* Sign button — only for validated PVs, visible only to president (signer_pv permission) */}
                        {isReadyToSign(m) && (
                          <PermissionGate permission="signer_pv">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-primary hover:text-primary"
                              onClick={() => setSigningMinute(m)}
                            >
                              <PenTool className="w-4 h-4 mr-1" /> Signer
                            </Button>
                          </PermissionGate>
                        )}
                        {/* Cancel signature — only for admins (gerer_utilisateurs permission) */}
                        {isSigned(m) && (
                          <PermissionGate permission="gerer_utilisateurs">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                if (window.confirm("Êtes-vous sûr de vouloir annuler la signature de ce document ? Cette action est irréversible.")) {
                                  cancelSignature(m.id);
                                }
                              }}
                            >
                              <XCircle className="w-4 h-4 mr-1" /> Annuler signature
                            </Button>
                          </PermissionGate>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => setCommentingId(commentingId === m.id ? null : m.id)}>
                          <MessageSquare className="w-4 h-4 mr-1" /> Commentaires
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* Signature display for signed documents */}
                  {isSigned(m) && (
                    <TableRow>
                      <TableCell colSpan={4} className="p-4">
                        <SignatureDisplay entityType="minute" entityId={m.id} />
                      </TableCell>
                    </TableRow>
                  )}

                  {commentingId === m.id && (
                    <TableRow>
                      <TableCell colSpan={4} className="p-4 bg-muted/20">
                        <CommentThread entityType="minute" entityId={m.id} />
                      </TableCell>
                    </TableRow>
                  )}
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Signature dialog */}
      {signingMinute && (
        <SignatureDialog
          open={!!signingMinute}
          onOpenChange={(open) => { if (!open) setSigningMinute(null); }}
          entityType="minute"
          entityId={signingMinute.id}
          entityLabel={signingMinute.sessions?.title || "Procès-verbal"}
          onSigned={() => { setSigningMinute(null); fetchAll(); }}
        />
      )}
    </div>
  );
}
