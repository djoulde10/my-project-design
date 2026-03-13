import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Brain, CheckCircle2, XCircle, Edit, Loader2, ListChecks, Vote,
  CalendarPlus, FileText, AlertTriangle, Sparkles
} from "lucide-react";
import { showSuccess, showError } from "@/lib/toastHelpers";
import { useAuth } from "@/lib/auth";
import { useCompanyId } from "@/hooks/useCompanyId";

interface SuggestedDecision {
  text: string;
  vote_type?: string;
  vote_pour?: number;
  vote_contre?: number;
  vote_abstention?: number;
}

interface SuggestedAction {
  title: string;
  description?: string;
  responsible?: string;
  due_date?: string;
}

interface SuggestedAgendaItem {
  title: string;
  reason: string;
}

interface AIAnalysis {
  summary: string;
  decisions: SuggestedDecision[];
  actions: SuggestedAction[];
  next_agenda: SuggestedAgendaItem[];
}

interface MeetingAIAnalysisProps {
  minuteId: string;
  sessionId: string;
  pvContent: string;
  members: { id: string; full_name: string }[];
  onDecisionCreated?: () => void;
  onActionCreated?: () => void;
}

export default function MeetingAIAnalysis({ minuteId, sessionId, pvContent, members, onDecisionCreated, onActionCreated }: MeetingAIAnalysisProps) {
  
  const { user } = useAuth();
  const companyId = useCompanyId();
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track accepted/rejected items
  const [decisionStatuses, setDecisionStatuses] = useState<Record<number, "accepted" | "rejected" | "pending">>({});
  const [actionStatuses, setActionStatuses] = useState<Record<number, "accepted" | "rejected" | "pending">>({});

  // Edit dialogs
  const [editDecision, setEditDecision] = useState<{ index: number; data: SuggestedDecision } | null>(null);
  const [editAction, setEditAction] = useState<{ index: number; data: SuggestedAction } | null>(null);
  const [editActionMemberId, setEditActionMemberId] = useState("");

  const runAnalysis = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("analyze-meeting", {
        body: { minuteId, pvContent, sessionId },
      });
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      
      const result = data.analysis as AIAnalysis;
      setAnalysis(result);

      // Init statuses
      const dStatuses: Record<number, "pending"> = {};
      result.decisions.forEach((_, i) => { dStatuses[i] = "pending"; });
      setDecisionStatuses(dStatuses);
      const aStatuses: Record<number, "pending"> = {};
      result.actions.forEach((_, i) => { aStatuses[i] = "pending"; });
      setActionStatuses(aStatuses);

      // Save analysis to DB
      await supabase.from("meeting_ai_analysis" as any).upsert({
        minute_id: minuteId,
        company_id: companyId,
        summary: result.summary,
        suggested_decisions: result.decisions,
        suggested_actions: result.actions,
        suggested_agenda: result.next_agenda,
        status: "pending",
        created_by: user?.id,
      } as any, { onConflict: "minute_id" });

      showSuccess("ai_analysis_complete");
    } catch (e: any) {
      setError(e.message);
      showError(e);
    } finally {
      setAnalyzing(false);
    }
  };

  const acceptDecision = async (index: number, decision: SuggestedDecision) => {
    try {
      const { error } = await supabase.from("decisions").insert({
        session_id: sessionId,
        texte: decision.text,
        type_vote: decision.vote_type || "unanimite",
        vote_pour: decision.vote_pour || 0,
        vote_contre: decision.vote_contre || 0,
        vote_abstention: decision.vote_abstention || 0,
        statut: "adoptee",
      });
      if (error) throw error;
      setDecisionStatuses(prev => ({ ...prev, [index]: "accepted" }));
      showSuccess("decision_created");
      onDecisionCreated?.();
    } catch (e: any) {
      showError(e);
    }
  };

  const acceptAction = async (index: number, action: SuggestedAction, memberId?: string) => {
    try {
      const { error } = await supabase.from("actions").insert({
        title: action.title,
        description: action.description || "",
        responsible_member_id: memberId || null,
        due_date: action.due_date || null,
        status: "en_cours",
      });
      if (error) throw error;
      setActionStatuses(prev => ({ ...prev, [index]: "accepted" }));
      toast({ title: "Action enregistrée" });
      onActionCreated?.();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  };

  if (!analysis && !analyzing) {
    return (
      <Card className="border-primary/20">
        <CardContent className="p-6 text-center space-y-4">
          <Brain className="w-12 h-12 mx-auto text-primary opacity-60" />
          <div>
            <h3 className="font-semibold text-lg">Analyse IA du procès-verbal</h3>
            <p className="text-sm text-muted-foreground mt-1">
              L'IA analysera le contenu pour extraire les résolutions, actions, un résumé exécutif et des suggestions pour la prochaine réunion.
            </p>
          </div>
          <Button onClick={runAnalysis} className="gap-2">
            <Sparkles className="w-4 h-4" />
            Lancer l'analyse IA
          </Button>
          {error && (
            <p className="text-sm text-destructive flex items-center gap-1 justify-center">
              <AlertTriangle className="w-4 h-4" />{error}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (analyzing) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-6 flex items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <div>
            <p className="font-medium">Analyse en cours...</p>
            <p className="text-sm text-muted-foreground">L'IA examine le procès-verbal pour en extraire les informations clés.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) return null;

  const voteTypeLabels: Record<string, string> = { unanimite: "Unanimité", majorite: "Majorité", autre: "Autre" };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Analyse IA</h2>
          <Badge variant="secondary" className="gap-1"><Sparkles className="w-3 h-3" />Suggestions</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={runAnalysis} disabled={analyzing}>
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
          Relancer
        </Button>
      </div>

      <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30">
        <CardContent className="p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Les éléments ci-dessous sont des <strong>suggestions générées par l'IA</strong>. Veuillez les examiner attentivement avant de les valider. Rien n'est enregistré automatiquement.
          </p>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Résumé exécutif
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[200px]">
            <div className="text-sm whitespace-pre-wrap leading-relaxed">{analysis.summary}</div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Decisions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Vote className="w-4 h-4" />
            Résolutions suggérées
            <Badge variant="outline">{analysis.decisions.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {analysis.decisions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune résolution identifiée dans ce procès-verbal.</p>
          ) : (
            analysis.decisions.map((d, i) => {
              const status = decisionStatuses[i] || "pending";
              return (
                <div key={i} className={`p-3 rounded-lg border ${status === "accepted" ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800" : status === "rejected" ? "bg-muted/50 border-muted opacity-60" : "bg-background"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium">{d.text}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {d.vote_type && <Badge variant="secondary" className="text-xs">{voteTypeLabels[d.vote_type] || d.vote_type}</Badge>}
                        {(d.vote_pour !== undefined && d.vote_pour > 0) && <span>Pour: {d.vote_pour}</span>}
                        {(d.vote_contre !== undefined && d.vote_contre > 0) && <span>Contre: {d.vote_contre}</span>}
                        {(d.vote_abstention !== undefined && d.vote_abstention > 0) && <span>Abst.: {d.vote_abstention}</span>}
                      </div>
                    </div>
                    {status === "pending" && (
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => setEditDecision({ index: i, data: { ...d } })}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-emerald-600 hover:text-emerald-700" onClick={() => acceptDecision(i, d)}>
                          <CheckCircle2 className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDecisionStatuses(prev => ({ ...prev, [i]: "rejected" }))}>
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                    {status === "accepted" && <Badge className="bg-emerald-100 text-emerald-800 shrink-0">✓ Validée</Badge>}
                    {status === "rejected" && <Badge variant="secondary" className="shrink-0">Rejetée</Badge>}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ListChecks className="w-4 h-4" />
            Actions suggérées
            <Badge variant="outline">{analysis.actions.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {analysis.actions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune action identifiée dans ce procès-verbal.</p>
          ) : (
            analysis.actions.map((a, i) => {
              const status = actionStatuses[i] || "pending";
              return (
                <div key={i} className={`p-3 rounded-lg border ${status === "accepted" ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800" : status === "rejected" ? "bg-muted/50 border-muted opacity-60" : "bg-background"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium">{a.title}</p>
                      {a.description && <p className="text-xs text-muted-foreground">{a.description}</p>}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {a.responsible && <span>👤 {a.responsible}</span>}
                        {a.due_date && <span>📅 {a.due_date}</span>}
                      </div>
                    </div>
                    {status === "pending" && (
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => { setEditAction({ index: i, data: { ...a } }); setEditActionMemberId(""); }}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-emerald-600 hover:text-emerald-700" onClick={() => acceptAction(i, a)}>
                          <CheckCircle2 className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setActionStatuses(prev => ({ ...prev, [i]: "rejected" }))}>
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                    {status === "accepted" && <Badge className="bg-emerald-100 text-emerald-800 shrink-0">✓ Validée</Badge>}
                    {status === "rejected" && <Badge variant="secondary" className="shrink-0">Rejetée</Badge>}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Next Agenda Suggestions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarPlus className="w-4 h-4" />
            Suggestions pour la prochaine réunion
            <Badge variant="outline">{analysis.next_agenda.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {analysis.next_agenda.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune suggestion pour la prochaine réunion.</p>
          ) : (
            analysis.next_agenda.map((item, i) => (
              <div key={i} className="p-3 rounded-lg border bg-background">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.reason}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Edit Decision Dialog */}
      <Dialog open={!!editDecision} onOpenChange={(open) => !open && setEditDecision(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier la résolution</DialogTitle></DialogHeader>
          {editDecision && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Texte de la résolution</label>
                <Textarea
                  value={editDecision.data.text}
                  onChange={(e) => setEditDecision({ ...editDecision, data: { ...editDecision.data, text: e.target.value } })}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Type de vote</label>
                  <Select value={editDecision.data.vote_type || "unanimite"} onValueChange={(v) => setEditDecision({ ...editDecision, data: { ...editDecision.data, vote_type: v } })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unanimite">Unanimité</SelectItem>
                      <SelectItem value="majorite">Majorité</SelectItem>
                      <SelectItem value="autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Votes pour</label>
                  <Input type="number" value={editDecision.data.vote_pour || 0} onChange={(e) => setEditDecision({ ...editDecision, data: { ...editDecision.data, vote_pour: parseInt(e.target.value) || 0 } })} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDecision(null)}>Annuler</Button>
            <Button onClick={() => {
              if (editDecision) {
                acceptDecision(editDecision.index, editDecision.data);
                setEditDecision(null);
              }
            }}>Valider et enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Action Dialog */}
      <Dialog open={!!editAction} onOpenChange={(open) => !open && setEditAction(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier l'action</DialogTitle></DialogHeader>
          {editAction && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Titre</label>
                <Input value={editAction.data.title} onChange={(e) => setEditAction({ ...editAction, data: { ...editAction.data, title: e.target.value } })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={editAction.data.description || ""}
                  onChange={(e) => setEditAction({ ...editAction, data: { ...editAction.data, description: e.target.value } })}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Responsable</label>
                <Select value={editActionMemberId} onValueChange={setEditActionMemberId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un membre" /></SelectTrigger>
                  <SelectContent>
                    {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {editAction.data.responsible && !editActionMemberId && (
                  <p className="text-xs text-muted-foreground">Suggéré par l'IA : {editAction.data.responsible}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Date limite</label>
                <Input type="date" value={editAction.data.due_date || ""} onChange={(e) => setEditAction({ ...editAction, data: { ...editAction.data, due_date: e.target.value } })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAction(null)}>Annuler</Button>
            <Button onClick={() => {
              if (editAction) {
                acceptAction(editAction.index, editAction.data, editActionMemberId || undefined);
                setEditAction(null);
              }
            }}>Valider et enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
