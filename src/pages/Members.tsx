import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, User, Pencil, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const qualityLabels: Record<string, string> = {
  pca: "PCA",
  administrateur: "Administrateur",
  president_comite: "Président du Comité",
  secretariat_juridique: "Secrétariat juridique",
  autre: "Autre",
};

const qualityOptions = ["pca", "administrateur", "president_comite", "secretariat_juridique", "autre"] as const;

const emptyForm = {
  organ_id: "", full_name: "", quality: "autre" as "pca" | "administrateur" | "president_comite" | "secretariat_juridique" | "autre",
  mandate_start: "", mandate_end: "", email: "", phone: "",
};

export default function Members() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [members, setMembers] = useState<any[]>([]);
  const [organs, setOrgans] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchMembers = async () => {
    const { data } = await supabase.from("members").select("*, organs(name)").order("full_name");
    setMembers(data ?? []);
  };

  const fetchOrgans = async () => {
    const { data } = await supabase.from("organs").select("*");
    setOrgans(data ?? []);
  };

  useEffect(() => { fetchMembers(); fetchOrgans(); }, []);

  const parseErrorMessage = (msg: string): string => {
    if (msg.includes("Limite atteinte")) {
      // Extract the readable part from the DB trigger error
      const match = msg.match(/Limite atteinte[^"]*/);
      return match ? match[0] : "Cette fonction est déjà occupée dans cet organe pour cette période de mandat.";
    }
    return msg;
  };

  const handleSave = async () => {
    const payload = {
      ...form,
      mandate_end: form.mandate_end || null,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from("members").update(payload).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("members").insert([payload]));
    }

    if (error) {
      toast({ title: "Erreur", description: parseErrorMessage(error.message), variant: "destructive" });
    } else {
      toast({ title: editingId ? "Membre modifié" : "Membre ajouté" });
      setOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      fetchMembers();
    }
  };

  const openEdit = (m: any) => {
    setEditingId(m.id);
    setForm({
      organ_id: m.organ_id,
      full_name: m.full_name,
      quality: m.quality,
      mandate_start: m.mandate_start ?? "",
      mandate_end: m.mandate_end ?? "",
      email: m.email ?? "",
      phone: m.phone ?? "",
    });
    setOpen(true);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Membres</h1>
          <p className="text-muted-foreground">Gestion des membres des organes</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(emptyForm); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nouveau membre</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? "Modifier le membre" : "Ajouter un membre"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Organe</Label>
                <Select value={form.organ_id} onValueChange={(v) => setForm({ ...form, organ_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {organs.map((o) => (<SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nom complet</Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Qualité</Label>
                <Select value={form.quality} onValueChange={(v) => setForm({ ...form, quality: v as typeof form.quality })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {qualityOptions.map((k) => (
                      <SelectItem key={k} value={k}>{qualityLabels[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Début mandat</Label>
                  <Input type="date" value={form.mandate_start} onChange={(e) => setForm({ ...form, mandate_start: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Fin mandat</Label>
                  <Input type="date" value={form.mandate_end} onChange={(e) => setForm({ ...form, mandate_end: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setOpen(false); setEditingId(null); setForm(emptyForm); }}>Annuler</Button>
              <Button onClick={handleSave} disabled={!form.organ_id || !form.full_name || !form.mandate_start}>{editingId ? "Enregistrer" : "Ajouter"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Organe</TableHead>
                <TableHead>Qualité</TableHead>
                <TableHead>Mandat</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucun membre</TableCell></TableRow>
              ) : (
                members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        {m.full_name}
                      </div>
                    </TableCell>
                    <TableCell>{(m as any).organs?.name}</TableCell>
                    <TableCell><Badge variant="outline">{qualityLabels[m.quality] ?? m.quality}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(m.mandate_start).toLocaleDateString("fr-FR")}
                      {m.mandate_end ? ` — ${new Date(m.mandate_end).toLocaleDateString("fr-FR")}` : " — En cours"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.is_active ? "default" : "secondary"}>
                        {m.is_active ? "Actif" : "Inactif"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                        <Pencil className="w-4 h-4" />
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
