import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, User, Pencil, Eye } from "lucide-react";
import { showSuccess, showError } from "@/lib/toastHelpers";
import { usePermissions } from "@/hooks/usePermissions";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { fetchMembersPageData, membersPageQueryKey } from "@/lib/pagePrefetch";


const qualityLabels: Record<string, string> = {
  pca: "PCA",
  president_comite_audit: "Président du Comité d'Audit",
  membre: "Membre",
  secretariat_juridique: "Secrétariat juridique",
  membre_direction: "Membre de la Direction",
  autre: "Autre",
};

const qualityOptions = ["pca", "president_comite_audit", "membre", "secretariat_juridique", "membre_direction", "autre"] as const;

const emptyForm = {
  organ_id: "", full_name: "", quality: "autre" as "pca" | "president_comite_audit" | "membre" | "secretariat_juridique" | "membre_direction" | "autre",
  mandate_start: "", mandate_end: "", email: "", phone: "",
  titre_poste: "", organisation: "", bio: "", linkedin_url: "", adresse: "", date_naissance: "", nationalite: "",
};

export default function Members() {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const canManageMembers = hasPermission("gerer_membres");
  const navigate = useNavigate();
  const { data: pageData } = useSuspenseQuery({
    queryKey: membersPageQueryKey,
    queryFn: fetchMembersPageData,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });
  const members = pageData.members;
  const organs = pageData.organs;
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [searchText, setSearchText] = useState("");
  const [filterOrgan, setFilterOrgan] = useState("all");

  const refreshMembers = () => {
    queryClient.invalidateQueries({ queryKey: membersPageQueryKey, refetchType: "active" });
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
      showError(error, editingId ? "Impossible de modifier le membre" : "Impossible d'ajouter le membre");
    } else {
      showSuccess(editingId ? "member_updated" : "member_created");
      setOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      refreshMembers();
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
            {canManageMembers && <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Nouveau membre</Button>
            </DialogTrigger>}
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

      <MembersTable
        members={members}
        organs={organs}
        canManage={canManageMembers}
        onView={(id) => navigate(`/members/${id}`)}
        onEdit={openEdit}
      />
    </div>
  );
}

function MembersTable({
  members,
  organs,
  canManage,
  onView,
  onEdit,
}: {
  members: any[];
  organs: any[];
  canManage: boolean;
  onView: (id: string) => void;
  onEdit: (m: any) => void;
}) {
  const columns: DataTableColumn<any>[] = useMemo(
    () => [
      {
        key: "full_name",
        label: "Nom",
        accessor: (m) => m.full_name,
        alwaysVisible: true,
        render: (m) => (
          <div className="flex items-center gap-2 font-medium">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-primary" />
            </div>
            <span className="truncate">{m.full_name}</span>
          </div>
        ),
      },
      { key: "organ", label: "Organe", accessor: (m) => m.organs?.name ?? "" },
      {
        key: "quality",
        label: "Qualité",
        accessor: (m) => qualityLabels[m.quality] ?? m.quality,
        render: (m) => <Badge variant="outline">{qualityLabels[m.quality] ?? m.quality}</Badge>,
      },
      {
        key: "mandate",
        label: "Mandat",
        accessor: (m) => m.mandate_start ?? "",
        render: (m) => (
          <span className="text-sm text-muted-foreground">
            {m.mandate_start ? new Date(m.mandate_start).toLocaleDateString("fr-FR") : "—"}
            {m.mandate_end ? ` — ${new Date(m.mandate_end).toLocaleDateString("fr-FR")}` : " — En cours"}
          </span>
        ),
      },
      {
        key: "status",
        label: "Statut",
        accessor: (m) => (m.is_active ? "Actif" : "Inactif"),
        render: (m) => (
          <Badge variant={m.is_active ? "default" : "secondary"}>{m.is_active ? "Actif" : "Inactif"}</Badge>
        ),
      },
      { key: "email", label: "Email", accessor: (m) => m.email ?? "", hiddenByDefault: true },
      { key: "phone", label: "Téléphone", accessor: (m) => m.phone ?? "", hiddenByDefault: true },
      {
        key: "actions",
        label: "Actions",
        sortable: false,
        width: "w-24",
        render: (m) => (
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" onClick={() => onView(m.id)} aria-label="Voir">
              <Eye className="w-4 h-4" />
            </Button>
            {canManage && (
              <Button variant="ghost" size="icon" onClick={() => onEdit(m)} aria-label="Modifier">
                <Pencil className="w-4 h-4" />
              </Button>
            )}
          </div>
        ),
      },
    ],
    [canManage, onView, onEdit],
  );

  const filters = useMemo(
    () => [
      {
        key: "organ",
        label: "Organe",
        options: organs.map((o) => ({ value: o.id, label: o.name })),
        predicate: (row: any, value: string) => row.organ_id === value,
      },
      {
        key: "status",
        label: "Statut",
        options: [
          { value: "active", label: "Actif" },
          { value: "inactive", label: "Inactif" },
        ],
        predicate: (row: any, value: string) => (value === "active" ? row.is_active : !row.is_active),
      },
      {
        key: "quality",
        label: "Qualité",
        options: qualityOptions.map((q) => ({ value: q, label: qualityLabels[q] })),
        predicate: (row: any, value: string) => row.quality === value,
      },
    ],
    [organs],
  );

  return (
    <DataTable
      storageKey="members"
      data={members}
      columns={columns}
      filters={filters}
      rowKey={(m) => m.id}
      onRowClick={(m) => onView(m.id)}
      searchPlaceholder="Rechercher un membre…"
      searchableFields={[(m) => m.email, (m) => m.phone, (m) => m.organisation, (m) => m.titre_poste]}
      emptyMessage="Aucun membre trouvé"
    />
  );
}
