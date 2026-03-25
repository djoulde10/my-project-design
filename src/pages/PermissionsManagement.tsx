import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Search, Eye, Pencil, Trash2, MessageSquare, Check, X } from "lucide-react";
import EntityPermissionsDialog from "@/components/EntityPermissionsDialog";
import { EntityType } from "@/hooks/useEntityPermission";

const entityTypeLabels: Record<string, string> = {
  document: "Document",
  minute: "Procès-verbal",
  session: "Session",
  decision: "Décision",
  meeting: "Réunion",
};

export default function PermissionsManagement() {
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [editTarget, setEditTarget] = useState<{ entityType: EntityType; entityId: string; name: string } | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("entity_permissions")
      .select("*, profiles:user_id(full_name)")
      .order("created_at", { ascending: false });
    setPermissions(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = permissions.filter((p) => {
    if (filterType !== "all" && p.entity_type !== filterType) return false;
    if (search) {
      const name = (p as any).profiles?.full_name?.toLowerCase() || "";
      return name.includes(search.toLowerCase());
    }
    return true;
  });

  // Stats
  const stats = Object.keys(entityTypeLabels).map((type) => ({
    type,
    label: entityTypeLabels[type],
    count: permissions.filter((p) => p.entity_type === type).length,
  }));

  const BoolIcon = ({ value }: { value: boolean }) =>
    value ? <Check className="w-4 h-4 text-emerald-600 mx-auto" /> : <X className="w-4 h-4 text-muted-foreground/40 mx-auto" />;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" /> Gestion des permissions
          </h1>
          <p className="text-sm text-muted-foreground">
            Permissions granulaires par entité — les surcharges sont prioritaires sur les rôles
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {stats.map((s) => (
          <Card
            key={s.type}
            className={`cursor-pointer transition-all hover:shadow-md ${filterType === s.type ? "ring-2 ring-primary" : ""}`}
            onClick={() => setFilterType(filterType === s.type ? "all" : s.type)}
          >
            <CardContent className="p-4 text-center">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <p className="text-2xl font-bold">{s.count}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Rechercher par utilisateur..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Entité</TableHead>
                <TableHead className="text-center w-16"><Eye className="w-4 h-4 mx-auto" /></TableHead>
                <TableHead className="text-center w-16"><Pencil className="w-4 h-4 mx-auto" /></TableHead>
                <TableHead className="text-center w-16"><Trash2 className="w-4 h-4 mx-auto" /></TableHead>
                <TableHead className="text-center w-16"><MessageSquare className="w-4 h-4 mx-auto" /></TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Aucune permission trouvée</TableCell></TableRow>
              ) : (
                filtered.map((perm) => (
                  <TableRow key={perm.id}>
                    <TableCell className="font-medium">{(perm as any).profiles?.full_name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{entityTypeLabels[perm.entity_type] || perm.entity_type}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{perm.entity_id.slice(0, 8)}…</TableCell>
                    <TableCell><BoolIcon value={perm.can_view} /></TableCell>
                    <TableCell><BoolIcon value={perm.can_edit} /></TableCell>
                    <TableCell><BoolIcon value={perm.can_delete} /></TableCell>
                    <TableCell><BoolIcon value={perm.can_comment} /></TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditTarget({
                          entityType: perm.entity_type as EntityType,
                          entityId: perm.entity_id,
                          name: `${entityTypeLabels[perm.entity_type]} ${perm.entity_id.slice(0, 8)}`,
                        })}
                      >
                        Gérer
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {editTarget && (
        <EntityPermissionsDialog
          open={!!editTarget}
          onOpenChange={(open) => { if (!open) { setEditTarget(null); fetchAll(); } }}
          entityType={editTarget.entityType}
          entityId={editTarget.entityId}
          entityName={editTarget.name}
        />
      )}
    </div>
  );
}
