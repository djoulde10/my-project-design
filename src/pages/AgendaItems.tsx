import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AgendaItems() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    session_id: "", title: "", description: "", presenter_member_id: "",
    nature: "information" as "information" | "decision", order_index: 0,
  });

  const fetchAll = async () => {
    const [itemsRes, sessionsRes, membersRes] = await Promise.all([
      supabase.from("agenda_items").select("*, sessions(title), members(full_name)").order("order_index"),
      supabase.from("sessions").select("id, title").in("status", ["brouillon", "validee"]).order("session_date", { ascending: false }),
      supabase.from("members").select("id, full_name").eq("is_active", true),
    ]);
    setItems(itemsRes.data ?? []);
    setSessions(sessionsRes.data ?? []);
    setMembers(membersRes.data ?? []);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleCreate = async () => {
    const { error } = await supabase.from("agenda_items").insert([{
      ...form,
      presenter_member_id: form.presenter_member_id || null,
    }]);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Point d'ODJ ajouté" });
      setOpen(false);
      fetchAll();
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ordre du jour</h1>
          <p className="text-muted-foreground">Points d'ordre du jour des sessions</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nouveau point</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Ajouter un point d'ODJ</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Session</Label>
                <Select value={form.session_id} onValueChange={(v) => setForm({ ...form, session_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {sessions.map((s) => (<SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Titre</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nature</Label>
                  <Select value={form.nature} onValueChange={(v) => setForm({ ...form, nature: v as "information" | "decision" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="information">Information</SelectItem>
                      <SelectItem value="decision">Décision</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Présentateur</Label>
                  <Select value={form.presenter_member_id} onValueChange={(v) => setForm({ ...form, presenter_member_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Optionnel" /></SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (<SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={handleCreate} disabled={!form.session_id || !form.title}>Ajouter</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Titre</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Nature</TableHead>
                <TableHead>Présentateur</TableHead>
                <TableHead>Validation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucun point d'ODJ</TableCell></TableRow>
              ) : (
                items.map((item, i) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{item.title}</TableCell>
                    <TableCell className="text-sm">{(item as any).sessions?.title}</TableCell>
                    <TableCell>
                      <Badge variant={item.nature === "decision" ? "default" : "secondary"}>
                        {item.nature === "decision" ? "Décision" : "Information"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{(item as any).members?.full_name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={item.validated_by_president ? "default" : "outline"}>
                        {item.validated_by_president ? "Validé" : "En attente"}
                      </Badge>
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
