import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, AlertTriangle, CheckCircle2, Clock, XCircle, Download, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { exportTableToPDF, exportTableToCSV } from "@/lib/exportUtils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  en_cours: { label: "En cours", color: "bg-blue-100 text-blue-800", icon: Clock },
  en_retard: { label: "En retard", color: "bg-red-100 text-red-800", icon: AlertTriangle },
  terminee: { label: "Terminée", color: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
  annulee: { label: "Annulée", color: "bg-muted text-muted-foreground", icon: XCircle },
};

export default function Actions() {
  const { toast } = useToast();
  const [actions, setActions] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    decision_id: "", title: "", description: "", responsible_member_id: "", due_date: "",
  });
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchText, setSearchText] = useState("");

  const fetchAll = async () => {
    const [actRes, decRes, memRes] = await Promise.all([
      supabase.from("actions").select("*, decisions(numero_decision, texte), members(full_name)").order("due_date"),
      supabase.from("decisions").select("id, numero_decision, texte"),
      supabase.from("members").select("id, full_name").eq("is_active", true),
    ]);
    setActions(actRes.data ?? []);
    setDecisions(decRes.data ?? []);
    setMembers(memRes.data ?? []);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleCreate = async () => {
    const { error } = await supabase.from("actions").insert([{
      decision_id: form.decision_id || null,
      title: form.title,
      description: form.description || null,
      responsible_member_id: form.responsible_member_id || null,
      due_date: form.due_date || null,
    }]);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else { toast({ title: "Action créée" }); setOpen(false); setForm({ decision_id: "", title: "", description: "", responsible_member_id: "", due_date: "" }); fetchAll(); }
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("actions").update({
      status: status as "en_cours" | "en_retard" | "terminee" | "annulee",
      completion_date: status === "terminee" ? new Date().toISOString().split("T")[0] : null,
    }).eq("id", id);
    fetchAll();
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Suivi des actions</h1>
          <p className="text-sm text-muted-foreground">Actions issues des résolutions</p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline"><Download className="w-4 h-4 mr-2" />Exporter</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => {
                const headers = ["Action", "Résolution", "Responsable", "Échéance", "Statut"];
                const rows = actions.map((a: any) => [
                  a.title, a.decisions?.numero_decision ?? "—", a.members?.full_name ?? "—",
                  a.due_date ? new Date(a.due_date).toLocaleDateString("fr-FR") : "—",
                  statusConfig[a.status]?.label ?? a.status,
                ]);
                exportTableToPDF("Suivi des actions", headers, rows, "actions.pdf");
              }}>
                <Download className="w-4 h-4 mr-2" />Export PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                const headers = ["Action", "Description", "Résolution", "Responsable", "Échéance", "Statut", "Date clôture"];
                const rows = actions.map((a: any) => [
                  a.title, a.description ?? "", a.decisions?.numero_decision ?? "", a.members?.full_name ?? "",
                  a.due_date ?? "", statusConfig[a.status]?.label ?? a.status, a.completion_date ?? "",
                ]);
                exportTableToCSV(headers, rows, "actions.csv");
              }}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />Export Excel (CSV)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Nouvelle action</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Créer une action</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Résolution source</Label>
                <Select value={form.decision_id} onValueChange={(v) => setForm({ ...form, decision_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {decisions.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.numero_decision ? `${d.numero_decision} — ` : ""}{d.texte?.substring(0, 50)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Titre</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Responsable</Label>
                  <Select value={form.responsible_member_id} onValueChange={(v) => setForm({ ...form, responsible_member_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>{members.map((m) => (<SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Échéance</Label>
                  <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={handleCreate} disabled={!form.title}>Créer</Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Object.entries(statusConfig).map(([key, cfg]) => {
          const count = actions.filter((a) => a.status === key).length;
          const isActive = filterStatus === key;
          return (
            <Card key={key} className={cn("cursor-pointer transition-all hover:shadow-md", isActive && "ring-2 ring-primary")} onClick={() => setFilterStatus(isActive ? "all" : key)}>
              <CardContent className="p-4 flex items-center gap-3">
                <cfg.icon className="w-5 h-5" />
                <div>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground">{cfg.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Input placeholder="Rechercher une action..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Résolution</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead>Échéance</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                const filtered = actions.filter((a) => {
                  if (filterStatus !== "all" && a.status !== filterStatus) return false;
                  if (searchText && !a.title?.toLowerCase().includes(searchText.toLowerCase())) return false;
                  return true;
                });
                if (filtered.length === 0) return (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucune action</TableCell></TableRow>
                );
                return filtered.map((a) => {
                  const cfg = statusConfig[a.status] ?? statusConfig.en_cours;
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.title}</TableCell>
                      <TableCell className="text-sm font-mono">{(a as any).decisions?.numero_decision ?? "—"}</TableCell>
                      <TableCell className="text-sm">{(a as any).members?.full_name ?? "—"}</TableCell>
                      <TableCell className="text-sm">
                        {a.due_date ? new Date(a.due_date).toLocaleDateString("fr-FR") : "—"}
                      </TableCell>
                      <TableCell><Badge className={cfg.color}>{cfg.label}</Badge></TableCell>
                      <TableCell>
                        {a.status !== "terminee" && a.status !== "annulee" && (
                          <Button variant="ghost" size="sm" onClick={() => updateStatus(a.id, "terminee")}>
                            <CheckCircle2 className="w-4 h-4 mr-1" />Terminer
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                });
              })()}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
