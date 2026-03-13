import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { showSuccess, showError } from "@/lib/toastHelpers";
import { Plus, UserCog, Shield, Ban, CheckCircle2, Pencil, Trash2, Link } from "lucide-react";

export default function UserManagement() {
  
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editProfile, setEditProfile] = useState<any | null>(null);
  const [linkDialog, setLinkDialog] = useState<{ profileId: string; userId: string } | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState("");

  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    role_id: "",
  });

  const fetchData = async () => {
    const [profilesRes, rolesRes, membersRes] = await Promise.all([
      supabase.from("profiles").select("*, roles(nom)").order("created_at", { ascending: false }),
      supabase.from("roles").select("*").order("nom"),
      supabase.from("members").select("id, full_name, user_id, organs(name)").is("user_id", null),
    ]);
    setProfiles(profilesRes.data ?? []);
    setRoles(rolesRes.data ?? []);
    setMembers(membersRes.data ?? []);
  };

  useEffect(() => { fetchData(); }, []);

  // Créer un utilisateur via signup
  const handleCreate = async () => {
    if (!form.email || !form.password || !form.full_name || !form.role_id) {
      showError("Tous les champs sont requis pour créer un utilisateur.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.full_name } },
    });

    if (error) {
      showError(error);
      return;
    }

    // Update the profile with role
    if (data.user) {
      // Small delay for trigger to create profile
      await new Promise((r) => setTimeout(r, 1000));
      await supabase.from("profiles").update({ role_id: form.role_id }).eq("id", data.user.id);

      // Log action
      await supabase.from("audit_log").insert({
        action: "creation_utilisateur",
        entity_type: "profiles",
        entity_id: data.user.id,
        user_id: user?.id,
        details: { email: form.email, full_name: form.full_name },
      });
    }

    toast({ title: "Utilisateur créé", description: "Un email de confirmation a été envoyé." });
    setOpen(false);
    setForm({ email: "", password: "", full_name: "", role_id: "" });
    fetchData();
  };

  // Modifier le rôle
  const handleUpdateRole = async (profileId: string, roleId: string) => {
    const { error } = await supabase.from("profiles").update({ role_id: roleId }).eq("id", profileId);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      await supabase.from("audit_log").insert({
        action: "modification_role",
        entity_type: "profiles",
        entity_id: profileId,
        user_id: user?.id,
        details: { new_role_id: roleId },
      });
      toast({ title: "Rôle mis à jour" });
      fetchData();
    }
  };

  // Activer / Suspendre
  const handleToggleStatus = async (profileId: string, currentStatus: string) => {
    const newStatus = currentStatus === "actif" ? "suspendu" : "actif";
    const { error } = await supabase.from("profiles").update({ statut: newStatus }).eq("id", profileId);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      await supabase.from("audit_log").insert({
        action: newStatus === "suspendu" ? "suspension_utilisateur" : "activation_utilisateur",
        entity_type: "profiles",
        entity_id: profileId,
        user_id: user?.id,
      });
      toast({ title: newStatus === "suspendu" ? "Compte suspendu" : "Compte activé" });
      fetchData();
    }
  };

  // Lier un membre à un utilisateur
  const handleLinkMember = async () => {
    if (!linkDialog || !selectedMemberId) return;
    const { error } = await supabase
      .from("members")
      .update({ user_id: linkDialog.userId } as any)
      .eq("id", selectedMemberId);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      await supabase.from("audit_log").insert({
        action: "liaison_membre_utilisateur",
        entity_type: "members",
        entity_id: selectedMemberId,
        user_id: user?.id,
        details: { linked_user_id: linkDialog.userId },
      });
      toast({ title: "Membre associé avec succès" });
      setLinkDialog(null);
      setSelectedMemberId("");
      fetchData();
    }
  };

  if (!hasPermission("gerer_utilisateurs")) {
    return (
      <div className="p-6 lg:p-8">
        <Card>
          <CardContent className="p-8 text-center">
            <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Accès refusé</h2>
            <p className="text-muted-foreground">Vous n'avez pas la permission de gérer les utilisateurs.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestion des utilisateurs</h1>
          <p className="text-muted-foreground">Créer, modifier et gérer les comptes utilisateurs</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nouvel utilisateur</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Créer un utilisateur</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nom complet</Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Mot de passe</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} />
                <p className="text-xs text-muted-foreground">Minimum 8 caractères</p>
              </div>
              <div className="space-y-2">
                <Label>Rôle</Label>
                <Select value={form.role_id} onValueChange={(v) => setForm({ ...form, role_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un rôle" /></SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={handleCreate}>Créer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Liste des utilisateurs */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date de création</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Aucun utilisateur
                  </TableCell>
                </TableRow>
              ) : (
                profiles.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                          <UserCog className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{p.full_name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{p.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={p.role_id ?? ""}
                        onValueChange={(v) => handleUpdateRole(p.id, v)}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Aucun rôle" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((r) => (
                            <SelectItem key={r.id} value={r.id}>{r.nom}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.statut === "actif" ? "default" : "destructive"}>
                        {p.statut === "actif" ? "Actif" : "Suspendu"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title={p.statut === "actif" ? "Suspendre" : "Activer"}
                          onClick={() => handleToggleStatus(p.id, p.statut)}
                        >
                          {p.statut === "actif" ? (
                            <Ban className="w-4 h-4 text-destructive" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Associer à un membre"
                          onClick={() => setLinkDialog({ profileId: p.id, userId: p.id })}
                        >
                          <Link className="w-4 h-4" />
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

      {/* Rôles et permissions */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Rôles disponibles
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {roles.map((r) => (
              <div key={r.id} className="border rounded-lg p-4">
                <h3 className="font-medium">{r.nom}</h3>
                <p className="text-xs text-muted-foreground mt-1">{r.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dialog pour lier membre */}
      <Dialog open={!!linkDialog} onOpenChange={(v) => !v && setLinkDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Associer un membre</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Associez un membre d'organe à ce compte utilisateur.
            </p>
            <div className="space-y-2">
              <Label>Membre (sans compte associé)</Label>
              <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un membre" /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.full_name} ({(m as any).organs?.name ?? "—"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialog(null)}>Annuler</Button>
            <Button onClick={handleLinkMember} disabled={!selectedMemberId}>Associer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
