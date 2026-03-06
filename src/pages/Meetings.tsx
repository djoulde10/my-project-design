import { useEffect, useState, useRef, useCallback } from "react";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus, Mic, MicOff, Upload, FileText, Download, Loader2, Volume2, BookOpen, Trash2, Eye, Wand2, Radio, ClipboardCheck, History
} from "lucide-react";
import MinuteVersionHistory from "@/components/MinuteVersionHistory";
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();
  const { user } = useAuth();
  const companyId = useCompanyId();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [minutes, setMinutes] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("recording");

  // Meeting creation
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSessionId, setNewSessionId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  // Realtime transcription state
  const [liveTranscript, setLiveTranscript] = useState("");
  const [partialText, setPartialText] = useState("");
  const [isLiveMode, setIsLiveMode] = useState(false);
  const committedTextRef = useRef("");

  // Upload mode
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadTranscribing, setUploadTranscribing] = useState(false);

  // Processing states
  const [generating, setGenerating] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);

  // Detail view
  const [viewMeeting, setViewMeeting] = useState<any | null>(null);
  const [editedPV, setEditedPV] = useState("");
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Template upload
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [parsingTemplate, setParsingTemplate] = useState(false);

  // PV creation dialog
  const [pvOpen, setPvOpen] = useState(false);
  const [pvForm, setPvForm] = useState<{ session_id: string; content: string; pv_status: PvStatus }>({ session_id: "", content: "", pv_status: "brouillon" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<PvStatus>("brouillon");

  // Version history
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [versionHistoryMinuteId, setVersionHistoryMinuteId] = useState<string>("");
  const [versionHistoryContent, setVersionHistoryContent] = useState<string | null>(null);

  // Realtime scribe hook
  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: (data) => {
      setPartialText(data.text || "");
    },
    onCommittedTranscript: (data) => {
      const newText = data.text || "";
      committedTextRef.current += (committedTextRef.current ? " " : "") + newText;
      setLiveTranscript(committedTextRef.current);
      setPartialText("");
    },
  });

  const fetchAll = useCallback(async () => {
    const [meetRes, tplRes, sessRes, minRes] = await Promise.all([
      supabase.from("meetings").select("*, sessions(title)").order("created_at", { ascending: false }),
      supabase.from("meeting_templates").select("*").order("created_at", { ascending: false }),
      supabase.from("sessions").select("id, title").order("session_date", { ascending: false }),
      supabase.from("minutes").select("*, sessions(title)").order("created_at", { ascending: false }),
    ]);
    setMeetings(meetRes.data ?? []);
    setTemplates(tplRes.data ?? []);
    setSessions(sessRes.data ?? []);
    setMinutes(minRes.data ?? []);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ========== REALTIME RECORDING ==========
  const startLiveTranscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("elevenlabs-scribe-token");
      if (error || !data?.token) {
        throw new Error(error?.message || "Impossible d'obtenir le token de transcription");
      }
      committedTextRef.current = "";
      setLiveTranscript("");
      setPartialText("");
      setIsLiveMode(true);
      await scribe.connect({
        token: data.token,
        microphone: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
      setIsLiveMode(false);
    }
  };

  const stopLiveTranscription = async () => {
    try { await scribe.disconnect(); } catch { /* ignore */ }
    setIsLiveMode(false);
  };

  // ========== GENERATE PV FROM LIVE ==========
  const generatePVFromLive = async () => {
    const finalTranscript = committedTextRef.current;
    if (!finalTranscript) {
      toast({ title: "Erreur", description: "Aucune transcription disponible", variant: "destructive" });
      return;
    }
    if (scribe.isConnected) await stopLiveTranscription();

    setGenerating(true);
    try {
      let templateContent = "";
      if (selectedTemplateId) {
        const tpl = templates.find((t) => t.id === selectedTemplateId);
        if (tpl?.extracted_content) templateContent = tpl.extracted_content;
      }

      // Create meeting record
      const { data: meeting, error: insertError } = await supabase
        .from("meetings")
        .insert({
          title: newTitle || `Réunion du ${new Date().toLocaleDateString("fr-FR")}`,
          session_id: newSessionId || null,
          transcription: finalTranscript,
          created_by: user?.id,
          pv_status: "en_cours",
        })
        .select()
        .single();
      if (insertError || !meeting) throw new Error(insertError?.message);

      toast({ title: "Génération du PV en cours..." });

      const { data: pvData, error: pvError } = await supabase.functions.invoke("generate-pv", {
        body: {
          transcription: finalTranscript,
          meetingTitle: meeting.title,
          meetingDate: new Date().toLocaleDateString("fr-FR"),
          templateContent,
        },
      });
      if (pvError) throw new Error(pvError.message);

      const generatedPV = pvData?.pv || "";
      await supabase.from("meetings").update({ generated_pv: generatedPV, pv_status: "brouillon" }).eq("id", meeting.id);
      toast({ title: "Procès-verbal généré !" });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
      resetForm();
      fetchAll();
    }
  };

  // ========== CREATE MEETING WITH UPLOADED FILE ==========
  const createWithUploadedFile = async () => {
    if (!uploadedFile || !newTitle) {
      toast({ title: "Erreur", description: "Titre et fichier audio requis", variant: "destructive" });
      return;
    }
    setCreateOpen(false);

    const fileName = `${companyId}/${Date.now()}_${newTitle.replace(/\s+/g, "_")}.${uploadedFile.name.split(".").pop()}`;
    const { error: uploadError } = await supabase.storage.from("meeting-audio").upload(fileName, uploadedFile);
    if (uploadError) {
      toast({ title: "Erreur upload", description: uploadError.message, variant: "destructive" });
      return;
    }

    const { data: meeting, error: insertError } = await supabase
      .from("meetings")
      .insert({
        title: newTitle,
        session_id: newSessionId || null,
        audio_file_path: fileName,
        created_by: user?.id,
        pv_status: "en_cours",
      })
      .select()
      .single();

    if (insertError || !meeting) {
      toast({ title: "Erreur", description: insertError?.message, variant: "destructive" });
      return;
    }

    toast({ title: "Réunion créée", description: "Transcription en cours..." });
    fetchAll();

    setUploadTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("audio", uploadedFile, fileName);

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
      await supabase.from("meetings").update({ transcription: transcriptionText }).eq("id", meeting.id);
      toast({ title: "Transcription terminée", description: "Génération du PV en cours..." });

      setUploadTranscribing(false);
      setGenerating(true);

      let templateContent = "";
      if (selectedTemplateId) {
        const tpl = templates.find((t) => t.id === selectedTemplateId);
        if (tpl?.extracted_content) templateContent = tpl.extracted_content;
      }

      const { data: pvData, error: pvError } = await supabase.functions.invoke("generate-pv", {
        body: {
          transcription: transcriptionText,
          meetingTitle: newTitle,
          meetingDate: new Date().toLocaleDateString("fr-FR"),
          templateContent,
        },
      });
      if (pvError) throw new Error(pvError.message);

      const generatedPV = pvData?.pv || "";
      await supabase.from("meetings").update({ generated_pv: generatedPV, pv_status: "brouillon" }).eq("id", meeting.id);
      toast({ title: "Procès-verbal généré !" });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
      await supabase.from("meetings").update({ pv_status: "erreur" }).eq("id", meeting.id);
    } finally {
      setUploadTranscribing(false);
      setGenerating(false);
      resetForm();
      fetchAll();
    }
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
      toast({ title: "Erreur TTS", description: e.message, variant: "destructive" });
    } finally {
      setTtsLoading(false);
    }
  };

  // ========== PDF EXPORT ==========
  const exportPDF = async (meeting: any) => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const content = meeting.generated_pv || "";
    const lines = doc.splitTextToSize(content, 170);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(meeting.title, 20, 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Date: ${new Date(meeting.meeting_date || meeting.created_at).toLocaleDateString("fr-FR")}`, 20, 30);
    doc.setDrawColor(200);
    doc.line(20, 34, 190, 34);
    doc.setFontSize(11);
    let y = 42;
    for (const line of lines) {
      if (y > 275) { doc.addPage(); y = 20; }
      doc.text(line, 20, y);
      y += 6;
    }
    doc.save(`PV_${meeting.title.replace(/\s+/g, "_")}.pdf`);
  };

  // ========== SAVE EDITED PV ==========
  const savePV = async () => {
    if (!viewMeeting) return;
    const { error } = await supabase.from("meetings").update({ generated_pv: editedPV }).eq("id", viewMeeting.id);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else {
      toast({ title: "PV sauvegardé" });
      setViewMeeting({ ...viewMeeting, generated_pv: editedPV });
      fetchAll();
    }
  };

  // ========== TEMPLATE UPLOAD ==========
  const uploadTemplate = async () => {
    if (!templateFile || !templateName) return;
    setParsingTemplate(true);
    try {
      const filePath = `${companyId}/${Date.now()}_${templateFile.name}`;
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
      toast({ title: "Modèle importé", description: parseData?.content ? "Structure analysée avec succès" : "Importé sans analyse" });
      setTemplateOpen(false);
      setTemplateName("");
      setTemplateFile(null);
      fetchAll();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setParsingTemplate(false);
    }
  };

  const deleteTemplate = async (id: string, filePath: string) => {
    await supabase.storage.from("pv-templates").remove([filePath]);
    await supabase.from("meeting_templates").delete().eq("id", id);
    toast({ title: "Modèle supprimé" });
    fetchAll();
  };

  const deleteMeeting = async (id: string, audioPath?: string) => {
    if (audioPath) await supabase.storage.from("meeting-audio").remove([audioPath]);
    await supabase.from("meetings").delete().eq("id", id);
    toast({ title: "Réunion supprimée" });
    fetchAll();
  };

  // ========== PV (Minutes) CRUD ==========
  const createPV = async () => {
    const { data, error } = await supabase.from("minutes").insert([pvForm]).select().single();
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else {
      // Save initial version
      if (data) {
        await supabase.from("minute_versions").insert({
          minute_id: data.id,
          version_number: 1,
          content: pvForm.content,
          summary: "Création initiale",
          modified_by: user?.id,
        });
      }
      toast({ title: "PV créé" }); setPvOpen(false); setPvForm({ session_id: "", content: "", pv_status: "brouillon" }); fetchAll();
    }
  };

  const updateMinuteStatus = async (id: string, status: PvStatus) => {
    const { error } = await supabase.from("minutes").update({ pv_status: status }).eq("id", id);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else { toast({ title: "Statut mis à jour" }); setEditingId(null); fetchAll(); }
  };

  const meetingStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      brouillon: "bg-muted text-muted-foreground",
      en_cours: "bg-primary/10 text-primary",
      erreur: "bg-destructive/10 text-destructive",
      valide: "bg-emerald-100 text-emerald-800",
    };
    const labels: Record<string, string> = {
      brouillon: "Brouillon",
      en_cours: "En cours",
      erreur: "Erreur",
      valide: "Validé",
    };
    return <Badge className={map[status] ?? map.brouillon}>{labels[status] ?? status}</Badge>;
  };

  // ========== DETAIL VIEW ==========
  if (viewMeeting) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" onClick={() => { setViewMeeting(null); setTtsAudioUrl(null); }} className="mb-2">
              ← Retour
            </Button>
            <h1 className="text-2xl font-bold">{viewMeeting.title}</h1>
            <p className="text-muted-foreground">
              {new Date(viewMeeting.meeting_date || viewMeeting.created_at).toLocaleDateString("fr-FR")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportPDF(viewMeeting)}>
              <Download className="w-4 h-4 mr-2" />PDF
            </Button>
            <Button
              variant="outline"
              onClick={() => playTTS(viewMeeting.generated_pv || "")}
              disabled={ttsLoading || !viewMeeting.generated_pv}
            >
              {ttsLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Volume2 className="w-4 h-4 mr-2" />}
              Écouter
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Transcription</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <p className="text-sm whitespace-pre-wrap">{viewMeeting.transcription || "Aucune transcription"}</p>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Procès-verbal</CardTitle>
                <Button size="sm" onClick={savePV}>Sauvegarder</Button>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                className="min-h-[400px] text-sm font-mono"
                value={editedPV}
                onChange={(e) => setEditedPV(e.target.value)}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ========== MAIN VIEW ==========
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Réunions & Procès-verbaux</h1>
        <p className="text-muted-foreground">Enregistrement, transcription en temps réel et gestion des procès-verbaux</p>
      </div>

      {/* ===== RECORDING SECTION (inspired by screenshot) ===== */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Mic className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Enregistrement de la réunion</h2>
          </div>

          <div className="flex items-center gap-3">
            {!isLiveMode ? (
              <Button onClick={startLiveTranscription} className="gap-2">
                <Mic className="w-4 h-4" />
                Démarrer l'écoute
              </Button>
            ) : (
              <Button variant="destructive" onClick={stopLiveTranscription} className="gap-2">
                <MicOff className="w-4 h-4" />
                Arrêter l'écoute
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
              Cliquez sur "Démarrer l'écoute" pour transcrire la réunion en temps réel. Une fois terminé, l'IA générera automatiquement un procès-verbal structuré.
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

      {/* ===== TABS: PV, Réunions IA, Modèles ===== */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="recording" className="gap-2">
            <ClipboardCheck className="w-4 h-4" />Procès-verbaux
          </TabsTrigger>
          <TabsTrigger value="meetings" className="gap-2">
            <FileText className="w-4 h-4" />Réunions IA
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <BookOpen className="w-4 h-4" />Modèles de PV
          </TabsTrigger>
        </TabsList>

        {/* ===== PV TAB ===== */}
        <TabsContent value="recording" className="space-y-4">
          <div className="flex justify-end">
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
                    <Textarea className="min-h-[200px]" value={pvForm.content} onChange={(e) => setPvForm({ ...pvForm, content: e.target.value })} />
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

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Session</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {minutes.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Aucun PV</TableCell></TableRow>
                  ) : (
                    minutes.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{(m as any).sessions?.title}</TableCell>
                        <TableCell>
                          {editingId === m.id ? (
                            <Select value={editStatus} onValueChange={(v) => { const s = v as PvStatus; setEditStatus(s); updateMinuteStatus(m.id, s); }}>
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
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => { setEditingId(m.id); setEditStatus(m.pv_status ?? "brouillon"); }}>
                              Modifier statut
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
                              <History className="w-4 h-4 mr-1" />Versions
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

        {/* ===== MEETINGS TAB ===== */}
        <TabsContent value="meetings" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={createOpen} onOpenChange={(open) => {
              setCreateOpen(open);
              if (!open && scribe.isConnected) stopLiveTranscription();
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" />Nouvelle réunion (fichier audio)</Button>
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
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titre</TableHead>
                    <TableHead>Session</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meetings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Aucune réunion. Utilisez l'enregistrement en direct ci-dessus ou importez un fichier audio.
                      </TableCell>
                    </TableRow>
                  ) : (
                    meetings.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.title}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {(m as any).sessions?.title || "—"}
                        </TableCell>
                        <TableCell>{meetingStatusBadge(m.pv_status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(m.created_at).toLocaleDateString("fr-FR")}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setViewMeeting(m); setEditedPV(m.generated_pv || ""); }}
                              disabled={!m.generated_pv}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => exportPDF(m)} disabled={!m.generated_pv}>
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => deleteMeeting(m.id, m.audio_file_path)}
                            >
                              <Trash2 className="w-4 h-4" />
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
              Importez des exemples de procès-verbaux pour que l'IA s'inspire de leur structure et style lors de la génération.
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
                    <Input
                      type="file"
                      accept=".pdf,.docx,.doc,.txt"
                      onChange={(e) => setTemplateFile(e.target.files?.[0] || null)}
                    />
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
                        <p className="text-xs text-muted-foreground">
                          {new Date(t.created_at).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                      <Badge variant={t.extracted_content ? "default" : "secondary"}>
                        {t.extracted_content ? "Analysé" : "En attente"}
                      </Badge>
                    </div>
                    {t.extracted_content && (
                      <p className="text-xs text-muted-foreground line-clamp-3">{t.extracted_content}</p>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive w-full"
                      onClick={() => deleteTemplate(t.id, t.file_path)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />Supprimer
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
