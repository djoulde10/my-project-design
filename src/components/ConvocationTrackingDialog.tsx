import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, CheckCircle2, XCircle, Mail, Send, Bell } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sessionId: string;
  sessionTitle: string;
}

interface Row {
  id: string;
  email: string;
  email_status: string;
  sent_at: string | null;
  viewed_at: string | null;
  user_id: string;
  full_name?: string;
}

export default function ConvocationTrackingDialog({ open, onOpenChange, sessionId, sessionTitle }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("convocation_views" as any)
      .select("id, email, email_status, sent_at, viewed_at, user_id")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("Erreur de chargement: " + error.message);
      setLoading(false);
      return;
    }
    const userIds = [...new Set(((data ?? []) as any[]).map((r) => r.user_id))];
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
    const nameMap = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]));
    setRows(((data ?? []) as any[]).map((r) => ({ ...r, full_name: nameMap.get(r.user_id) || "—" })));
    setLoading(false);
  };

  useEffect(() => {
    if (open && sessionId) load();
  }, [open, sessionId]);

  const triggerSend = async (only_unread: boolean) => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-convocations", {
        body: { session_id: sessionId, only_unread },
      });
      if (error) throw error;
      const sent = (data as any)?.sent ?? 0;
      const failed = (data as any)?.failed ?? 0;
      if (sent === 0 && failed === 0) toast.info("Aucune convocation à envoyer");
      else toast.success(`${sent} envoyé(s)${failed ? `, ${failed} échec(s)` : ""}`);
      await load();
    } catch (e: any) {
      toast.error("Erreur: " + (e?.message ?? "Inconnue"));
    } finally {
      setSending(false);
    }
  };

  const total = rows.length;
  const viewed = rows.filter((r) => r.viewed_at).length;
  const sent = rows.filter((r) => r.email_status === "sent").length;
  const pending = rows.filter((r) => r.email_status === "pending").length;
  const failed = rows.filter((r) => r.email_status === "failed").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Mail className="w-5 h-5" />Suivi des convocations</DialogTitle>
          <DialogDescription>{sessionTitle}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-3 my-4">
          <div className="rounded-md border p-3 text-center"><div className="text-2xl font-bold">{total}</div><div className="text-xs text-muted-foreground">Destinataires</div></div>
          <div className="rounded-md border p-3 text-center"><div className="text-2xl font-bold text-green-600">{viewed}</div><div className="text-xs text-muted-foreground">Vues</div></div>
          <div className="rounded-md border p-3 text-center"><div className="text-2xl font-bold text-blue-600">{sent}</div><div className="text-xs text-muted-foreground">Envoyées</div></div>
          <div className="rounded-md border p-3 text-center"><div className="text-2xl font-bold text-orange-600">{pending + failed}</div><div className="text-xs text-muted-foreground">En attente</div></div>
        </div>

        <div className="flex gap-2 mb-3">
          <Button onClick={() => triggerSend(false)} disabled={sending} size="sm">
            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            Envoyer les convocations en attente
          </Button>
          <Button onClick={() => triggerSend(true)} disabled={sending || sent === 0} variant="outline" size="sm">
            <Bell className="w-4 h-4 mr-2" />Relancer les non-lecteurs
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Aucun destinataire. Publiez la session pour générer les convocations.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Destinataire</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Statut envoi</TableHead>
                <TableHead>Lu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.full_name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.email}</TableCell>
                  <TableCell>
                    {r.email_status === "sent" && <Badge variant="secondary">Envoyé{r.sent_at ? ` · ${new Date(r.sent_at).toLocaleDateString("fr-FR")}` : ""}</Badge>}
                    {r.email_status === "pending" && <Badge variant="outline">En attente</Badge>}
                    {r.email_status === "failed" && <Badge variant="destructive">Échec</Badge>}
                  </TableCell>
                  <TableCell>
                    {r.viewed_at ? (
                      <span className="flex items-center gap-1 text-green-600 text-sm"><CheckCircle2 className="w-4 h-4" />{new Date(r.viewed_at).toLocaleDateString("fr-FR")}</span>
                    ) : (
                      <span className="flex items-center gap-1 text-muted-foreground text-sm"><XCircle className="w-4 h-4" />Non lu</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
