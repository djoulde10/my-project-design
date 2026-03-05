import { useEffect, useState, useRef, useCallback } from "react";
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
  Plus, Mic, MicOff, Upload, FileText, Play, Pause, Download, Loader2, Volume2, BookOpen, Trash2, Eye, Wand2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

export default function Meetings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("meetings");

  // Meeting creation
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSessionId, setNewSessionId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  // Audio recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Processing states
  const [transcribing, setTranscribing] = useState(false);
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

  const fetchAll = useCallback(async () => {
    const [meetRes, tplRes, sessRes] = await Promise.all([
      supabase.from("meetings").select("*, sessions(title)").order("created_at", { ascending: false }),
      supabase.from("meeting_templates").select("*").order("created_at", { ascending: false }),
      supabase.from("sessions").select("id, title").order("session_date", { ascending: false }),
    ]);
    setMeetings(meetRes.data ?? []);
    setTemplates(tplRes.data ?? []);
    setSessions(sessRes.data ?? []);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ========== AUDIO RECORDING ==========
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setRecordedBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      toast({ title: "Erreur", description: "Impossible d'accéder au microphone", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  // ========== CREATE MEETING + PROCESS ==========
  const createAndProcess = async () => {
    const audioSource = recordedBlob || uploadedFile;
    if (!audioSource || !newTitle) {
      toast({ title: "Erreur", description: "Titre et audio requis", variant: "destructive" });
      return;
    }

    setCreateOpen(false);

    // 1. Upload audio to storage
    const fileName = `${Date.now()}_${newTitle.replace(/\s+/g, "_")}.${uploadedFile ? uploadedFile.name.split(".").pop() : "webm"}`;
    const { error: uploadError } = await supabase.storage
      .from("meeting-audio")
      .upload(fileName, audioSource);
    if (uploadError) {
      toast({ title: "Erreur upload", description: uploadError.message, variant: "destructive" });
      return;
    }

    // 2. Create meeting record
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

    // 3. Transcribe with ElevenLabs
    setTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("audio", audioSource, fileName);

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

      // 4. Generate PV with Lovable AI
      setTranscribing(false);
      setGenerating(true);

      // Get template content if selected
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
      setTranscribing(false);
      setGenerating(false);
      setRecordedBlob(null);
      setUploadedFile(null);
      setNewTitle("");
      setNewSessionId("");
      setSelectedTemplateId("");
      fetchAll();
    }
  };

  // ========== TTS ==========
  const playTTS = async (text: string) => {
    setTtsLoading(true);
    try {
      // Limit text for TTS (ElevenLabs has limits)
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
      const filePath = `${Date.now()}_${templateFile.name}`;
      const { error: upErr } = await supabase.storage.from("pv-templates").upload(filePath, templateFile);
      if (upErr) throw new Error(upErr.message);

      const { data: tpl, error: insErr } = await supabase
        .from("meeting_templates")
        .insert({ name: templateName, file_path: filePath, created_by: user?.id })
        .select()
        .single();
      if (insErr || !tpl) throw new Error(insErr?.message);

      // Parse template with AI
      const { data: parseData, error: parseErr } = await supabase.functions.invoke("parse-template", {
        body: { filePath, templateId: tpl.id },
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

  const statusBadge = (status: string) => {
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Réunions & PV intelligents</h1>
          <p className="text-muted-foreground">Transcription IA et génération automatique de procès-verbaux</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="meetings">
            <FileText className="w-4 h-4 mr-2" />Réunions
          </TabsTrigger>
          <TabsTrigger value="templates">
            <BookOpen className="w-4 h-4 mr-2" />Modèles de PV
          </TabsTrigger>
        </TabsList>

        {/* ===== MEETINGS TAB ===== */}
        <TabsContent value="meetings" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" />Nouvelle réunion</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Enregistrer une réunion</DialogTitle></DialogHeader>
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

                  <div className="space-y-3">
                    <Label>Audio de la réunion *</Label>
                    
                    {/* Recording */}
                    <div className="flex items-center gap-3">
                      {!isRecording ? (
                        <Button variant="outline" onClick={startRecording} disabled={!!recordedBlob}>
                          <Mic className="w-4 h-4 mr-2" />Enregistrer
                        </Button>
                      ) : (
                        <Button variant="destructive" onClick={stopRecording}>
                          <MicOff className="w-4 h-4 mr-2" />Arrêter
                        </Button>
                      )}
                      {isRecording && (
                        <span className="flex items-center gap-2 text-sm text-destructive">
                          <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                          Enregistrement en cours...
                        </span>
                      )}
                      {recordedBlob && !isRecording && (
                        <span className="text-sm text-muted-foreground">✓ Audio enregistré</span>
                      )}
                    </div>

                    <div className="text-center text-sm text-muted-foreground">ou</div>

                    {/* File upload */}
                    <div>
                      <Input
                        type="file"
                        accept="audio/mp3,audio/wav,audio/m4a,audio/mpeg,audio/webm,audio/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) { setUploadedFile(file); setRecordedBlob(null); }
                        }}
                      />
                      {uploadedFile && (
                        <p className="text-sm text-muted-foreground mt-1">Fichier : {uploadedFile.name}</p>
                      )}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
                  <Button onClick={createAndProcess} disabled={!newTitle || (!recordedBlob && !uploadedFile)}>
                    <Wand2 className="w-4 h-4 mr-2" />Transcrire & Générer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {(transcribing || generating) && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-sm font-medium">
                  {transcribing ? "Transcription de l'audio en cours..." : "Génération du procès-verbal par l'IA..."}
                </span>
              </CardContent>
            </Card>
          )}

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
                        Aucune réunion. Cliquez sur "Nouvelle réunion" pour commencer.
                      </TableCell>
                    </TableRow>
                  ) : (
                    meetings.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.title}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {(m as any).sessions?.title || "—"}
                        </TableCell>
                        <TableCell>{statusBadge(m.pv_status)}</TableCell>
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
