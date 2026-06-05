import { useEffect, useState, useRef, useCallback } from "react";
import DOMPurify from "dompurify";
import { useCompanyBranding } from "@/hooks/useCompanyBranding";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import RichTextEditor from "@/components/RichTextEditor";
import CommentThread from "@/components/CommentThread";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus, Mic, MicOff, Upload, FileText, Download, Loader2, Volume2, BookOpen, Trash2, Eye, Wand2, Pause, Play, Square,
  ClipboardCheck, History, Edit, Save, FileDown, CheckCircle2, Brain, MessageSquare, Shield, Send
} from "lucide-react";
import MinuteVersionHistory from "@/components/MinuteVersionHistory";
import EntityPermissionsDialog from "@/components/EntityPermissionsDialog";
import MeetingAIAnalysis from "@/components/MeetingAIAnalysis";
import { showSuccess, showError, showInfo } from "@/lib/toastHelpers";
import { useAuth } from "@/lib/auth";

import { usePermissions } from "@/hooks/usePermissions";
import { useIsDirectionMember } from "@/hooks/useIsDirectionMember";
import { useCompanyId } from "@/hooks/useCompanyId";
import { usePresidentOrganRestriction } from "@/hooks/usePresidentOrganRestriction";
import { useRealtimeTables } from "@/hooks/useRealtimeTable";
import { useRecording, formatDuration } from "@/contexts/RecordingContext";

// PV status helpers
const pvStatusLabels: Record<string, string> = {
  brouillon: "Brouillon",
  en_attente_validation: "En attente de validation",
  valide: "Validé",
};
const pvStatusColors: Record<string, string> = {
  brouillon: "bg-muted text-muted-foreground",
  en_attente_validation: "bg-amber-100 text-amber-800",
  valide: "bg-primary/10 text-primary",
};
type PvStatus = "brouillon" | "en_attente_validation" | "valide";

export default function Meetings() {
  
  const { user } = useAuth();
  const companyId = useCompanyId();
  const { hasPermission, roleName } = usePermissions();
  const isDirectionMember = useIsDirectionMember();
  const { isPresident, isReadOnlyForOrgan } = usePresidentOrganRestriction();
  const isSecretariat = roleName === "Secrétariat juridique";
  const isReadOnly = !hasPermission("valider_pv") && !hasPermission("modifier_session") && !hasPermission("creer_session");
  const [templates, setTemplates] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [minutes, setMinutes] = useState<any[]>([]);
  const [members, setMembers] = useState<{ id: string; full_name: string }[]>([]);
  const [activeTab, setActiveTab] = useState("pv");
  const [permEntityId, setPermEntityId] = useState<string | null>(null);
  const [permEntityName, setPermEntityName] = useState("");

  const { branding } = useCompanyBranding();

  // Global recording session (survives navigation)
  const recording = useRecording();
  const isLiveMode = recording.status === "recording";
  const isPaused = recording.status === "paused";
  const liveTranscript = recording.transcript;
  const partialText = recording.partialText;

  // Upload mode
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSessionId, setNewSessionId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [pvMode, setPvMode] = useState<"professionnel" | "simplifie">("professionnel");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadTranscribing, setUploadTranscribing] = useState(false);
  const [transcriptionLang, setTranscriptionLang] = useState("fra");

  // Processing states
  const [generating, setGenerating] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);

  // AI PV preview editor (before saving)
  const [pendingPV, setPendingPV] = useState<{ content: string; sessionId: string; title: string } | null>(null);
  const [pendingPVContent, setPendingPVContent] = useState("");

  // PV creation dialog (manual)
  const [pvOpen, setPvOpen] = useState(false);
  const [pvForm, setPvForm] = useState<{ session_id: string; content: string }>({ session_id: "", content: "" });

  // PV detail/edit view
  const [viewMinute, setViewMinute] = useState<any | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // TTS
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Template upload
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [parsingTemplate, setParsingTemplate] = useState(false);

  // Version history
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [versionHistoryMinuteId, setVersionHistoryMinuteId] = useState<string>("");
  const [versionHistoryContent, setVersionHistoryContent] = useState<string | null>(null);


  const fetchAll = useCallback(async () => {
    const [tplRes, sessRes, minRes, memRes] = await Promise.all([
      supabase.from("meeting_templates").select("*").order("created_at", { ascending: false }),
      supabase.from("sessions").select("id, title, organs(type)").order("session_date", { ascending: false }),
      supabase.from("minutes").select("*, sessions(title, organs(type))").order("created_at", { ascending: false }),
      supabase.from("members").select("id, full_name").eq("is_active", true).order("full_name"),
    ]);
    
    // Filter for "Membre de la Direction": only comite_audit data
    if (isDirectionMember) {
      const auditSessions = (sessRes.data ?? []).filter((s: any) => s.organs?.type === "comite_audit");
      const auditMinutes = (minRes.data ?? []).filter((m: any) => m.sessions?.organs?.type === "comite_audit");
      setTemplates(tplRes.data ?? []);
      setSessions(auditSessions);
      setMinutes(auditMinutes);
    } else {
      setTemplates(tplRes.data ?? []);
      setSessions(sessRes.data ?? []);
      setMinutes(minRes.data ?? []);
    }
    setMembers(memRes.data ?? []);
  }, [isDirectionMember]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Realtime: instantly reflect PV creation, edits, validations and publications
  useRealtimeTables(["minutes", "sessions", "meeting_ai_analysis"], fetchAll);

  // ========== REALTIME RECORDING ==========
  const startLiveTranscription = async () => {
    await recording.start({
      title: newTitle || `Réunion du ${new Date().toLocaleDateString("fr-FR")}`,
      sessionId: newSessionId || undefined,
      templateId: selectedTemplateId || undefined,
      mode: pvMode,
    });
  };

  const stopLiveTranscription = async () => {
    await recording.stop();
  };

  const resetForm = () => {
    setUploadedFile(null);
    setNewTitle("");
    setNewSessionId("");
    setSelectedTemplateId("");
    recording.reset();
  };

  // ========== GENERATE PV → SHOW IN EDITOR ==========
  const generateAndPreview = async (transcription: string, title: string, sessionId: string) => {
    setGenerating(true);
    try {
      let templateContent = "";
      if (selectedTemplateId) {
        const tpl = templates.find((t) => t.id === selectedTemplateId);
        if (tpl?.extracted_content) templateContent = tpl.extracted_content;
      }
      const { data: pvData, error: pvError } = await supabase.functions.invoke("generate-pv", {
        body: {
          transcription,
          meetingTitle: title || `Réunion du ${new Date().toLocaleDateString("fr-FR")}`,
          meetingDate: new Date().toLocaleDateString("fr-FR"),
          templateContent,
          mode: pvMode,
          orgName: branding.platform_name || branding.nom,
          orgLogoUrl: branding.logo_url,
          orgColor: branding.couleur_principale,
        },
      });
      if (pvError) throw new Error(pvError.message);
      const generatedPV = pvData?.pv || "";
      // Show in editor for review
      setPendingPV({ content: generatedPV, sessionId, title });
      setPendingPVContent(generatedPV);
      showSuccess("pv_generated");
    } catch (e: any) {
      showError(e, "Impossible de générer le procès-verbal");
    } finally {
      setGenerating(false);
    }
  };

  // Generate from live transcription
  const generatePVFromLive = async () => {
    let finalTranscript = recording.transcript;
    let finalMeta = recording.meta;
    if (recording.status !== "idle") {
      const result = await recording.stop();
      finalTranscript = result.transcript;
      finalMeta = result.meta || finalMeta;
    }
    if (!finalTranscript) {
      showError("Aucune transcription disponible");
      return;
    }
    await generateAndPreview(
      finalTranscript,
      finalMeta?.title || newTitle,
      finalMeta?.sessionId || newSessionId,
    );
    recording.reset();
    resetForm();
  };

  // Generate from uploaded file
  const createWithUploadedFile = async () => {
    if (!uploadedFile || !newTitle) {
      showError("Le titre et le fichier audio sont requis.");
      return;
    }
    setCreateOpen(false);

    const fileName = `${companyId}/${Date.now()}_${newTitle.replace(/\s+/g, "_")}.${uploadedFile.name.split(".").pop()}`;
    const { error: uploadError } = await supabase.storage.from("meeting-audio").upload(fileName, uploadedFile);
    if (uploadError) {
      showError(uploadError, "Impossible de téléverser le fichier audio");
      return;
    }

    showInfo("Transcription en cours…");
    setUploadTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("audio", uploadedFile, fileName);
      formData.append("language_code", transcriptionLang);
      const { data: { session: _authSession } } = await supabase.auth.getSession();
      const _accessToken = _authSession?.access_token;
      if (!_accessToken) { throw new Error("Vous devez être connecté."); }
      const tRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`,
        {
          method: "POST",
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${_accessToken}`,
          },
          body: formData,
        }
      );
      if (!tRes.ok) {
        const err = await tRes.json();
        throw new Error(err.error || "Transcription failed");
      }
      const transcriptionData = await tRes.json();
      const transcriptionText = transcriptionData.text || "";
      setUploadTranscribing(false);
      showInfo("Transcription terminée", "Génération du PV en cours…");
      await generateAndPreview(transcriptionText, newTitle, newSessionId);
    } catch (e: any) {
      showError(e, "Impossible de transcrire le fichier audio");
    } finally {
      setUploadTranscribing(false);
      resetForm();
    }
  };

  // ========== SAVE PENDING PV AS OFFICIAL MINUTE ==========
  const savePendingPV = async () => {
    if (!pendingPV) return;
    const sessionId = pendingPV.sessionId;
    if (!sessionId) {
      showError("Veuillez associer une session au procès-verbal.");
      return;
    }
    const { data, error } = await supabase.from("minutes").insert({
      session_id: sessionId,
      content: pendingPVContent,
      pv_status: "brouillon" as PvStatus,
    }).select().single();
    if (error) {
      showError(error, "Impossible d'enregistrer le procès-verbal");
      return;
    }
    if (data) {
      await supabase.from("minute_versions").insert({
        minute_id: data.id,
        version_number: 1,
        content: pendingPVContent,
        summary: "Génération initiale par IA",
        modified_by: user?.id,
      });
    }
    showSuccess("pv_updated");
    setPendingPV(null);
    setPendingPVContent("");
    fetchAll();
  };

  // ========== MANUAL PV CREATION ==========
  const createPV = async () => {
    const { data, error } = await supabase.from("minutes").insert([{ ...pvForm, pv_status: "brouillon" }]).select().single();
    if (error) {
      showError(error, "Impossible de créer le procès-verbal");
      return;
    }
    if (data) {
      await supabase.from("minute_versions").insert({
        minute_id: data.id,
        version_number: 1,
        content: pvForm.content,
        summary: "Création initiale",
        modified_by: user?.id,
      });
    }
    showSuccess("pv_created");
    setPvOpen(false);
    setPvForm({ session_id: "", content: "" });
    fetchAll();
  };

  // ========== UPDATE MINUTE CONTENT ==========
  const saveMinuteEdit = async () => {
    if (!viewMinute) return;
    if (viewMinute.pv_status !== "brouillon") { showError(null, "Ce PV est validé et ne peut plus être modifié"); return; }
    // Get next version number
    const { data: versions } = await supabase
      .from("minute_versions")
      .select("version_number")
      .eq("minute_id", viewMinute.id)
      .order("version_number", { ascending: false })
      .limit(1);
    const nextVersion = ((versions?.[0] as any)?.version_number ?? 0) + 1;

    const { error } = await supabase.from("minutes").update({ content: editingContent }).eq("id", viewMinute.id);
    if (error) {
      showError(error, "Impossible de sauvegarder les modifications du PV");
      return;
    }
    await supabase.from("minute_versions").insert({
      minute_id: viewMinute.id,
      version_number: nextVersion,
      content: editingContent,
      summary: "Modification manuelle",
      modified_by: user?.id,
    });
    showSuccess("saved");
    setViewMinute({ ...viewMinute, content: editingContent });
    setIsEditing(false);
    fetchAll();
  };


  const handleSendForValidation = async (id: string) => {
    const { error } = await supabase.from("minutes").update({ pv_status: "en_attente_validation" }).eq("id", id);
    if (error) showError(error, "Impossible d'envoyer le PV pour validation");
    else {
      showSuccess("pv_status_updated");
      fetchAll();
      setViewMinute((current: any) => current?.id === id ? { ...current, pv_status: "en_attente_validation" } : current);
    }
  };

  const handleValidateMinute = async (id: string) => {
    const { error } = await supabase.from("minutes").update({ pv_status: "valide", validated_at: new Date().toISOString() }).eq("id", id);
    if (error) showError(error, "Impossible de valider le PV");
    else {
      showSuccess("pv_status_updated");
      fetchAll();
      setViewMinute((current: any) => current?.id === id ? { ...current, pv_status: "valide", validated_at: new Date().toISOString() } : current);
    }
  };

  const handlePublishMinute = async (id: string) => {
    const { error } = await supabase.rpc("publish_minute", { _minute_id: id });
    if (error) showError(error, "Impossible de publier le PV");
    else {
      showSuccess("pv_status_updated");
      fetchAll();
      setViewMinute((current: any) => current?.id === id ? { ...current, is_published: true } : current);
    }
  };

  const openMinute = (minute: any, startEditing = false) => {
    setViewMinute(minute);
    setEditingContent(minute.content || "");
    setIsEditing(startEditing);
  };

  const closeRealtimeEditing = () => {
    setViewMinute((current: any) => current ? { ...current, content: editingContent } : current);
    setIsEditing(false);
    fetchAll();
  };

  const deleteMinute = async (id: string) => {
    await supabase.from("minute_versions").delete().eq("minute_id", id);
    await supabase.from("minutes").delete().eq("id", id);
    showSuccess("deleted");
    fetchAll();
  };

  // ========== EXPORTS ==========
  const exportPDF = async (minute: any) => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const content = minute.content || "";
    const title = minute.sessions?.title || "Procès-verbal";
    const lines = doc.splitTextToSize(content, 170);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(title, 20, 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Date: ${new Date(minute.created_at).toLocaleDateString("fr-FR")}`, 20, 30);
    doc.setDrawColor(200);
    doc.line(20, 34, 190, 34);
    doc.setFontSize(11);
    let y = 42;
    for (const line of lines) {
      if (y > 275) { doc.addPage(); y = 20; }
      doc.text(line, 20, y);
      y += 6;
    }
    doc.save(`PV_${title.replace(/\s+/g, "_")}.pdf`);
  };

  const exportTXT = (minute: any) => {
    const content = minute.content || "";
    const title = minute.sessions?.title || "Procès-verbal";
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PV_${title.replace(/\s+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportDOCX = (minute: any) => {
    const content = minute.content || "";
    const title = minute.sessions?.title || "Procès-verbal";
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${title}</title></head>
<body><h1>${title}</h1><p>Date: ${new Date(minute.created_at).toLocaleDateString("fr-FR")}</p><hr/>
${content.split("\n").map((l: string) => `<p>${l}</p>`).join("")}
</body></html>`;
    const blob = new Blob([html], { type: "application/vnd.ms-word;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PV_${title.replace(/\s+/g, "_")}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ========== TTS ==========
  const playTTS = async (text: string) => {
    setTtsLoading(true);
    try {
      const truncatedText = text.substring(0, 5000);
      const { data: { session: _authSession } } = await supabase.auth.getSession();
      const _accessToken = _authSession?.access_token;
      if (!_accessToken) { throw new Error("Vous devez être connecté."); }
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tts-pv`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${_accessToken}`,
          },
          body: JSON.stringify({ text: truncatedText }),
        }
      );
      if (!response.ok) throw new Error("TTS failed");
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      setTtsAudioUrl(audioUrl);
      const audio = new Audio(audioUrl);
      audioPlayerRef.current = audio;
      await audio.play();
    } catch (e: any) {
      showError(e, "Impossible de lire le procès-verbal (synthèse vocale)");
    } finally {
      setTtsLoading(false);
    }
  };

  // ========== TEMPLATE CRUD ==========
  const uploadTemplate = async () => {
    if (!templateFile || !templateName) return;
    setParsingTemplate(true);
    try {
      const sanitizedName = templateFile.name
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${companyId}/${Date.now()}_${sanitizedName}`;
      const { error: upErr } = await supabase.storage.from("pv-templates").upload(filePath, templateFile);
      if (upErr) throw new Error(upErr.message);
      const { data: tpl, error: insErr } = await supabase
        .from("meeting_templates")
        .insert({ name: templateName, file_path: filePath, created_by: user?.id })
        .select()
        .single();
      if (insErr || !tpl) throw new Error(insErr?.message);
      const { data: parseData, error: parseErr } = await supabase.functions.invoke("parse-template", {
        body: { templateId: tpl.id },
      });
      if (parseErr) console.error("Parse error:", parseErr);
      showInfo("Modèle importé", parseData?.content ? "Structure analysée avec succès." : "Importé sans analyse.");
      setTemplateOpen(false);
      setTemplateName("");
      setTemplateFile(null);
      fetchAll();
    } catch (e: any) {
      showError(e, "Impossible d'importer le modèle");
    } finally {
      setParsingTemplate(false);
    }
  };

  const deleteTemplate = async (id: string, filePath: string) => {
    await supabase.storage.from("pv-templates").remove([filePath]);
    await supabase.from("meeting_templates").delete().eq("id", id);
    showSuccess("deleted");
    fetchAll();
  };

  // ========== PENDING PV EDITOR (AI preview before save) ==========
  if (pendingPV) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" onClick={() => { setPendingPV(null); setPendingPVContent(""); }} className="mb-2">
              ← Annuler
            </Button>
            <h1 className="text-2xl font-bold">Révision du procès-verbal généré</h1>
            <p className="text-muted-foreground">
              Relisez et modifiez le contenu avant de l'enregistrer comme PV officiel.
            </p>
          </div>
        </div>

        {!pendingPV.sessionId && (
          <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
            <CardContent className="p-4">
              <Label className="mb-2 block">Session associée *</Label>
              <Select value={pendingPV.sessionId} onValueChange={(v) => setPendingPV({ ...pendingPV, sessionId: v })}>
                <SelectTrigger className="w-full max-w-sm"><SelectValue placeholder="Sélectionnez une session" /></SelectTrigger>
                <SelectContent>
                  {sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.title} {s.organs?.type === "comite_audit" ? "(Comité d'Audit)" : "(CA)"}</SelectItem>)}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Edit className="w-4 h-4" />
                Éditeur de procès-verbal
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setPendingPV(null); setPendingPVContent(""); }}>
                  Annuler
                </Button>
                <Button onClick={savePendingPV} disabled={!pendingPV.sessionId}>
                  <Save className="w-4 h-4 mr-2" />
                  Enregistrer le procès-verbal
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <RichTextEditor content={pendingPVContent} onChange={setPendingPVContent} minHeight="500px" />
          </CardContent>
        </Card>

        {/* AI Analysis in preview - only if session is set */}
        {pendingPV.sessionId && pendingPVContent && (
          <MeetingAIAnalysis
            minuteId="preview"
            sessionId={pendingPV.sessionId}
            pvContent={pendingPVContent}
            members={members}
            onDecisionCreated={() => fetchAll()}
            onActionCreated={() => fetchAll()}
          />
        )}
      </div>
    );
  }

  // Fetch signatures when viewing a minute

  // ========== MINUTE DETAIL VIEW ==========
  if (viewMinute) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" onClick={() => { setViewMinute(null); setTtsAudioUrl(null); setIsEditing(false); }} className="mb-2">
              ← Retour
            </Button>
            <h1 className="text-2xl font-bold">{viewMinute.sessions?.title || "Procès-verbal"}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={pvStatusColors[viewMinute.pv_status] ?? "bg-muted text-muted-foreground"}>
                {pvStatusLabels[viewMinute.pv_status] ?? viewMinute.pv_status}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {new Date(viewMinute.created_at).toLocaleDateString("fr-FR")}
              </span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Secretariat: edit brouillon */}
            {!isEditing && isSecretariat && viewMinute.pv_status === "brouillon" && (
              <Button variant="outline" onClick={() => { setIsEditing(true); setEditingContent(viewMinute.content || ""); }}>
                <Edit className="w-4 h-4 mr-2" />Éditer
              </Button>
            )}
            {isEditing && (
              <>
                <Button onClick={saveMinuteEdit}><Save className="w-4 h-4 mr-2" />Sauvegarder</Button>
                <Button variant="outline" onClick={closeRealtimeEditing}>Fermer l'édition</Button>
              </>
            )}
            {/* Secretariat: send for validation */}
            {isSecretariat && viewMinute.pv_status === "brouillon" && (
              <Button variant="outline" onClick={() => handleSendForValidation(viewMinute.id)} className="gap-1 text-amber-700 border-amber-300 hover:bg-amber-50">
                <Send className="w-3.5 h-3.5 mr-1" />Envoyer pour validation
              </Button>
            )}
            {/* President: validate */}
            {isPresident && viewMinute.pv_status === "en_attente_validation" && (
              <Button variant="outline" onClick={() => handleValidateMinute(viewMinute.id)} className="gap-1 text-primary border-primary/30 hover:bg-primary/10">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Valider
              </Button>
            )}
            {/* Secretariat: publish */}
            {isSecretariat && viewMinute.pv_status === "valide" && !viewMinute.is_published && (
              <Button variant="outline" onClick={() => handlePublishMinute(viewMinute.id)} className="gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50">
                <Send className="w-3.5 h-3.5 mr-1" />Publier
              </Button>
            )}
            <Button variant="outline" onClick={() => exportPDF(viewMinute)}><Download className="w-4 h-4 mr-2" />PDF</Button>
            <Button variant="outline" onClick={() => exportDOCX(viewMinute)}><FileDown className="w-4 h-4 mr-2" />Word</Button>
            <Button variant="outline" onClick={() => exportTXT(viewMinute)}><FileText className="w-4 h-4 mr-2" />TXT</Button>
            <Button
              variant="outline"
              onClick={() => playTTS(viewMinute.content || "")}
              disabled={ttsLoading || !viewMinute.content}
            >
              {ttsLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Volume2 className="w-4 h-4 mr-2" />}
              Écouter
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setVersionHistoryMinuteId(viewMinute.id);
                setVersionHistoryContent(viewMinute.content);
                setVersionHistoryOpen(true);
              }}
            >
              <History className="w-4 h-4 mr-2" />Versions
            </Button>
          </div>
        </div>

        {ttsAudioUrl && (
          <Card>
            <CardContent className="p-4">
              <audio controls src={ttsAudioUrl} className="w-full" />
            </CardContent>
          </Card>
        )}

        {isEditing && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 text-sm text-muted-foreground">
              Collaboration en direct active — présence, synchronisation et sauvegarde automatique sont activées.
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-6">
            {isEditing ? (
              <RichTextEditor
                content={editingContent}
                onChange={setEditingContent}
                minHeight="500px"
                placeholder="Modifiez le procès-verbal..."
              />
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="text-sm prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(viewMinute.content || "<p>Contenu vide</p>", {
                  ALLOWED_TAGS: ['p','br','strong','em','u','h1','h2','h3','h4','ul','ol','li','blockquote','a','table','thead','tbody','tr','th','td','img','span','div','sub','sup','s','hr'],
                  ALLOWED_ATTR: ['href','class','style','src','alt','width','height','target','rel','colspan','rowspan','data-type']
                }) }} />
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* AI Analysis */}
        {viewMinute.session_id && viewMinute.content && (
          <MeetingAIAnalysis
            minuteId={viewMinute.id}
            sessionId={viewMinute.session_id}
            pvContent={viewMinute.content}
            members={members}
            onDecisionCreated={() => fetchAll()}
            onActionCreated={() => fetchAll()}
          />
        )}

        <CommentThread entityType="minute" entityId={viewMinute.id} />


        <MinuteVersionHistory
          minuteId={versionHistoryMinuteId}
          currentContent={versionHistoryContent}
          open={versionHistoryOpen}
          onOpenChange={setVersionHistoryOpen}
          onRestore={async (content) => {
            const { data: currentVersions } = await supabase
              .from("minute_versions")
              .select("version_number")
              .eq("minute_id", versionHistoryMinuteId)
              .order("version_number", { ascending: false })
              .limit(1);
            const nextVersion = ((currentVersions?.[0] as any)?.version_number ?? 0) + 1;
            await supabase.from("minutes").update({ content }).eq("id", versionHistoryMinuteId);
            await supabase.from("minute_versions").insert({
              minute_id: versionHistoryMinuteId,
              version_number: nextVersion,
              content,
              summary: "Restauration d'une ancienne version",
              modified_by: user?.id,
            });
            setViewMinute({ ...viewMinute, content });
            setVersionHistoryContent(content);
            fetchAll();
          }}
        />
      </div>
    );
  }

  // ========== MAIN VIEW ==========
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Réunions & Procès-verbaux</h1>
        <p className="text-muted-foreground">Enregistrement, transcription et gestion des procès-verbaux</p>
      </div>

      {/* ===== RECORDING SECTION ===== */}
      {!isReadOnly && !isPresident && (
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Mic className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Enregistrement de la réunion</h2>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {recording.status === "idle" && (
              <Button onClick={startLiveTranscription} className="gap-2">
                <Mic className="w-4 h-4" />Démarrer l'écoute
              </Button>
            )}
            {isLiveMode && (
              <>
                <Button variant="secondary" onClick={recording.pause} className="gap-2">
                  <Pause className="w-4 h-4" />Pause
                </Button>
                <Button variant="destructive" onClick={stopLiveTranscription} className="gap-2">
                  <Square className="w-4 h-4" />Arrêter
                </Button>
              </>
            )}
            {isPaused && (
              <>
                <Button onClick={recording.resume} className="gap-2">
                  <Play className="w-4 h-4" />Reprendre
                </Button>
                <Button variant="destructive" onClick={stopLiveTranscription} className="gap-2">
                  <Square className="w-4 h-4" />Arrêter
                </Button>
              </>
            )}
            {(isLiveMode || isPaused) && (
              <Badge variant="outline" className="font-mono">
                {formatDuration(recording.elapsedMs)}
              </Badge>
            )}

            <Button
              variant="outline"
              onClick={generatePVFromLive}
              disabled={!liveTranscript || generating}
              className="gap-2"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              Générer le PV
            </Button>

            {templates.length > 0 && (
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Modèle (optionnel)" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            <Select value={pvMode} onValueChange={(v) => setPvMode(v as "professionnel" | "simplifie")}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professionnel">PV Professionnel</SelectItem>
                <SelectItem value="simplifie">PV Simplifié</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {recording.status === "idle" && !liveTranscript && (
            <p className="text-sm text-muted-foreground">
              Cliquez sur "Démarrer l'écoute" pour transcrire en temps réel. L'écoute continue même si vous changez de page.
            </p>
          )}

          {(isLiveMode || isPaused) && (
            <div className="space-y-3">
              <div className={`flex items-center gap-2 text-sm ${isPaused ? "text-amber-600" : "text-destructive"}`}>
                <span className={`w-2 h-2 rounded-full ${isPaused ? "bg-amber-500" : "bg-destructive animate-pulse"}`} />
                {isPaused ? "Écoute en pause" : "Écoute en cours — parlez maintenant..."}
              </div>
              <ScrollArea className="h-[150px] rounded-md border bg-muted/30 p-3">
                <p className="text-sm whitespace-pre-wrap">
                  {liveTranscript}
                  {partialText && <span className="text-muted-foreground italic"> {partialText}</span>}
                  {!liveTranscript && !partialText && <span className="text-muted-foreground">En attente de parole...</span>}
                </p>
              </ScrollArea>
            </div>
          )}

          {recording.status === "idle" && liveTranscript && (
            <div className="space-y-2">
              <Badge variant="secondary">✓ Transcription capturée</Badge>
              <ScrollArea className="h-[120px] rounded-md border bg-muted/30 p-3">
                <p className="text-sm whitespace-pre-wrap">{liveTranscript}</p>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {(uploadTranscribing || generating) && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm font-medium">
              {uploadTranscribing ? "Transcription de l'audio en cours..." : "Génération du procès-verbal par l'IA..."}
            </span>
          </CardContent>
        </Card>
      )}

      {/* ===== TABS ===== */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pv" className="gap-2">
            <ClipboardCheck className="w-4 h-4" />Procès-verbaux
          </TabsTrigger>
          {!isReadOnly && !isPresident && (
            <TabsTrigger value="templates" className="gap-2">
              <BookOpen className="w-4 h-4" />Modèles de PV
            </TabsTrigger>
          )}
        </TabsList>

        {/* ===== UNIFIED PV TAB ===== */}
        <TabsContent value="pv" className="space-y-4">
          <div className="flex justify-end gap-2">
            {isSecretariat && (<>

            {/* Import audio dialog */}
            <Dialog open={createOpen} onOpenChange={(open) => {
              setCreateOpen(open);
              if (!open) resetForm();
            }}>
                <DialogTrigger asChild>
                  <Button variant="outline"><Upload className="w-4 h-4 mr-2" />Importer un audio</Button>
                </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>Importer un fichier audio</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Titre de la réunion *</Label>
                    <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ex: CA du 15 mars 2026" />
                  </div>
                  <div className="space-y-2">
                    <Label>Session associée (optionnel)</Label>
                    <Select value={newSessionId} onValueChange={setNewSessionId}>
                      <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                      <SelectContent>
                        {sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.title} {s.organs?.type === "comite_audit" ? "(Comité d'Audit)" : "(CA)"}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Modèle de PV (optionnel)</Label>
                    <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                      <SelectTrigger><SelectValue placeholder="Aucun modèle" /></SelectTrigger>
                      <SelectContent>
                        {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Mode de rédaction</Label>
                    <Select value={pvMode} onValueChange={(v) => setPvMode(v as "professionnel" | "simplifie")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professionnel">PV Professionnel (complet)</SelectItem>
                        <SelectItem value="simplifie">PV Simplifié (synthétique)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Langue de transcription</Label>
                    <Select value={transcriptionLang} onValueChange={setTranscriptionLang}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fra">Français</SelectItem>
                        <SelectItem value="eng">Anglais</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Fichier audio *</Label>
                    <Input
                      type="file"
                      accept="audio/mp3,audio/wav,audio/m4a,audio/mpeg,audio/webm,audio/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setUploadedFile(file);
                      }}
                    />
                    {uploadedFile && <p className="text-sm text-muted-foreground">Fichier : {uploadedFile.name}</p>}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setCreateOpen(false); resetForm(); }}>Annuler</Button>
                  <Button onClick={createWithUploadedFile} disabled={!newTitle || !uploadedFile}>
                    <Wand2 className="w-4 h-4 mr-2" />Transcrire & Générer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Manual PV dialog */}
            <Dialog open={pvOpen} onOpenChange={setPvOpen}>
                <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Nouveau PV manuel</Button></DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>Rédiger un procès-verbal</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Session *</Label>
                    <Select value={pvForm.session_id} onValueChange={(v) => setPvForm({ ...pvForm, session_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>{sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.title} {s.organs?.type === "comite_audit" ? "(Comité d'Audit)" : "(CA)"}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Contenu du PV</Label>
                    <RichTextEditor content={pvForm.content} onChange={(html) => setPvForm({ ...pvForm, content: html })} minHeight="200px" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setPvOpen(false)}>Annuler</Button>
                  <Button onClick={createPV} disabled={!pvForm.session_id}>Enregistrer</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </>)}
          </div>

          {/* PV split by organ type */}
          {(() => {
            const getOrganType = (m: any): string => m?.sessions?.organs?.type ?? "ca";
            const canPresidentValidate = (organType: string): boolean => {
              if (!isPresident) return false;
              return !isReadOnlyForOrgan(organType);
            };

            const caMinutesAll = minutes.filter((m: any) => getOrganType(m) === "ca");
            const auditMinutesAll = minutes.filter((m: any) => getOrganType(m) === "comite_audit");

            const filterVisible = (list: any[], organType: string) => {
              if (isReadOnly && !isPresident && !isSecretariat) {
                return list.filter((m: any) => m.is_published === true);
              }
              if (isPresident && isReadOnlyForOrgan(organType)) {
                return list.filter((m: any) => m.is_published === true);
              }
              return list;
            };

            const caMinutes = filterVisible(caMinutesAll, "ca");
            const auditMinutes = filterVisible(auditMinutesAll, "comite_audit");

            const renderPVTable = (list: any[], organType: string) => {
              const displayMinutes = list;

              return (
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
                        {displayMinutes.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                              <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
                              <p className="font-medium">Aucun procès-verbal</p>
                              {!isReadOnly && <p className="text-sm">Créez un PV manuellement ou utilisez l'enregistrement IA.</p>}
                            </TableCell>
                          </TableRow>
                        ) : displayMinutes.map((m: any) => (
                          <TableRow key={m.id}>
                            <TableCell className="font-medium">
                              {m.sessions?.title || "—"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Badge className={pvStatusColors[m.pv_status] ?? "bg-muted text-muted-foreground"}>
                                  {pvStatusLabels[m.pv_status] ?? m.pv_status ?? "Brouillon"}
                                </Badge>
                                {m.is_published && <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">Publié</Badge>}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(m.created_at).toLocaleDateString("fr-FR")}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {isSecretariat && m.pv_status === "brouillon" && (
                                  <Button variant="outline" size="sm" onClick={() => handleSendForValidation(m.id)} className="gap-1 text-amber-700 border-amber-300 hover:bg-amber-50">
                                    <Send className="w-3.5 h-3.5" />Envoyer
                                  </Button>
                                )}
                                {canPresidentValidate(getOrganType(m)) && m.pv_status === "en_attente_validation" && (
                                  <Button variant="outline" size="sm" onClick={() => handleValidateMinute(m.id)} className="gap-1 text-primary border-primary/30 hover:bg-primary/10">
                                    <CheckCircle2 className="w-3.5 h-3.5" />Valider
                                  </Button>
                                )}
                                {isSecretariat && m.pv_status === "valide" && !m.is_published && (
                                  <Button variant="outline" size="sm" onClick={() => handlePublishMinute(m.id)} className="gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50">
                                    <Send className="w-3.5 h-3.5" />Publier
                                  </Button>
                                )}
                                <Button variant="ghost" size="sm" onClick={() => openMinute(m, false)}>
                                  <Eye className="w-4 h-4" />
                                </Button>
                                {isSecretariat && m.pv_status === "brouillon" && (
                                  <Button variant="ghost" size="sm" onClick={() => openMinute(m, true)}>
                                    <Edit className="w-4 h-4 mr-1" />Éditer
                                  </Button>
                                )}
                                <Button variant="ghost" size="sm" onClick={() => openMinute(m, false)}>
                                  <MessageSquare className="w-4 h-4 mr-1" />Commentaires
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => exportPDF(m)}>
                                  <Download className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => {
                                  setVersionHistoryMinuteId(m.id);
                                  setVersionHistoryContent(m.content);
                                  setVersionHistoryOpen(true);
                                }}>
                                  <History className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              );
            };

            // If direction member, only show audit
            if (isDirectionMember) {
              return renderPVTable(auditMinutes, "comite_audit");
            }

            return (
              <Tabs defaultValue="pv_ca" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="pv_ca">Conseil d'Administration ({caMinutes.length})</TabsTrigger>
                  <TabsTrigger value="pv_audit">Comité d'Audit ({auditMinutes.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="pv_ca" className="mt-4">
                  {renderPVTable(caMinutes, "ca")}
                </TabsContent>
                <TabsContent value="pv_audit" className="mt-4">
                  {renderPVTable(auditMinutes, "comite_audit")}
                </TabsContent>
              </Tabs>
            );
          })()}
        </TabsContent>

        {/* ===== TEMPLATES TAB ===== */}
        <TabsContent value="templates" className="space-y-4">
          <div className="flex justify-between items-start">
            <p className="text-sm text-muted-foreground max-w-lg">
              Importez des exemples de procès-verbaux pour que l'IA s'inspire de leur structure et style.
            </p>
            <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="w-4 h-4 mr-2" />Importer un modèle</Button>
                </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Importer un modèle de PV</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nom du modèle</Label>
                    <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Ex: PV CA standard" />
                  </div>
                  <div className="space-y-2">
                    <Label>Fichier (PDF, DOCX, TXT)</Label>
                    <Input type="file" accept=".pdf,.docx,.doc,.txt" onChange={(e) => setTemplateFile(e.target.files?.[0] || null)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setTemplateOpen(false)}>Annuler</Button>
                  <Button onClick={uploadTemplate} disabled={!templateName || !templateFile || parsingTemplate}>
                    {parsingTemplate ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                    {parsingTemplate ? "Analyse en cours..." : "Importer"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="p-8 text-center text-muted-foreground">
                  <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>Aucun modèle importé</p>
                  <p className="text-sm">Importez des exemples de PV pour améliorer la qualité de la génération.</p>
                </CardContent>
              </Card>
            ) : (
              templates.map((t) => (
                <Card key={t.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium">{t.name}</h3>
                        <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString("fr-FR")}</p>
                      </div>
                      <Badge variant={t.extracted_content ? "default" : "secondary"}>
                        {t.extracted_content ? "Analysé" : "En attente"}
                      </Badge>
                    </div>
                    {t.extracted_content && <p className="text-xs text-muted-foreground line-clamp-3">{t.extracted_content}</p>}
                    <Button variant="ghost" size="sm" className="text-destructive w-full" onClick={() => deleteTemplate(t.id, t.file_path)}>
                      <Trash2 className="w-4 h-4 mr-2" />Supprimer
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Version history dialog (from main list) */}
      <MinuteVersionHistory
        minuteId={versionHistoryMinuteId}
        currentContent={versionHistoryContent}
        open={versionHistoryOpen}
        onOpenChange={setVersionHistoryOpen}
        onRestore={async (content) => {
          const { data: currentVersions } = await supabase
            .from("minute_versions")
            .select("version_number")
            .eq("minute_id", versionHistoryMinuteId)
            .order("version_number", { ascending: false })
            .limit(1);
          const nextVersion = ((currentVersions?.[0] as any)?.version_number ?? 0) + 1;
          await supabase.from("minutes").update({ content }).eq("id", versionHistoryMinuteId);
          await supabase.from("minute_versions").insert({
            minute_id: versionHistoryMinuteId,
            version_number: nextVersion,
            content,
            summary: "Restauration d'une ancienne version",
            modified_by: user?.id,
          });
          fetchAll();
        }}
      />
      {permEntityId && (
        <EntityPermissionsDialog
          open={!!permEntityId}
          onOpenChange={(open) => { if (!open) setPermEntityId(null); }}
          entityType="meeting"
          entityId={permEntityId}
          entityName={permEntityName}
        />
      )}
    </div>
  );
}
