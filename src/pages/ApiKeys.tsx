import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showSuccess, showError } from "@/lib/toastHelpers";
import { Plus, Key, Copy, Trash2, Shield, BookOpen, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const prefix = "gb_";
  let key = prefix;
  for (let i = 0; i < 40; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

export default function ApiKeys() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const [keys, setKeys] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [newKeyVisible, setNewKeyVisible] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", scopes: "read" });

  const fetchKeys = async () => {
    const { data } = await supabase
      .from("api_keys")
      .select("*")
      .order("created_at", { ascending: false });
    setKeys(data ?? []);
  };

  useEffect(() => { fetchKeys(); }, []);

  const handleCreate = async () => {
    if (!form.name) { showError("Le nom est requis."); return; }
    
    const rawKey = generateApiKey();
    const keyHash = await hashKey(rawKey);
    const keyPrefix = rawKey.slice(0, 7) + "...";

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user!.id)
      .single();

    const { error } = await supabase.from("api_keys").insert({
      company_id: profile?.company_id,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      name: form.name,
      scopes: form.scopes === "admin" ? ["read", "write", "admin"] : form.scopes === "write" ? ["read", "write"] : ["read"],
      created_by: user!.id,
    } as any);

    if (error) {
      showError(error, "Impossible de créer la clé API");
      return;
    }

    setNewKeyVisible(rawKey);
    showSuccess("api_key_created", "Clé API créée avec succès.");
    setForm({ name: "", scopes: "read" });
    fetchKeys();
  };

  const handleRevoke = async (id: string) => {
    const { error } = await supabase
      .from("api_keys")
      .update({ is_active: false, revoked_at: new Date().toISOString() } as any)
      .eq("id", id);
    if (error) showError(error, "Impossible de révoquer la clé");
    else { showSuccess("api_key_revoked", "Clé révoquée."); fetchKeys(); }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showSuccess("copied", "Clé copiée dans le presse-papier.");
  };

  if (!hasPermission("gerer_utilisateurs")) {
    return (
      <div className="p-6 lg:p-8">
        <Card><CardContent className="p-8 text-center">
          <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Accès refusé</h2>
          <p className="text-muted-foreground">Vous n'avez pas la permission de gérer les clés API.</p>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Key className="w-6 h-6 text-primary" />
            Clés API
          </h1>
          <p className="text-muted-foreground">Gérez les clés d'accès à l'API publique de votre organisation</p>
        </div>
        <div className="flex gap-2">
          <Link to="/api-docs">
            <Button variant="outline"><BookOpen className="w-4 h-4 mr-2" />Documentation API<ExternalLink className="w-3 h-3 ml-1" /></Button>
          </Link>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setNewKeyVisible(null); }}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Nouvelle clé</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Créer une clé API</DialogTitle></DialogHeader>
              {newKeyVisible ? (
                <div className="space-y-4">
                  <div className="p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">⚠️ Copiez cette clé maintenant. Elle ne sera plus affichée.</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-background p-2 rounded border break-all">{newKeyVisible}</code>
                      <Button size="icon" variant="outline" onClick={() => copyToClipboard(newKeyVisible)}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={() => { setOpen(false); setNewKeyVisible(null); }}>Fermer</Button>
                  </DialogFooter>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nom de la clé</Label>
                      <Input placeholder="Ex: Intégration CRM" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Permissions</Label>
                      <Select value={form.scopes} onValueChange={(v) => setForm({ ...form, scopes: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="read">Lecture seule</SelectItem>
                          <SelectItem value="write">Lecture + Écriture</SelectItem>
                          <SelectItem value="admin">Accès complet</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
                    <Button onClick={handleCreate}>Générer la clé</Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Préfixe</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Dernière utilisation</TableHead>
                <TableHead>Créée le</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Aucune clé API. Créez-en une pour commencer.
                  </TableCell>
                </TableRow>
              ) : (
                keys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.name}</TableCell>
                    <TableCell><code className="text-xs bg-muted px-2 py-1 rounded">{k.key_prefix}</code></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {(k.scopes || []).map((s: string) => (
                          <Badge key={s} variant={s === "admin" ? "destructive" : s === "write" ? "default" : "secondary"} className="text-xs">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={k.is_active ? "default" : "destructive"}>
                        {k.is_active ? "Active" : "Révoquée"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString("fr-FR") : "Jamais"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(k.created_at).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell className="text-right">
                      {k.is_active && (
                        <Button variant="ghost" size="icon" onClick={() => handleRevoke(k.id)} title="Révoquer">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Bonnes pratiques de sécurité
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Ne partagez jamais vos clés API dans du code source public.</p>
          <p>• Utilisez des clés en lecture seule quand l'écriture n'est pas nécessaire.</p>
          <p>• Révoquez immédiatement toute clé compromise.</p>
          <p>• Utilisez des variables d'environnement pour stocker les clés.</p>
        </CardContent>
      </Card>
    </div>
  );
}
