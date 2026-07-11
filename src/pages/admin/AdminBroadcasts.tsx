import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Megaphone, Send, Info, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAdminAuditLog } from "@/hooks/useAdminAuditLog";

export default function AdminBroadcasts() {
  const { user } = useAuth();
  const { logAdminAction } = useAdminAuditLog();
  const [history, setHistory] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [form, setForm] = useState({ title: "", message: "", level: "info", scope: "all", target_company_id: "" });
  const [sending, setSending] = useState(false);

  const fetchData = async () => {
    const [bRes, oRes] = await Promise.all([
      supabase.from("admin_broadcasts" as any).select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("companies").select("id, nom").eq("statut", "actif").order("nom"),
    ]);
    setHistory((bRes.data as any) ?? []);
    setOrgs(oRes.data ?? []);
  };

  useEffect(() => { fetchData(); }, []);

  const send = async () => {
    if (!form.title.trim() || !form.message.trim()) { toast.error("Titre et message requis"); return; }
    setSending(true);
    try {
      // Determine recipients
      let targetUsers: { id: string; company_id: string | null }[] = [];
      if (form.scope === "all") {
        const { data } = await supabase.from("profiles").select("id, company_id").eq("statut", "actif");
        targetUsers = data ?? [];
      } else if (form.scope === "org" && form.target_company_id) {
        const { data } = await supabase.from("profiles").select("id, company_id").eq("company_id", form.target_company_id).eq("statut", "actif");
        targetUsers = data ?? [];
      }

      // Insert broadcast record
      const { data: broadcast, error: bErr } = await supabase.from("admin_broadcasts" as any).insert({
        title: form.title,
        message: form.message,
        level: form.level,
        scope: form.scope,
        target_company_ids: form.scope === "org" && form.target_company_id ? [form.target_company_id] : null,
        sent_by: user?.id,
        recipients_count: targetUsers.length,
      }).select().single();
      if (bErr) throw bErr;

      // Fan out to notifications (batch)
      const notifs = targetUsers.map(u => ({
        user_id: u.id,
        type: "admin_broadcast",
        title: form.title,
        message: form.message,
        link: "/",
        metadata: { broadcast_id: (broadcast as any).id, level: form.level },
      }));
      // Chunk to avoid huge payloads
      for (let i = 0; i < notifs.length; i += 500) {
        await supabase.from("notifications").insert(notifs.slice(i, i + 500));
      }

      logAdminAction({ action: "diffusion_globale", entity_type: "admin_broadcasts", entity_id: (broadcast as any).id, details: { title: form.title, scope: form.scope, recipients: targetUsers.length } });
      toast.success(`Annonce envoyée à ${targetUsers.length} utilisateur(s)`);
      setForm({ title: "", message: "", level: "info", scope: "all", target_company_id: "" });
      fetchData();
    } catch (e: any) {
      toast.error("Erreur: " + (e.message ?? "envoi impossible"));
    } finally {
      setSending(false);
    }
  };

  const levelIcon = (l: string) => l === "warning" ? AlertTriangle : l === "success" ? CheckCircle2 : Info;
  const levelVariant = (l: string): any => l === "warning" ? "secondary" : l === "success" ? "default" : "outline";

  return (
    <div className="p-4 lg:p-8 space-y-6 overflow-y-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-['Space_Grotesk'] flex items-center gap-2">
          <Megaphone className="w-6 h-6 text-destructive" /> Diffusions globales
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Envoyer des annonces à tout ou partie de la plateforme</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Nouvelle annonce</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Titre</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Maintenance planifiée" /></div>
            <div><Label>Message</Label><Textarea rows={4} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Détails de l'annonce..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Niveau</Label>
                <Select value={form.level} onValueChange={v => setForm(f => ({ ...f, level: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Avertissement</SelectItem>
                    <SelectItem value="success">Succès</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Portée</Label>
                <Select value={form.scope} onValueChange={v => setForm(f => ({ ...f, scope: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toute la plateforme</SelectItem>
                    <SelectItem value="org">Une organisation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.scope === "org" && (
              <div>
                <Label>Organisation cible</Label>
                <Select value={form.target_company_id} onValueChange={v => setForm(f => ({ ...f, target_company_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>{orgs.map(o => <SelectItem key={o.id} value={o.id}>{o.nom}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <Button className="w-full" onClick={send} disabled={sending}>
              <Send className="w-4 h-4 mr-2" /> {sending ? "Envoi..." : "Envoyer l'annonce"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Historique</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titre</TableHead>
                  <TableHead>Niveau</TableHead>
                  <TableHead>Portée</TableHead>
                  <TableHead>Reçus</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-sm">Aucune annonce</TableCell></TableRow>
                ) : history.map(b => {
                  const Icon = levelIcon(b.level);
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium text-sm">{b.title}</TableCell>
                      <TableCell><Badge variant={levelVariant(b.level)} className="gap-1"><Icon className="w-3 h-3" />{b.level}</Badge></TableCell>
                      <TableCell className="text-xs">{b.scope === "all" ? "Toute plateforme" : "Organisation"}</TableCell>
                      <TableCell className="text-sm">{b.recipients_count}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleDateString("fr-FR")}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}