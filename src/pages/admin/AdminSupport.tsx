import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { MessageSquare, RefreshCw } from "lucide-react";

export default function AdminSupport() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [response, setResponse] = useState("");

  const fetchTickets = async () => {
    setLoading(true);
    let q = supabase.from("support_tickets").select("*, companies:company_id(nom)").order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setTickets(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchTickets(); }, [filter]);

  const respondToTicket = async () => {
    if (!response.trim()) { toast.error("Réponse requise"); return; }
    const { error } = await supabase.from("support_tickets").update({
      admin_response: response,
      status: "resolved",
      responded_at: new Date().toISOString(),
    }).eq("id", selected.id);
    if (error) { toast.error("Erreur"); return; }
    toast.success("Réponse envoyée");
    setSelected(null);
    setResponse("");
    fetchTickets();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("support_tickets").update({ status }).eq("id", id);
    toast.success("Statut mis à jour");
    fetchTickets();
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "open": return "destructive";
      case "in_progress": return "secondary";
      case "resolved": return "default";
      case "closed": return "outline";
      default: return "secondary";
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case "open": return "Ouvert";
      case "in_progress": return "En cours";
      case "resolved": return "Résolu";
      case "closed": return "Fermé";
      default: return s;
    }
  };

  const priorityColor = (p: string) => {
    switch (p) {
      case "urgent": return "destructive";
      case "high": return "secondary";
      default: return "outline";
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-['Space_Grotesk']">Support</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestion des demandes de support</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchTickets}><RefreshCw className="w-4 h-4 mr-2" /> Actualiser</Button>
      </div>

      <div className="flex items-center gap-3">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="open">Ouverts</SelectItem>
            <SelectItem value="in_progress">En cours</SelectItem>
            <SelectItem value="resolved">Résolus</SelectItem>
            <SelectItem value="closed">Fermés</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MessageSquare className="w-4 h-4" />
          {tickets.filter(t => t.status === "open").length} ticket(s) ouvert(s)
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sujet</TableHead>
                <TableHead>Organisation</TableHead>
                <TableHead>Priorité</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
              ) : tickets.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucun ticket</TableCell></TableRow>
              ) : tickets.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium text-sm max-w-xs truncate">{t.subject}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{(t as any).companies?.nom ?? "—"}</TableCell>
                  <TableCell><Badge variant={priorityColor(t.priority) as any}>{t.priority}</Badge></TableCell>
                  <TableCell><Badge variant={statusColor(t.status) as any}>{statusLabel(t.status)}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(t.created_at).toLocaleDateString("fr-FR")}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => { setSelected(t); setResponse(t.admin_response ?? ""); }}>
                      Répondre
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{selected?.subject}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4 mt-2">
              <div className="bg-muted/50 p-3 rounded-lg text-sm">{selected.description || "Pas de description"}</div>
              <div>
                <p className="text-sm font-medium mb-2">Réponse administrateur</p>
                <Textarea value={response} onChange={e => setResponse(e.target.value)} rows={4} placeholder="Votre réponse..." />
              </div>
              <div className="flex gap-2">
                <Button onClick={respondToTicket} className="flex-1">Répondre & Résoudre</Button>
                <Button variant="outline" onClick={() => { updateStatus(selected.id, "in_progress"); setSelected(null); }}>En cours</Button>
                <Button variant="outline" onClick={() => { updateStatus(selected.id, "closed"); setSelected(null); }}>Fermer</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
