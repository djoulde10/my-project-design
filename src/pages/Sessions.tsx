import { useEffect, useState, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCompanyId } from "@/hooks/useCompanyId";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, CalendarDays, MapPin, Video, FileUp, Trash2, ChevronDown, ChevronUp, Download, Link, Sparkles, Loader2, Pencil, CheckCircle, Eye, Send, FileText, Mail } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { usePresidentOrganRestriction } from "@/hooks/usePresidentOrganRestriction";
import { usePermissions } from "@/hooks/usePermissions";
import { showSuccess, showError, showInfo } from "@/lib/toastHelpers";
import ConvocationTrackingDialog from "@/components/ConvocationTrackingDialog";

const RichTextEditor = lazy(() => import("@/components/RichTextEditor"));


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
  const companyId = useCompanyId();
  const { isReadOnlyForOrgan, roleName } = usePresidentOrganRestriction();
  const { hasPermission } = usePermissions();
  const isReadOnly = isReadOnlyForOrgan("ca");
  const isPresident = roleName === "PCA";
  const isSecretariat = roleName === "Secrétariat juridique";
  const canCreateSession = hasPermission("creer_session") || hasPermission("modifier_session");
  const canModifySession = hasPermission("modifier_session");

  const [sessions, setSessions] = useState<any[]>([]);
  const [organs, setOrgans] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [sessionDetails, setSessionDetails] = useState<Record<string, { agendaItems: any[]; attendees: any[]; minute?: any }>>({});
  

  const [editingSession, setEditingSession] = useState<any | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const [editAgendaItems, setEditAgendaItems] = useState<any[]>([]);
  const [editAgendaDrafts, setEditAgendaDrafts] = useState<AgendaItemDraft[]>([]);
  const [deletedAgendaIds, setDeletedAgendaIds] = useState<string[]>([]);
  const [editSaving, setEditSaving] = useState(false);

  // Validation dialog state
  const [validationSession, setValidationSession] = useState<any | null>(null);
  const [validationConvocation, setValidationConvocation] = useState<string>("");
  const [validationOpen, setValidationOpen] = useState(false);
  const [validating, setValidating] = useState(false);

  // View convocation dialog
  const [viewConvocationSession, setViewConvocationSession] = useState<any | null>(null);

  // Convocation tracking dialog
  const [trackingSession, setTrackingSession] = useState<any | null>(null);

  const [form, setForm] = useState({
    organ_id: "", title: "", session_type: "ordinaire" as "ordinaire" | "extraordinaire",
    session_date: "", location: "", is_virtual: false, meeting_link: "",
  });
  const [agendaDrafts, setAgendaDrafts] = useState<AgendaItemDraft[]>([]);
  const [generatingConvocation, setGeneratingConvocation] = useState(false);
  const [convocationText, setConvocationText] = useState<string | null>(null);

  const generateConvocation = async () => {
    if (agendaDrafts.filter(d => d.title).length === 0) {
      showError(null, "Ajoutez au moins un point à l'ordre du jour");
      return;
    }
    setGeneratingConvocation(true);
    setConvocationText(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) { showError(null, "Vous devez être connecté"); return; }

      const selectedOrganName = organs.find(o => o.id === form.organ_id)?.name || "l'organe";
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-convocation`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({
          organ_name: selectedOrganName,
          session_title: form.title,
          session_date: form.session_date,
          location: form.location,
          meeting_link: form.meeting_link,
          agenda_items: agendaDrafts.filter(d => d.title).map((d, i) => ({ order: i + 1, title: d.title, description: d.description })),
        }),
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => null);
        showError(null, errData?.error || "Erreur lors de la génération");
        return;
      }
      const result = await resp.json();
      setConvocationText(result.letter);
    } catch (e) {
      console.error(e);
      showError(e, "Erreur lors de la génération de la convocation");
    } finally {
      setGeneratingConvocation(false);
    }
  };

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
    const payload: any = {
      ...form,
      meeting_link: form.meeting_link || null,
      created_by: user?.id,
    };
    // Save convocation letter if generated
    if (convocationText) {
      payload.convocation_letter = convocationText;
    }
    const { data: session, error } = await supabase.from("sessions").insert([payload]).select().single();
    if (error || !session) {
      showError(error, "Impossible de créer la session");
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

    showSuccess("session_created");
    setOpen(false);
    setForm({ organ_id: "", title: "", session_type: "ordinaire", session_date: "", location: "", is_virtual: false, meeting_link: "" });
    setAgendaDrafts([]);
    setConvocationText(null);
    fetchSessions();
  };

  const toggleSessionDetails = async (sessionId: string) => {
    if (expandedSession === sessionId) {
      setExpandedSession(null);
      return;
    }
    setExpandedSession(sessionId);
    await loadSessionDetails(sessionId);
  };

  const loadSessionDetails = async (sessionId: string) => {
    const [agRes, pvRes] = await Promise.all([
      supabase.from("agenda_items").select("*, documents(*)").eq("session_id", sessionId).order("order_index"),
      supabase.from("minutes").select("id, pv_status, is_published, content, created_at").eq("session_id", sessionId).maybeSingle(),
    ]);
    setSessionDetails((prev) => ({
      ...prev,
      [sessionId]: { agendaItems: agRes.data ?? [], attendees: [], minute: pvRes.data ?? null },
    }));
  };

  const updateSessionStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("sessions").update({ status: status as any }).eq("id", id);
    if (error) showError(error, "Impossible de mettre à jour le statut de la session");
    else { showSuccess("session_status_updated"); fetchSessions(); }
  };

  // Open validation dialog - president reviews convocation before validating
  const openValidationDialog = async (s: any) => {
    // Fetch fresh session data with convocation_letter
    const { data: freshSession } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", s.id)
      .single();
    setValidationSession(freshSession || s);
    setValidationConvocation((freshSession as any)?.convocation_letter || "");
    setValidationOpen(true);
  };

  const handleValidate = async () => {
    if (!validationSession) return;
    setValidating(true);
    try {
      // Save convocation letter changes and validate
      const updateData: any = { status: "validee" as any };
      if (validationConvocation) {
        updateData.convocation_letter = validationConvocation;
      }
      const { error } = await supabase.from("sessions").update(updateData).eq("id", validationSession.id);
      if (error) { showError(error, "Impossible de valider la session"); return; }
      showSuccess("session_status_updated");
      setValidationOpen(false);
      setValidationSession(null);
      fetchSessions();
    } finally {
      setValidating(false);
    }
  };

  const handlePublish = async (id: string) => {
    const { error } = await supabase.from("sessions").update({ is_published: true } as any).eq("id", id);
    if (error) showError(error, "Impossible de publier la session");
    else { showSuccess("session_status_updated"); fetchSessions(); }
  };

  const openEditSession = async (s: any) => {
    setEditingSession(s);
    setForm({
      organ_id: s.organ_id,
      title: s.title,
      session_type: s.session_type,
      session_date: s.session_date ? new Date(s.session_date).toISOString().slice(0, 16) : "",
      location: s.location || "",
      is_virtual: s.is_virtual,
      meeting_link: s.meeting_link || "",
    });
    // Load existing agenda items
    const { data: existingItems } = await supabase
      .from("agenda_items")
      .select("*")
      .eq("session_id", s.id)
      .order("order_index");
    setEditAgendaItems(existingItems ?? []);
    setEditAgendaDrafts([]);
    setDeletedAgendaIds([]);
    // Load convocation letter for editing
    const { data: freshSession } = await supabase.from("sessions").select("convocation_letter").eq("id", s.id).single();
    setConvocationText((freshSession as any)?.convocation_letter || null);
    setEditOpen(true);
  };

  const updateEditAgendaItem = (idx: number, field: string, value: any) => {
    const updated = [...editAgendaItems];
    updated[idx] = { ...updated[idx], [field]: value };
    setEditAgendaItems(updated);
  };

  const removeEditAgendaItem = (idx: number) => {
    const item = editAgendaItems[idx];
    if (item.id) setDeletedAgendaIds((prev) => [...prev, item.id]);
    setEditAgendaItems(editAgendaItems.filter((_, i) => i !== idx));
  };

  const addEditAgendaDraft = () => {
    setEditAgendaDrafts([...editAgendaDrafts, { title: "", description: "", nature: "information", files: [] }]);
  };

  const updateEditAgendaDraft = (idx: number, field: string, value: any) => {
    const updated = [...editAgendaDrafts];
    (updated[idx] as any)[field] = value;
    setEditAgendaDrafts(updated);
  };

  const removeEditAgendaDraft = (idx: number) => {
    setEditAgendaDrafts(editAgendaDrafts.filter((_, i) => i !== idx));
  };

  const handleEditSave = async () => {
    if (!editingSession) return;
    setEditSaving(true);
    try {
      const updateData: any = {
        organ_id: form.organ_id,
        title: form.title,
        session_type: form.session_type as any,
        session_date: form.session_date,
        location: form.location,
        is_virtual: form.is_virtual,
        meeting_link: form.meeting_link || null,
      };
      // Save convocation letter if present
      if (convocationText !== null) {
        updateData.convocation_letter = convocationText;
      }
      const { error } = await supabase.from("sessions").update(updateData).eq("id", editingSession.id);
      if (error) { showError(error, "Impossible de modifier la session"); return; }

      // Delete removed agenda items
      for (const id of deletedAgendaIds) {
        await supabase.from("documents").delete().eq("agenda_item_id", id);
        await supabase.from("agenda_items").delete().eq("id", id);
      }

      // Update existing agenda items
      for (let i = 0; i < editAgendaItems.length; i++) {
        const item = editAgendaItems[i];
        await supabase.from("agenda_items").update({
          title: item.title,
          description: item.description || null,
          nature: item.nature,
          order_index: i,
        }).eq("id", item.id);
      }

      // Insert new agenda items
      for (let i = 0; i < editAgendaDrafts.length; i++) {
        const draft = editAgendaDrafts[i];
        if (!draft.title) continue;
        const { data: agendaItem } = await supabase.from("agenda_items").insert([{
          session_id: editingSession.id,
          title: draft.title,
          description: draft.description || null,
          nature: draft.nature,
          order_index: editAgendaItems.length + i,
        }]).select().single();

        if (agendaItem) {
          for (const file of draft.files) {
            const filePath = `${companyId}/${editingSession.id}/${agendaItem.id}/${Date.now()}_${file.name}`;
            const { error: upErr } = await supabase.storage.from("session-documents").upload(filePath, file);
            if (!upErr) {
              await supabase.from("documents").insert([{
                session_id: editingSession.id,
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
      }

      showSuccess("session_updated");
      setEditOpen(false);
      setEditingSession(null);
      setConvocationText(null);
      setForm({ organ_id: "", title: "", session_type: "ordinaire", session_date: "", location: "", is_virtual: false, meeting_link: "" });
      fetchSessions();
      if (expandedSession === editingSession.id) loadSessionDetails(editingSession.id);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteSession = async () => {
    if (!deleteSessionId) return;
    await supabase.from("session_attendees").delete().eq("session_id", deleteSessionId);
    await supabase.from("documents").delete().eq("session_id", deleteSessionId);
    await supabase.from("agenda_items").delete().eq("session_id", deleteSessionId);
    const { error } = await supabase.from("sessions").delete().eq("id", deleteSessionId);
    if (error) { showError(error, "Impossible de supprimer la session"); }
    else { showSuccess("session_deleted"); fetchSessions(); }
    setDeleteSessionId(null);
  };


  const allCaSessions = sessions.filter((s) => (s as any).organs?.type === "ca");
  // Non-president, non-secretariat users only see published sessions
  const caSessions = (isPresident || isSecretariat)
    ? allCaSessions
    : allCaSessions.filter((s: any) => s.is_published === true);
  const caOrgans = organs.filter((o) => o.type === "ca");

  // Determine who can edit a session based on status
  const canEditSession = (s: any): boolean => {
    if (s.status === "brouillon") {
      // Brouillon: secretariat (modifier_session) or president can edit
      return !isReadOnly && (hasPermission("modifier_session") || isPresident);
    }
    if (s.status === "validee") {
      // After validation: only president can edit
      return isPresident;
    }
    return false;
  };

  const canDeleteSession = (s: any): boolean => {
    return !isReadOnly && s.status === "brouillon" && hasPermission("modifier_session");
  };

  const renderSessionsTable = (list: any[]) => (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <Table className="min-w-[800px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Nature</TableHead>
              <TableHead>Session</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Lieu</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Actions</TableHead>
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
              (() => {
                const now = new Date();
                const sorted = [...list].sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime());
                const upcomingIdx = sorted.findIndex(s => new Date(s.session_date) >= now && s.status !== "tenue" && s.status !== "cloturee" && s.status !== "archivee");
                const pastIdx = sorted.findIndex(s => new Date(s.session_date) < now || s.status === "tenue" || s.status === "cloturee" || s.status === "archivee");
                const hasBoth = upcomingIdx !== -1 && pastIdx !== -1;
                let separatorInserted = false;
                return sorted.map((s, i) => {
                  const isPast = new Date(s.session_date) < now || s.status === "tenue" || s.status === "cloturee" || s.status === "archivee";
                  const showSeparator = hasBoth && !separatorInserted && isPast;
                  if (showSeparator) separatorInserted = true;
                  return (
                    <>
                      {showSeparator && (
                        <TableRow key="separator">
                          <TableCell colSpan={7} className="py-1 px-0">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-px bg-destructive/30" />
                              <span className="text-xs font-medium text-destructive/70 whitespace-nowrap">Sessions passées</span>
                              <div className="flex-1 h-px bg-destructive/30" />
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSessionDetails(s.id)}>
                    <TableCell>
                      {expandedSession === s.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {s.session_type === "extraordinaire" ? "Extraordinaire" : "Ordinaire"}
                      </Badge>
                    </TableCell>
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
                      <div className="flex items-center gap-1">
                        <Badge className={statusColors[s.status] ?? ""}>{statusLabels[s.status] ?? s.status}</Badge>
                        {s.is_published && <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">Publiée</Badge>}
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {isPresident && s.status === "brouillon" && (
                          <Button size="sm" variant="outline" onClick={() => openValidationDialog(s)} className="gap-1">
                            <CheckCircle className="w-3.5 h-3.5" />Valider
                          </Button>
                        )}
                        {isSecretariat && s.status === "validee" && !s.is_published && (
                          <Button size="sm" variant="outline" onClick={() => handlePublish(s.id)} className="gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50">
                            <Send className="w-3.5 h-3.5" />Publier
                          </Button>
                        )}
                        {!isReadOnly && canModifySession && (s.status === "tenue" || s.status === "cloturee") && (
                          <Button size="sm" variant="outline" onClick={() => updateSessionStatus(s.id, "archivee")}>Archiver</Button>
                        )}
                        {(s as any).convocation_letter && (
                          <Button size="sm" variant="ghost" onClick={() => setViewConvocationSession(s)} title="Voir la convocation">
                            <Eye className="w-4 h-4" />
                          </Button>
                        )}
                        {canModifySession && s.is_published && (
                          <Button size="sm" variant="ghost" onClick={() => setTrackingSession(s)} title="Suivi des convocations">
                            <Mail className="w-4 h-4" />
                          </Button>
                        )}
                        {canEditSession(s) && (
                          <Button size="sm" variant="ghost" onClick={() => openEditSession(s)} title="Modifier">
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        {canDeleteSession(s) && (
                          <Button size="sm" variant="ghost" onClick={() => setDeleteSessionId(s.id)} title="Supprimer">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedSession === s.id && sessionDetails[s.id] && (
                    <TableRow key={`${s.id}-details`}>
                      <TableCell colSpan={7} className="bg-muted/30 p-4">
                        {/* Procès-verbal section */}
                        {sessionDetails[s.id].minute && (
                          <div className="mt-3 pt-3 border-t">
                            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              Procès-verbal
                              <Badge className={sessionDetails[s.id].minute.is_published ? "bg-emerald-100 text-emerald-800 text-[10px]" : "bg-muted text-muted-foreground text-[10px]"}>
                                {sessionDetails[s.id].minute.is_published ? "Publié" : sessionDetails[s.id].minute.pv_status === "valide" ? "Validé" : "Brouillon"}
                              </Badge>
                            </h4>
                            {sessionDetails[s.id].minute.is_published && sessionDetails[s.id].minute.content && (
                              <div className="bg-background rounded border p-3 max-h-[300px] overflow-y-auto">
                                <div className="prose prose-sm max-w-none text-sm" dangerouslySetInnerHTML={{ __html: sessionDetails[s.id].minute.content }} />
                              </div>
                            )}
                            {!sessionDetails[s.id].minute.is_published && (
                              <p className="text-sm text-muted-foreground">Le PV n'est pas encore publié.</p>
                            )}
                          </div>
                        )}
                        {!sessionDetails[s.id].minute && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              Aucun procès-verbal associé à cette session.
                            </p>
                          </div>
                        )}
                        {s.meeting_link && (
                          <div className="mt-3 pt-3 border-t">
                            <a href={s.meeting_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
                              <Video className="w-4 h-4" />
                              Rejoindre la réunion en ligne
                            </a>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                    </>
                  );
                });
              })()
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Sessions du Conseil d'Administration</h1>
          <p className="text-sm text-muted-foreground">Gérez les sessions du Conseil d'Administration</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          {!isReadOnly && canCreateSession && <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Nouvelle session</Button>
            </DialogTrigger>}
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Créer une session</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Organe</Label>
                <Select value={form.organ_id} onValueChange={(v) => setForm({ ...form, organ_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {caOrgans.map((o) => (
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
                <div className="space-y-2">
                  <Label>Date & Heure</Label>
                  <Input type="datetime-local" value={form.session_date} onChange={(e) => setForm({ ...form, session_date: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Lieu</Label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Salle de réunion / Lien visio" />
              </div>
              <div className="space-y-2">
                <Label>Lien de réunion en ligne (Teams, Zoom...)</Label>
                <div className="flex items-center gap-2">
                  <Link className="w-4 h-4 text-muted-foreground" />
                  <Input value={form.meeting_link} onChange={(e) => setForm({ ...form, meeting_link: e.target.value })} placeholder="https://teams.microsoft.com/..." />
                </div>
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
                    <Suspense fallback={<div className="h-16 flex items-center justify-center text-muted-foreground text-sm">Chargement…</div>}>
                      <RichTextEditor
                        content={draft.description}
                        onChange={(html) => updateAgendaDraft(idx, "description", html)}
                        minHeight="80px"
                        placeholder="Description (optionnel)"
                      />
                    </Suspense>
                    <div className="flex items-center gap-4">
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

              {/* AI Convocation Letter */}
              {agendaDrafts.filter(d => d.title).length > 0 && (
                <div className="border-t pt-4 space-y-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2"
                    onClick={generateConvocation}
                    disabled={generatingConvocation}
                  >
                    {generatingConvocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {generatingConvocation ? "Génération en cours…" : "Générer la lettre de convocation (IA)"}
                  </Button>
                  {convocationText && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">Lettre de convocation</span>
                        <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(convocationText); showInfo("Copié dans le presse-papiers"); }}>
                          Copier
                        </Button>
                      </div>
                      <Suspense fallback={<div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Chargement de l'éditeur…</div>}>
                        <RichTextEditor
                          content={convocationText}
                          onChange={(html) => setConvocationText(html)}
                          minHeight="300px"
                          placeholder="Lettre de convocation..."
                        />
                      </Suspense>
                    </div>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={handleCreate} disabled={!form.organ_id || !form.title || !form.session_date || !form.location || agendaDrafts.filter(d => d.title).length === 0 || !convocationText}>Créer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {renderSessionsTable(caSessions)}




      {/* Validation Dialog - President reviews convocation before validating */}
      <Dialog open={validationOpen} onOpenChange={(o) => { if (!o) { setValidationOpen(false); setValidationSession(null); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-primary" />
              Valider la session : {validationSession?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="text-sm text-muted-foreground">
                Veuillez relire la lettre de convocation ci-dessous. Vous pouvez la modifier si nécessaire avant de valider la session.
              </p>
            </div>
            {validationConvocation ? (
              <div className="space-y-2">
                <Label className="text-base font-semibold">Lettre de convocation</Label>
                <Suspense fallback={<div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Chargement…</div>}>
                  <RichTextEditor
                    content={validationConvocation}
                    onChange={(html) => setValidationConvocation(html)}
                    minHeight="300px"
                    placeholder="Lettre de convocation..."
                  />
                </Suspense>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Aucune lettre de convocation n'a été générée pour cette session.</p>
                <p className="text-sm mt-1">Vous pouvez tout de même valider la session.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setValidationOpen(false); setValidationSession(null); }}>Annuler</Button>
            <Button onClick={handleValidate} disabled={validating} className="gap-2">
              {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {validating ? "Validation en cours…" : "Valider la session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Convocation Letter Dialog (read-only for non-presidents) */}
      <Dialog open={!!viewConvocationSession} onOpenChange={(o) => { if (!o) setViewConvocationSession(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lettre de convocation — {viewConvocationSession?.title}</DialogTitle>
          </DialogHeader>
          <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: (viewConvocationSession as any)?.convocation_letter || "" }} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewConvocationSession(null)}>Fermer</Button>
            <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText((viewConvocationSession as any)?.convocation_letter || ""); showInfo("Copié"); }}>
              Copier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Session Dialog */}
      <Dialog open={editOpen} onOpenChange={(o) => { if (!o) { setEditOpen(false); setEditingSession(null); setConvocationText(null); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Modifier la session</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Organe</Label>
              <Select value={form.organ_id} onValueChange={(v) => setForm({ ...form, organ_id: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {caOrgans.map((o) => (
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
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.session_type} onValueChange={(v) => setForm({ ...form, session_type: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ordinaire">Ordinaire</SelectItem>
                    <SelectItem value="extraordinaire">Extraordinaire</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date & Heure</Label>
                <Input type="datetime-local" value={form.session_date} onChange={(e) => setForm({ ...form, session_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Lieu</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Salle de réunion / Lien visio" />
            </div>
            <div className="space-y-2">
              <Label>Lien de réunion en ligne (Teams, Zoom...)</Label>
              <div className="flex items-center gap-2">
                <Link className="w-4 h-4 text-muted-foreground" />
                <Input value={form.meeting_link} onChange={(e) => setForm({ ...form, meeting_link: e.target.value })} placeholder="https://teams.microsoft.com/..." />
              </div>
            </div>

            {/* Existing agenda items */}
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Ordre du jour</Label>
                <Button type="button" variant="outline" size="sm" onClick={addEditAgendaDraft}>
                  <Plus className="w-3 h-3 mr-1" />Ajouter un point
                </Button>
              </div>

              {editAgendaItems.map((item, idx) => (
                <Card key={item.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Point {idx + 1}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeEditAgendaItem(idx)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                  <Input placeholder="Titre du point" value={item.title} onChange={(e) => updateEditAgendaItem(idx, "title", e.target.value)} />
                  <Suspense fallback={<div className="h-16 flex items-center justify-center text-muted-foreground text-sm">Chargement…</div>}>
                    <RichTextEditor
                      content={item.description || ""}
                      onChange={(html) => updateEditAgendaItem(idx, "description", html)}
                      minHeight="80px"
                      placeholder="Description (optionnel)"
                    />
                  </Suspense>
                  <Select value={item.nature} onValueChange={(v) => updateEditAgendaItem(idx, "nature", v)}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="information">Information</SelectItem>
                      <SelectItem value="decision">Décision</SelectItem>
                    </SelectContent>
                  </Select>
                </Card>
              ))}

              {/* New agenda drafts */}
              {editAgendaDrafts.map((draft, idx) => (
                <Card key={`new-${idx}`} className="p-4 space-y-3 border-dashed">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-primary">Nouveau point {editAgendaItems.length + idx + 1}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeEditAgendaDraft(idx)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                  <Input placeholder="Titre du point" value={draft.title} onChange={(e) => updateEditAgendaDraft(idx, "title", e.target.value)} />
                  <Suspense fallback={<div className="h-16 flex items-center justify-center text-muted-foreground text-sm">Chargement…</div>}>
                    <RichTextEditor
                      content={draft.description}
                      onChange={(html) => updateEditAgendaDraft(idx, "description", html)}
                      minHeight="80px"
                      placeholder="Description (optionnel)"
                    />
                  </Suspense>
                  <div className="flex items-center gap-4">
                    <Select value={draft.nature} onValueChange={(v) => updateEditAgendaDraft(idx, "nature", v)}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="information">Information</SelectItem>
                        <SelectItem value="decision">Décision</SelectItem>
                      </SelectContent>
                    </Select>
                    <Label className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1.5">
                      <FileUp className="w-3.5 h-3.5" />
                      Documents
                      <input type="file" multiple className="hidden" onChange={(e) => {
                        if (!e.target.files) return;
                        const updated = [...editAgendaDrafts];
                        updated[idx].files = [...updated[idx].files, ...Array.from(e.target.files)];
                        setEditAgendaDrafts(updated);
                      }} />
                    </Label>
                  </div>
                  {draft.files.length > 0 && (
                    <div className="space-y-1">
                      {draft.files.map((f, fi) => (
                        <div key={fi} className="flex items-center justify-between text-xs bg-muted rounded px-2 py-1">
                          <span className="truncate">{f.name}</span>
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => {
                            const updated = [...editAgendaDrafts];
                            updated[idx].files.splice(fi, 1);
                            setEditAgendaDrafts(updated);
                          }}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>

            {/* Convocation letter in edit mode */}
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Lettre de convocation</Label>
                <Button type="button" variant="outline" size="sm" className="gap-2" onClick={async () => {
                  const allItems = [...editAgendaItems, ...editAgendaDrafts.filter(d => d.title)];
                  if (allItems.length === 0) { showError(null, "Ajoutez au moins un point à l'ordre du jour"); return; }
                  setGeneratingConvocation(true);
                  try {
                    const { data: sessionData } = await supabase.auth.getSession();
                    const token = sessionData?.session?.access_token;
                    if (!token) { showError(null, "Vous devez être connecté"); return; }
                    const selectedOrganName = organs.find(o => o.id === form.organ_id)?.name || "l'organe";
                    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-convocation`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
                      body: JSON.stringify({
                        organ_name: selectedOrganName,
                        session_title: form.title,
                        session_date: form.session_date,
                        location: form.location,
                        meeting_link: form.meeting_link,
                        agenda_items: allItems.map((d, i) => ({ order: i + 1, title: d.title, description: d.description })),
                      }),
                    });
                    if (!resp.ok) { const errData = await resp.json().catch(() => null); showError(null, errData?.error || "Erreur"); return; }
                    const result = await resp.json();
                    setConvocationText(result.letter);
                    showSuccess("convocation_regenerated");
                  } catch (e) { showError(e, "Erreur lors de la régénération"); } finally { setGeneratingConvocation(false); }
                }} disabled={generatingConvocation}>
                  {generatingConvocation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {generatingConvocation ? "Génération…" : "Régénérer (IA)"}
                </Button>
              </div>
              {convocationText ? (
                <Suspense fallback={<div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Chargement…</div>}>
                  <RichTextEditor
                    content={convocationText}
                    onChange={(html) => setConvocationText(html)}
                    minHeight="200px"
                    placeholder="Lettre de convocation..."
                  />
                </Suspense>
              ) : (
                <p className="text-sm text-muted-foreground">Aucune lettre de convocation générée.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditOpen(false); setEditingSession(null); setConvocationText(null); }}>Annuler</Button>
            <Button onClick={handleEditSave} disabled={!form.title || !form.session_date || editSaving}>
              {editSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enregistrement…</> : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteSessionId} onOpenChange={(o) => { if (!o) setDeleteSessionId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette session ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Tous les points d'ordre du jour, documents et participants associés seront supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSession} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {trackingSession && (
        <ConvocationTrackingDialog
          open={!!trackingSession}
          onOpenChange={(v) => !v && setTrackingSession(null)}
          sessionId={trackingSession.id}
          sessionTitle={trackingSession.title}
        />
      )}
    </div>
  );
}
