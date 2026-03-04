import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const pvStatusLabels: Record<string, string> = {
  en_attente: "En attente",
  vote: "Voté",
  adopte: "Adopté",
  adopte_et_signe: "Adopté et signé",
};

const pvStatusColors: Record<string, string> = {
  en_attente: "bg-muted text-muted-foreground",
  vote: "bg-amber-100 text-amber-800",
  adopte: "bg-primary/10 text-primary",
  adopte_et_signe: "bg-emerald-100 text-emerald-800",
};

export default function Minutes() {
  const { toast } = useToast();
  const [minutes, setMinutes] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [pvOpen, setPvOpen] = useState(false);
  const [pvForm, setPvForm] = useState({ session_id: "", content: "", pv_status: "en_attente" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState("");

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
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else { toast({ title: "PV créé" }); setPvOpen(false); setPvForm({ session_id: "", content: "", pv_status: "en_attente" }); fetchAll(); }
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("minutes").update({ pv_status: status }).eq("id", id);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else { toast({ title: "Statut mis à jour" }); setEditingId(null); fetchAll(); }
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
                <Textarea className="min-h-[200px]" value={pvForm.content} onChange={(e) => setPvForm({ ...pvForm, content: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Statut</Label>
                <Select value={pvForm.pv_status} onValueChange={(v) => setPvForm({ ...pvForm, pv_status: v })}>
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
                        <Select value={editStatus} onValueChange={(v) => { setEditStatus(v); updateStatus(m.id, v); }}>
                          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(pvStatusLabels).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={pvStatusColors[m.pv_status] ?? "bg-muted text-muted-foreground"}>
                          {pvStatusLabels[m.pv_status] ?? m.pv_status ?? "En attente"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(m.created_at).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => { setEditingId(m.id); setEditStatus(m.pv_status ?? "en_attente"); }}>
                        Modifier statut
                      </Button>
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
