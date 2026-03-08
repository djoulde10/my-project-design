import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCompanyId } from "@/hooks/useCompanyId";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, CalendarDays, MapPin, Video, FileUp, Trash2, ChevronDown, ChevronUp, Package, Download, Link } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";

const statusColors: Record<string, string> = {
  brouillon: "bg-muted text-muted-foreground",
  validee: "bg-primary/10 text-primary",
  tenue: "bg-amber-100 text-amber-800",
  cloturee: "bg-emerald-100 text-emerald-800",
  archivee: "bg-muted text-muted-foreground",
};
const statusLabels: Record<string, string> = {
  brouillon: "Brouillon", validee: "Validée", tenue: "Tenue", cloturee: "Clôturée", archivee: "Archivée",
};

interface AgendaItemDraft {
  title: string;
  description: string;
  nature: "information" | "decision";
  files: File[];
}

export default function Sessions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const companyId = useCompanyId();
  const [sessions, setSessions] = useState<any[]>([]);
  const [organs, setOrgans] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [sessionDetails, setSessionDetails] = useState<Record<string, { agendaItems: any[]; attendees: any[] }>>({});

  const [form, setForm] = useState({
    organ_id: "", title: "", session_type: "ordinaire" as "ordinaire" | "extraordinaire",
    session_date: "", location: "", is_virtual: false, meeting_link: "",
  });
  const [agendaDrafts, setAgendaDrafts] = useState<AgendaItemDraft[]>([]);

  const fetchSessions = async () => {
    const { data } = await supabase
      .from("sessions")
      .select("*, organs(name, type)")
      .order("session_date", { ascending: false });
    setSessions(data ?? []);
  };

  const fetchOrgans = async () => {
    const { data } = await supabase.from("organs").select("*");
    setOrgans(data ?? []);
  };

  useEffect(() => { fetchSessions(); fetchOrgans(); }, []);

  const addAgendaItem = () => {
    setAgendaDrafts([...agendaDrafts, { title: "", description: "", nature: "information", files: [] }]);
  };

  const updateAgendaDraft = (idx: number, field: string, value: any) => {
    const updated = [...agendaDrafts];
    (updated[idx] as any)[field] = value;
    setAgendaDrafts(updated);
  };

  const addFileToAgenda = (idx: number, files: FileList | null) => {
    if (!files) return;
    const updated = [...agendaDrafts];
    updated[idx].files = [...updated[idx].files, ...Array.from(files)];
    setAgendaDrafts(updated);
  };

  const removeFileFromAgenda = (agendaIdx: number, fileIdx: number) => {
    const updated = [...agendaDrafts];
    updated[agendaIdx].files.splice(fileIdx, 1);
    setAgendaDrafts(updated);
  };

  const removeAgendaDraft = (idx: number) => {
    setAgendaDrafts(agendaDrafts.filter((_, i) => i !== idx));
  };

  const handleCreate = async () => {
    const payload = {
      ...form,
      meeting_link: form.meeting_link || null,
      created_by: user?.id,
    };
    const { data: session, error } = await supabase.from("sessions").insert([payload]).select().single();
    if (error || !session) {
      toast({ title: "Erreur", description: error?.message, variant: "destructive" });
      return;
    }

    for (let i = 0; i < agendaDrafts.length; i++) {
      const draft = agendaDrafts[i];
      if (!draft.title) continue;
      const { data: agendaItem, error: agErr } = await supabase.from("agenda_items").insert([{
        session_id: session.id,
        title: draft.title,
        description: draft.description || null,
        nature: draft.nature,
        order_index: i,
      }]).select().single();
      if (agErr || !agendaItem) continue;

      for (const file of draft.files) {
        const filePath = `${companyId}/${session.id}/${agendaItem.id}/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage.from("session-documents").upload(filePath, file);
        if (!upErr) {
          await supabase.from("documents").insert([{
            session_id: session.id,
            agenda_item_id: agendaItem.id,
            name: file.name,
            file_path: filePath,
            file_size: file.size,
            mime_type: file.type,
            uploaded_by: user?.id,
          }]);
        }
      }
    }

    const { data: organMembers } = await supabase.from("members").select("id").eq("organ_id", form.organ_id).eq("is_active", true);
    if (organMembers && organMembers.length > 0) {
      await supabase.from("session_attendees").insert(
        organMembers.map((m) => ({ session_id: session.id, member_id: m.id }))
      );
    }

    toast({ title: "Session créée avec succès" });
    setOpen(false);
    setForm({ organ_id: "", title: "", session_type: "ordinaire", session_date: "", location: "", is_virtual: false, meeting_link: "" });
    setAgendaDrafts([]);
    fetchSessions();
  };

  const toggleSessionDetails = async (sessionId: string) => {
    if (expandedSession === sessionId) {
      setExpandedSession(null);
      return;
    }
    setExpandedSession(sessionId);
    if (!sessionDetails[sessionId]) {
      const [agRes, attRes] = await Promise.all([
        supabase.from("agenda_items").select("*, documents(*)").eq("session_id", sessionId).order("order_index"),
        supabase.from("session_attendees").select("*, members(full_name, quality)").eq("session_id", sessionId),
      ]);
      setSessionDetails((prev) => ({
        ...prev,
        [sessionId]: { agendaItems: agRes.data ?? [], attendees: attRes.data ?? [] },
      }));
    }
  };

  const updateSessionStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("sessions").update({ status: status as any }).eq("id", id);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else { toast({ title: "Statut mis à jour" }); fetchSessions(); }
  };

  const caSessions = sessions.filter((s) => (s as any).organs?.type === "ca");
  const auditSessions = sessions.filter((s) => (s as any).organs?.type === "comite_audit");

  const selectedOrgan = organs.find((o) => o.id === form.organ_id);
  const isAudit = selectedOrgan?.type === "comite_audit";

  const renderSessionsTable = (list: any[]) => (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>N° Session</TableHead>
              <TableHead>Session</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Lieu</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Workflow</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Aucune session.
                </TableCell>
              </TableRow>
            ) : (
              list.map((s) => (
                <>
                  <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSessionDetails(s.id)}>
                    <TableCell>
                      {expandedSession === s.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{s.numero_session ?? "—"}</TableCell>
                    <TableCell className="font-medium">{s.title}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm">
                        <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                        {new Date(s.session_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm">
                        {s.is_virtual ? <Video className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                        {s.location ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[s.status] ?? ""}>{statusLabels[s.status] ?? s.status}</Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {s.status === "brouillon" && (
                        <Button size="sm" variant="outline" onClick={() => updateSessionStatus(s.id, "validee")}>Valider</Button>
                      )}
                      {s.status === "validee" && (
                        <Button size="sm" variant="outline" onClick={() => updateSessionStatus(s.id, "tenue")}>Marquer tenue</Button>
                      )}
                      {s.status === "tenue" && (
                        <Button size="sm" variant="outline" onClick={() => updateSessionStatus(s.id, "cloturee")}>Clôturer</Button>
                      )}
                      {s.status === "cloturee" && (
                        <Button size="sm" variant="outline" onClick={() => updateSessionStatus(s.id, "archivee")}>Archiver</Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {expandedSession === s.id && sessionDetails[s.id] && (
                    <TableRow key={`${s.id}-details`}>
                      <TableCell colSpan={7} className="bg-muted/30 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="font-semibold text-sm mb-2">Ordre du jour ({sessionDetails[s.id].agendaItems.length})</h4>
                            {sessionDetails[s.id].agendaItems.map((ai, i) => (
                              <div key={ai.id} className="text-sm mb-1 flex items-start gap-2">
                                <Badge variant="outline" className="text-xs shrink-0">{i + 1}</Badge>
                                <span>{ai.title}</span>
                                <Badge variant="secondary" className="text-xs ml-auto">{ai.nature}</Badge>
                              </div>
                            ))}
                          </div>
                          <div>
                            <h4 className="font-semibold text-sm mb-2">Participants ({sessionDetails[s.id].attendees.length})</h4>
                            {sessionDetails[s.id].attendees.map((att) => (
                              <div key={att.id} className="text-sm mb-1 flex items-center gap-2">
                                <span>{(att as any).members?.full_name}</span>
                                <Badge variant={att.is_present ? "default" : "secondary"} className="text-xs">
                                  {att.is_present ? "Présent" : "Absent"}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sessions</h1>
          <p className="text-muted-foreground">Gérez les sessions du CA et du Comité d'Audit</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nouvelle session</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Créer une session</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Organe</Label>
                <Select value={form.organ_id} onValueChange={(v) => setForm({ ...form, organ_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {organs.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Titre</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                {!isAudit && (
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={form.session_type} onValueChange={(v) => setForm({ ...form, session_type: v as "ordinaire" | "extraordinaire" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ordinaire">Ordinaire</SelectItem>
                        <SelectItem value="extraordinaire">Extraordinaire</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Date & Heure</Label>
                  <Input type="datetime-local" value={form.session_date} onChange={(e) => setForm({ ...form, session_date: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Lieu</Label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Salle de réunion / Lien visio" />
              </div>

              {/* Agenda items */}
              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Ordre du jour</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addAgendaItem}>
                    <Plus className="w-3 h-3 mr-1" />Ajouter un point
                  </Button>
                </div>
                {agendaDrafts.map((draft, idx) => (
                  <Card key={idx} className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Point {idx + 1}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeAgendaDraft(idx)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                    <Input placeholder="Titre du point" value={draft.title} onChange={(e) => updateAgendaDraft(idx, "title", e.target.value)} />
                    <Textarea placeholder="Description (optionnel)" className="min-h-[60px]" value={draft.description} onChange={(e) => updateAgendaDraft(idx, "description", e.target.value)} />
                    <div className="flex items-center gap-4">
                      <Select value={draft.nature} onValueChange={(v) => updateAgendaDraft(idx, "nature", v)}>
                        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="information">Information</SelectItem>
                          <SelectItem value="decision">Décision</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1.5">
                          <FileUp className="w-3.5 h-3.5" />
                          Documents
                          <input type="file" multiple className="hidden" onChange={(e) => addFileToAgenda(idx, e.target.files)} />
                        </Label>
                      </div>
                    </div>
                    {draft.files.length > 0 && (
                      <div className="space-y-1">
                        {draft.files.map((f, fi) => (
                          <div key={fi} className="flex items-center justify-between text-xs bg-muted rounded px-2 py-1">
                            <span className="truncate">{f.name}</span>
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeFileFromAgenda(idx, fi)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={handleCreate} disabled={!form.organ_id || !form.title || !form.session_date}>Créer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="ca">
        <TabsList>
          <TabsTrigger value="ca">Conseil d'Administration</TabsTrigger>
          <TabsTrigger value="audit">Comité d'Audit</TabsTrigger>
        </TabsList>
        <TabsContent value="ca" className="mt-4">
          {renderSessionsTable(caSessions)}
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          {renderSessionsTable(auditSessions)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
