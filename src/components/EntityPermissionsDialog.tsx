import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useEntityPermissions, EntityType } from "@/hooks/useEntityPermission";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Shield, Trash2, UserPlus, Eye, Pencil, MessageSquare } from "lucide-react";
import { showSuccess, showError } from "@/lib/toastHelpers";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: EntityType;
  entityId: string;
  entityName?: string;
}

const entityTypeLabels: Record<EntityType, string> = {
  document: "Document",
  minute: "Procès-verbal",
  session: "Session",
  decision: "Décision",
  meeting: "Réunion",
};

export default function EntityPermissionsDialog({ open, onOpenChange, entityType, entityId, entityName }: Props) {
  const { user } = useAuth();
  const companyId = useCompanyId();
  const { permissions, loading, refetch } = useEntityPermissions(entityType, entityId);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase.from("profiles").select("id, full_name").eq("statut", "actif").then(({ data }) => {
      setProfiles(data ?? []);
    });
  }, [open]);

  const existingUserIds = permissions.map((p: any) => p.user_id);
  const availableProfiles = profiles.filter((p) => !existingUserIds.includes(p.id) && p.id !== user?.id);

  const handleAddUser = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    const { error } = await supabase.from("entity_permissions").insert({
      entity_type: entityType,
      entity_id: entityId,
      user_id: selectedUserId,
      can_view: true,
      can_edit: false,
      can_delete: false,
      can_comment: true,
      granted_by: user?.id,
      company_id: companyId,
    } as any);
    if (error) showError(error, "Impossible d'ajouter la permission");
    else { showSuccess("permission_added"); setSelectedUserId(""); refetch(); }
    setSaving(false);
  };

  const handleToggle = async (permId: string, field: string, value: boolean) => {
    const { error } = await supabase
      .from("entity_permissions")
      .update({ [field]: value } as any)
      .eq("id", permId);
    if (error) showError(error, "Erreur de mise à jour");
    else refetch();
  };

  const handleRemove = async (permId: string) => {
    const { error } = await supabase.from("entity_permissions").delete().eq("id", permId);
    if (error) showError(error, "Erreur de suppression");
    else refetch();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Permissions — {entityTypeLabels[entityType]}
          </DialogTitle>
          {entityName && <p className="text-sm text-muted-foreground">{entityName}</p>}
        </DialogHeader>

        <div className="space-y-4">
          {/* Add user */}
          <div className="flex gap-2">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Sélectionner un utilisateur..." />
              </SelectTrigger>
              <SelectContent>
                {availableProfiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name || "Sans nom"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAddUser} disabled={!selectedUserId || saving} size="sm">
              <UserPlus className="w-4 h-4 mr-1" /> Ajouter
            </Button>
          </div>

          {/* Info badge */}
          <Badge variant="outline" className="text-xs">
            Les utilisateurs sans permission spécifique héritent de leur rôle
          </Badge>

          {/* Permissions table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead className="text-center w-20">
                    <div className="flex flex-col items-center gap-0.5">
                      <Eye className="w-3.5 h-3.5" /><span className="text-[10px]">Voir</span>
                    </div>
                  </TableHead>
                  <TableHead className="text-center w-20">
                    <div className="flex flex-col items-center gap-0.5">
                      <Pencil className="w-3.5 h-3.5" /><span className="text-[10px]">Modifier</span>
                    </div>
                  </TableHead>
                  <TableHead className="text-center w-20">
                    <div className="flex flex-col items-center gap-0.5">
                      <Trash2 className="w-3.5 h-3.5" /><span className="text-[10px]">Supprimer</span>
                    </div>
                  </TableHead>
                  <TableHead className="text-center w-20">
                    <div className="flex flex-col items-center gap-0.5">
                      <MessageSquare className="w-3.5 h-3.5" /><span className="text-[10px]">Commenter</span>
                    </div>
                  </TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Chargement...</TableCell></TableRow>
                ) : permissions.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Aucune permission spécifique. Les droits du rôle s'appliquent.</TableCell></TableRow>
                ) : (
                  permissions.map((perm: any) => (
                    <TableRow key={perm.id}>
                      <TableCell className="font-medium text-sm">
                        {(perm as any).profiles?.full_name || "Utilisateur"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch checked={perm.can_view} onCheckedChange={(v) => handleToggle(perm.id, "can_view", v)} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch checked={perm.can_edit} onCheckedChange={(v) => handleToggle(perm.id, "can_edit", v)} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch checked={perm.can_delete} onCheckedChange={(v) => handleToggle(perm.id, "can_delete", v)} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch checked={perm.can_comment} onCheckedChange={(v) => handleToggle(perm.id, "can_comment", v)} />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleRemove(perm.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
