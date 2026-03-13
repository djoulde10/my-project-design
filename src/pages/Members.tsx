import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, User, Pencil, Eye, Search } from "lucide-react";
import { showSuccess, showError } from "@/lib/toastHelpers";

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
  titre_poste: "", organisation: "", bio: "", linkedin_url: "", adresse: "", date_naissance: "", nationalite: "",
};

export default function Members() {
  
  const navigate = useNavigate();
  const [members, setMembers] = useState<any[]>([]);
  const [organs, setOrgans] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [searchText, setSearchText] = useState("");
  const [filterOrgan, setFilterOrgan] = useState("all");

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
      titre_poste: m.titre_poste ?? "",
      organisation: m.organisation ?? "",
      bio: m.bio ?? "",
      linkedin_url: m.linkedin_url ?? "",
      adresse: m.adresse ?? "",
      date_naissance: m.date_naissance ?? "",
      nationalite: m.nationalite ?? "",
    });
    setOpen(true);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Membres</h1>
          <p className="text-sm text-muted-foreground">Gestion des membres des organes</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(emptyForm); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nouveau membre</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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

              <Separator className="my-2" />
              <p className="text-sm font-medium text-muted-foreground">Informations complémentaires</p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Titre / Poste</Label>
                  <Input value={form.titre_poste} onChange={(e) => setForm({ ...form, titre_poste: e.target.value })} placeholder="Directeur Général..." />
                </div>
                <div className="space-y-2">
                  <Label>Organisation</Label>
                  <Input value={form.organisation} onChange={(e) => setForm({ ...form, organisation: e.target.value })} placeholder="Entreprise..." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date de naissance</Label>
                  <Input type="date" value={form.date_naissance} onChange={(e) => setForm({ ...form, date_naissance: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Nationalité</Label>
                  <Input value={form.nationalite} onChange={(e) => setForm({ ...form, nationalite: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Adresse</Label>
                <Input value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>LinkedIn</Label>
                <Input value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} placeholder="https://linkedin.com/in/..." />
              </div>
              <div className="space-y-2">
                <Label>Biographie</Label>
                <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Parcours professionnel..." className="min-h-[80px]" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setOpen(false); setEditingId(null); setForm(emptyForm); }}>Annuler</Button>
              <Button onClick={handleSave} disabled={!form.organ_id || !form.full_name || !form.mandate_start}>{editingId ? "Enregistrer" : "Ajouter"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Rechercher un membre..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
        </div>
        <Select value={filterOrgan} onValueChange={setFilterOrgan}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Tous les organes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les organes</SelectItem>
            {organs.map((o) => (<SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[700px]">
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
              {(() => {
                const filtered = members.filter((m) => {
                  if (searchText && !m.full_name?.toLowerCase().includes(searchText.toLowerCase())) return false;
                  if (filterOrgan !== "all" && m.organ_id !== filterOrgan) return false;
                  return true;
                });
                if (filtered.length === 0) return (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucun membre</TableCell></TableRow>
                );
                return filtered.map((m) => (
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
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/members/${m.id}`)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ));
              })()}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
