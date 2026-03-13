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
import { Plus, ShieldAlert, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { showSuccess, showError } from "@/lib/toastHelpers";

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  active: { label: "Actif", color: "bg-amber-100 text-amber-800", icon: AlertTriangle },
  resolved: { label: "Résolu", color: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
  waived: { label: "Levé", color: "bg-muted text-muted-foreground", icon: XCircle },
};

export default function ConflictOfInterest() {
  
  const { user } = useAuth();
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    member_id: "",
    subject: "",
    description: "",
  });

  const fetchAll = async () => {
    const [confRes, memRes] = await Promise.all([
      supabase.from("conflict_of_interests").select("*, members(full_name)").order("declared_at", { ascending: false }),
      supabase.from("members").select("id, full_name").eq("is_active", true),
    ]);
    setConflicts(confRes.data ?? []);
    setMembers(memRes.data ?? []);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleCreate = async () => {
    const { error } = await supabase.from("conflict_of_interests").insert([{
      member_id: form.member_id,
      subject: form.subject,
      description: form.description || null,
    }]);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Conflit d'intérêt déclaré" });
      setOpen(false);
      setForm({ member_id: "", subject: "", description: "" });
      fetchAll();
    }
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("conflict_of_interests").update({
      status,
      resolved_at: status !== "active" ? new Date().toISOString() : null,
    }).eq("id", id);
    fetchAll();
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6" />
            Conflits d'intérêts
          </h1>
          <p className="text-sm text-muted-foreground">Déclaration et gestion des conflits d'intérêts des membres</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nouvelle déclaration</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Déclarer un conflit d'intérêt</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Membre concerné</Label>
                <Select value={form.member_id} onValueChange={(v) => setForm({ ...form, member_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un membre" /></SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (<SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sujet du conflit</Label>
                <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Ex: Intérêt financier dans la société XYZ" />
              </div>
              <div className="space-y-2">
                <Label>Description détaillée</Label>
                <Textarea className="min-h-[100px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Décrivez la nature du conflit d'intérêt..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={handleCreate} disabled={!form.member_id || !form.subject}>Déclarer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Object.entries(statusConfig).map(([key, cfg]) => {
          const count = conflicts.filter((c) => c.status === key).length;
          return (
            <Card key={key}>
              <CardContent className="p-4 flex items-center gap-3">
                <cfg.icon className="w-5 h-5" />
                <div>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground">{cfg.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow>
                <TableHead>Membre</TableHead>
                <TableHead>Sujet</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Date déclaration</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conflicts.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucun conflit d'intérêt déclaré</TableCell></TableRow>
              ) : (
                conflicts.map((c) => {
                  const cfg = statusConfig[c.status] ?? statusConfig.active;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium text-sm">{(c as any).members?.full_name ?? "—"}</TableCell>
                      <TableCell className="text-sm">{c.subject}</TableCell>
                      <TableCell className="text-sm max-w-xs truncate">{c.description ?? "—"}</TableCell>
                      <TableCell className="text-sm">{new Date(c.declared_at).toLocaleDateString("fr-FR")}</TableCell>
                      <TableCell><Badge className={cfg.color}>{cfg.label}</Badge></TableCell>
                      <TableCell>
                        {c.status === "active" && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => updateStatus(c.id, "resolved")}>
                              <CheckCircle2 className="w-3 h-3 mr-1" />Résoudre
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => updateStatus(c.id, "waived")}>
                              Lever
                            </Button>
                          </div>
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
