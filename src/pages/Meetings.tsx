import { useEffect, useState, useRef, useCallback } from "react";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import RichTextEditor from "@/components/RichTextEditor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus, Mic, MicOff, Upload, FileText, Download, Loader2, Volume2, BookOpen, Trash2, Eye, Wand2,
  ClipboardCheck, History, Edit, Save, FileDown, PenTool, CheckCircle2, Brain
} from "lucide-react";
import MinuteVersionHistory from "@/components/MinuteVersionHistory";
import MeetingAIAnalysis from "@/components/MeetingAIAnalysis";
import { showSuccess, showError, showInfo } from "@/lib/toastHelpers";
import { useAuth } from "@/lib/auth";
import { useCompanyId } from "@/hooks/useCompanyId";

// PV status helpers
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

export default function Meetings() {
  
  const { user } = useAuth();
  const companyId = useCompanyId();
  const [templates, setTemplates] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [minutes, setMinutes] = useState<any[]>([]);
  const [members, setMembers] = useState<{ id: string; full_name: string }[]>([]);
  const [activeTab, setActiveTab] = useState("pv");

  // Realtime transcription state
  const [liveTranscript, setLiveTranscript] = useState("");
  const [partialText, setPartialText] = useState("");
  const [isLiveMode, setIsLiveMode] = useState(false);
  const committedTextRef = useRef("");

  // Upload mode
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSessionId, setNewSessionId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
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
  const [pvForm, setPvForm] = useState<{ session_id: string; content: string; pv_status: PvStatus }>({ session_id: "", content: "", pv_status: "brouillon" });

  // PV detail/edit view
  const [viewMinute, setViewMinute] = useState<any | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<PvStatus>("brouillon");

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

  // Signatures
  const [minuteSignatures, setMinuteSignatures] = useState<any[]>([]);
  const [signing, setSigning] = useState(false);

  // Realtime scribe hook
  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: (data) => setPartialText(data.text || ""),
    onCommittedTranscript: (data) => {
      const newText = data.text || "";
      committedTextRef.current += (committedTextRef.current ? " " : "") + newText;
      setLiveTranscript(committedTextRef.current);
      setPartialText("");
    },
  });

  const fetchAll = useCallback(async () => {
    const [tplRes, sessRes, minRes, memRes] = await Promise.all([
      supabase.from("meeting_templates").select("*").order("created_at", { ascending: false }),
      supabase.from("sessions").select("id, title").order("session_date", { ascending: false }),
      supabase.from("minutes").select("*, sessions(title)").order("created_at", { ascending: false }),
      supabase.from("members").select("id, full_name").eq("is_active", true).order("full_name"),
    ]);
    setTemplates(tplRes.data ?? []);
    setSessions(sessRes.data ?? []);
    setMinutes(minRes.data ?? []);
    setMembers(memRes.data ?? []);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { if (viewMinute?.id) fetchSignatures(viewMinute.id); }, [viewMinute?.id]);

  // ========== REALTIME RECORDING ==========
  const startLiveTranscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("elevenlabs-scribe-token");
      if (error || !data?.token) throw new Error(error?.message || "Impossible d'obtenir le token");
      committedTextRef.current = "";
      setLiveTranscript("");
      setPartialText("");
      setIsLiveMode(true);
      await scribe.connect({ token: data.token, microphone: { echoCancellation: true, noiseSuppression: true } });
    } catch (e: any) {
      showError(e, "Impossible de démarrer la transcription en direct");
      setIsLiveMode(false);
    }
  };

  const stopLiveTranscription = async () => {
    try { await scribe.disconnect(); } catch { /* ignore */ }
    setIsLiveMode(false);
  };

  const resetForm = () => {
    setUploadedFile(null);
    setNewTitle("");
    setNewSessionId("");
    setSelectedTemplateId("");
    setLiveTranscript("");
    setPartialText("");
    committedTextRef.current = "";
    setIsLiveMode(false);
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
    const finalTranscript = committedTextRef.current;
    if (!finalTranscript) {
      showError("Aucune transcription disponible");
      return;
    }
    if (scribe.isConnected) await stopLiveTranscription();
    await generateAndPreview(finalTranscript, newTitle, newSessionId);
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
      const tRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`,
        {
          method: "POST",
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
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
    const { data, error } = await supabase.from("minutes").insert([pvForm]).select().single();
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
    setPvForm({ session_id: "", content: "", pv_status: "brouillon" });
    fetchAll();
  };

  // ========== UPDATE MINUTE CONTENT ==========
  const saveMinuteEdit = async () => {
    if (!viewMinute) return;
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
      showError(error);
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

  const updateMinuteStatus = async (id: string, status: PvStatus) => {
    const { error } = await supabase.from("minutes").update({ pv_status: status }).eq("id", id);
    if (error) showError(error);
    else { showSuccess("pv_status_updated"); setEditingStatusId(null); fetchAll(); }
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
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tts-pv`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
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
      showError(e);
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
      showError(e);
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
                  {sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
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
  const fetchSignatures = async (minuteId: string) => {
    const { data } = await supabase
      .from("signatures")
      .select("*, profiles:signed_by(full_name)")
      .eq("entity_type", "minute")
      .eq("entity_id", minuteId)
      .order("signed_at", { ascending: false });
    setMinuteSignatures(data ?? []);
  };

  const signMinute = async (minuteId: string) => {
    setSigning(true);
    const { error } = await supabase.from("signatures").insert({
      entity_type: "minute",
      entity_id: minuteId,
      signed_by: user?.id,
    });
    if (error) {
      showError(error);
    } else {
      showSuccess("decision_signed");
      await fetchSignatures(minuteId);
      // Also update PV status to "signe" if validated
      if (viewMinute?.pv_status === "valide") {
        await supabase.from("minutes").update({ pv_status: "signe", signed_at: new Date().toISOString() }).eq("id", minuteId);
        setViewMinute({ ...viewMinute, pv_status: "signe", signed_at: new Date().toISOString() });
        fetchAll();
      }
    }
    setSigning(false);
  };

  const userHasSigned = (minuteId: string) => minuteSignatures.some((s) => s.signed_by === user?.id && s.entity_id === minuteId);

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
            {!isEditing && (
              <Button variant="outline" onClick={() => { setIsEditing(true); setEditingContent(viewMinute.content || ""); }}>
                <Edit className="w-4 h-4 mr-2" />Modifier
              </Button>
            )}
            {isEditing && (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>Annuler</Button>
                <Button onClick={saveMinuteEdit}><Save className="w-4 h-4 mr-2" />Sauvegarder</Button>
              </>
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
            {!isEditing && viewMinute.pv_status !== "brouillon" && !userHasSigned(viewMinute.id) && (
              <Button onClick={() => signMinute(viewMinute.id)} disabled={signing}>
                <PenTool className="w-4 h-4 mr-2" />{signing ? "Signature..." : "Signer"}
              </Button>
            )}
            {userHasSigned(viewMinute.id) && (
              <Badge className="bg-emerald-100 text-emerald-800 gap-1"><CheckCircle2 className="w-3 h-3" />Signé</Badge>
            )}
          </div>
        </div>

        {ttsAudioUrl && (
          <Card>
            <CardContent className="p-4">
              <audio controls src={ttsAudioUrl} className="w-full" />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-6">
            {isEditing ? (
              <RichTextEditor content={editingContent} onChange={setEditingContent} minHeight="500px" />
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="text-sm prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: viewMinute.content || "<p>Contenu vide</p>" }} />
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

        {/* Signatures */}
        {minuteSignatures.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><PenTool className="w-4 h-4" />Signatures ({minuteSignatures.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {minuteSignatures.map((sig: any) => (
                  <div key={sig.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="font-medium">{(sig as any).profiles?.full_name ?? "Utilisateur"}</span>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {new Date(sig.signed_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

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
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Mic className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Enregistrement de la réunion</h2>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {!isLiveMode ? (
              <Button onClick={startLiveTranscription} className="gap-2">
                <Mic className="w-4 h-4" />Démarrer l'écoute
              </Button>
            ) : (
              <Button variant="destructive" onClick={stopLiveTranscription} className="gap-2">
                <MicOff className="w-4 h-4" />Arrêter l'écoute
              </Button>
            )}

            <Button
              variant="outline"
              onClick={generatePVFromLive}
              disabled={!liveTranscript || isLiveMode || generating}
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
          </div>

          {!isLiveMode && !liveTranscript && (
            <p className="text-sm text-muted-foreground">
              Cliquez sur "Démarrer l'écoute" pour transcrire en temps réel, ou importez un fichier audio.
            </p>
          )}

          {isLiveMode && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-destructive">
                <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                Écoute en cours — parlez maintenant...
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

          {!isLiveMode && liveTranscript && (
            <div className="space-y-2">
              <Badge variant="secondary">✓ Transcription capturée</Badge>
              <ScrollArea className="h-[120px] rounded-md border bg-muted/30 p-3">
                <p className="text-sm whitespace-pre-wrap">{liveTranscript}</p>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>

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
          <TabsTrigger value="templates" className="gap-2">
            <BookOpen className="w-4 h-4" />Modèles de PV
          </TabsTrigger>
        </TabsList>

        {/* ===== UNIFIED PV TAB ===== */}
        <TabsContent value="pv" className="space-y-4">
          <div className="flex justify-end gap-2">
            {/* Import audio dialog */}
            <Dialog open={createOpen} onOpenChange={(open) => {
              setCreateOpen(open);
              if (!open && scribe.isConnected) stopLiveTranscription();
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
                        {sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
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
                      <SelectContent>{sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}</SelectContent>
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
                        {Object.entries(pvStatusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
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

          {/* Unified PV table */}
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
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
                        <p className="font-medium">Aucun procès-verbal</p>
                        <p className="text-sm">Créez un PV manuellement ou utilisez l'enregistrement IA.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    minutes.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{(m as any).sessions?.title || "—"}</TableCell>
                        <TableCell>
                          {editingStatusId === m.id ? (
                            <Select value={editStatus} onValueChange={(v) => { setEditStatus(v as PvStatus); updateMinuteStatus(m.id, v as PvStatus); }}>
                              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {Object.entries(pvStatusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge
                              className={`${pvStatusColors[m.pv_status] ?? "bg-muted text-muted-foreground"} cursor-pointer`}
                              onClick={() => { setEditingStatusId(m.id); setEditStatus(m.pv_status ?? "brouillon"); }}
                            >
                              {pvStatusLabels[m.pv_status] ?? m.pv_status ?? "Brouillon"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(m.created_at).toLocaleDateString("fr-FR")}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => { setViewMinute(m); setEditingContent(m.content || ""); }}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => exportPDF(m)}>
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setVersionHistoryMinuteId(m.id);
                                setVersionHistoryContent(m.content);
                                setVersionHistoryOpen(true);
                              }}
                            >
                              <History className="w-4 h-4" />
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
    </div>
  );
}
