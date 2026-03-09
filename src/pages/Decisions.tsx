import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Gavel, PenTool, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const statutLabels: Record<string, string> = {
  adoptee: "Adoptée",
  rejetee: "Rejetée",
  ajournee: "Ajournée",
};

const statutColors: Record<string, string> = {
  adoptee: "bg-emerald-100 text-emerald-800",
  rejetee: "bg-red-100 text-red-800",
  ajournee: "bg-amber-100 text-amber-800",
};

const voteLabels: Record<string, string> = {
  unanimite: "Unanimité",
  majorite: "Majorité",
  abstention: "Abstention",
};

export default function Decisions() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [decisions, setDecisions] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [signatures, setSignatures] = useState<Record<string, any[]>>({});
  const [signingId, setSigningId] = useState<string | null>(null);
  const [form, setForm] = useState({
    session_id: "",
    texte: "",
    type_vote: "unanimite",
    responsable_execution: "",
    date_effet: "",
    statut: "adoptee",
    vote_pour: 0,
    vote_contre: 0,
    vote_abstention: 0,
  });

  const fetchAll = async () => {
    const [decRes, sessRes, memRes] = await Promise.all([
      supabase.from("decisions").select("*, sessions(title, numero_session), members(full_name)").order("created_at", { ascending: false }),
      supabase.from("sessions").select("id, title, numero_session").order("session_date", { ascending: false }),
      supabase.from("members").select("id, full_name").eq("is_active", true),
    ]);
    setDecisions(decRes.data ?? []);
    setSessions(sessRes.data ?? []);
    setMembers(memRes.data ?? []);

    // Fetch all decision signatures
    const { data: sigs } = await supabase
      .from("signatures")
      .select("*, profiles:signed_by(full_name)")
      .eq("entity_type", "decision")
      .order("signed_at");
    const grouped: Record<string, any[]> = {};
    (sigs ?? []).forEach((s: any) => {
      if (!grouped[s.entity_id]) grouped[s.entity_id] = [];
      grouped[s.entity_id].push(s);
    });
    setSignatures(grouped);
  };

  const signDecision = async (decisionId: string) => {
    setSigningId(decisionId);
    const { error } = await supabase.from("signatures").insert({
      entity_type: "decision",
      entity_id: decisionId,
      signed_by: user?.id,
    });
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Résolution signée" });
      fetchAll();
    }
    setSigningId(null);
  };

  const userSignedDecision = (decisionId: string) =>
    (signatures[decisionId] ?? []).some((s: any) => s.signed_by === user?.id);

  useEffect(() => { fetchAll(); }, []);

  const handleCreate = async () => {
    const { error } = await supabase.from("decisions").insert([{
      session_id: form.session_id,
      texte: form.texte,
      type_vote: form.type_vote,
      responsable_execution: form.responsable_execution || null,
      date_effet: form.date_effet || null,
      statut: form.statut,
      vote_pour: form.vote_pour,
      vote_contre: form.vote_contre,
      vote_abstention: form.vote_abstention,
    }]);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Résolution créée" });
      setOpen(false);
      setForm({ session_id: "", texte: "", type_vote: "unanimite", responsable_execution: "", date_effet: "", statut: "adoptee", vote_pour: 0, vote_contre: 0, vote_abstention: 0 });
      fetchAll();
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
      <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2"><Gavel className="w-5 h-5 sm:w-6 sm:h-6" />Résolutions</h1>
          <p className="text-sm text-muted-foreground">Gestion des résolutions issues des sessions</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nouvelle résolution</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Enregistrer une résolution</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Session</Label>
                <Select value={form.session_id} onValueChange={(v) => setForm({ ...form, session_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {sessions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.numero_session ? `${s.numero_session} — ${s.title}` : s.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Texte de la résolution</Label>
                <Textarea className="min-h-[100px]" value={form.texte} onChange={(e) => setForm({ ...form, texte: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type de vote</Label>
                  <Select value={form.type_vote} onValueChange={(v) => setForm({ ...form, type_vote: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(voteLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Statut</Label>
                  <Select value={form.statut} onValueChange={(v) => setForm({ ...form, statut: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(statutLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Votes Pour</Label>
                  <Input type="number" min={0} value={form.vote_pour} onChange={(e) => setForm({ ...form, vote_pour: +e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Votes Contre</Label>
                  <Input type="number" min={0} value={form.vote_contre} onChange={(e) => setForm({ ...form, vote_contre: +e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Abstentions</Label>
                  <Input type="number" min={0} value={form.vote_abstention} onChange={(e) => setForm({ ...form, vote_abstention: +e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Responsable exécution</Label>
                  <Select value={form.responsable_execution} onValueChange={(v) => setForm({ ...form, responsable_execution: v })}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (<SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date d'effet</Label>
                  <Input type="date" value={form.date_effet} onChange={(e) => setForm({ ...form, date_effet: e.target.value })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={handleCreate} disabled={!form.session_id || !form.texte}>Enregistrer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Object.entries(statutLabels).map(([key, label]) => {
          const count = decisions.filter((d) => d.statut === key).length;
          return (
            <Card key={key}>
              <CardContent className="p-4 flex items-center gap-3">
                <div>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>N° Résolution</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Texte</TableHead>
                <TableHead>Vote</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead>Date effet</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Signature</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {decisions.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Aucune résolution</TableCell></TableRow>
              ) : (
                decisions.map((d) => {
                  const sigs = signatures[d.id] ?? [];
                  const signed = userSignedDecision(d.id);
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-sm font-medium">{d.numero_decision ?? "—"}</TableCell>
                      <TableCell className="text-sm">{(d as any).sessions?.numero_session ?? (d as any).sessions?.title}</TableCell>
                      <TableCell className="max-w-xs truncate text-sm">{d.texte}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{voteLabels[d.type_vote] ?? d.type_vote}</Badge>
                        <span className="text-xs text-muted-foreground ml-1">
                          ({d.vote_pour}/{d.vote_contre}/{d.vote_abstention})
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{(d as any).members?.full_name ?? "—"}</TableCell>
                      <TableCell className="text-sm">{d.date_effet ? new Date(d.date_effet).toLocaleDateString("fr-FR") : "—"}</TableCell>
                      <TableCell>
                        <Badge className={statutColors[d.statut] ?? ""}>{statutLabels[d.statut] ?? d.statut}</Badge>
                      </TableCell>
                      <TableCell>
                        {signed ? (
                          <Badge className="bg-emerald-100 text-emerald-800 gap-1"><CheckCircle2 className="w-3 h-3" />Signé ({sigs.length})</Badge>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => signDecision(d.id)} disabled={signingId === d.id}>
                            <PenTool className="w-3 h-3 mr-1" />{signingId === d.id ? "..." : "Signer"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
