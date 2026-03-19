import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Download } from "lucide-react";

export default function AdminBilling() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      let q = supabase
        .from("invoices")
        .select("*, companies(nom), subscription_plans(name)")
        .order("created_at", { ascending: false })
        .limit(100);

      if (filter !== "all") q = q.eq("status", filter);

      const { data } = await q;
      setInvoices(data ?? []);
      setLoading(false);
    };
    fetch();
  }, [filter]);

  const statusColor = (s: string) => {
    switch (s) {
      case "paid": return "default";
      case "pending": return "secondary";
      case "overdue": return "destructive";
      case "cancelled": return "outline";
      default: return "secondary";
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case "paid": return "Payée";
      case "pending": return "En attente";
      case "overdue": return "En retard";
      case "cancelled": return "Annulée";
      default: return s;
    }
  };

  const totalRevenue = invoices.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);
  const totalPending = invoices.filter(i => i.status === "pending").reduce((s, i) => s + Number(i.amount), 0);

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Chargement...</div>;

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-['Space_Grotesk']">Facturation</h1>
        <p className="text-muted-foreground text-sm mt-1">Gestion des factures et paiements</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Total encaissé</p>
            <p className="text-2xl font-bold text-success">{totalRevenue.toFixed(2)}€</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">En attente</p>
            <p className="text-2xl font-bold text-warning">{totalPending.toFixed(2)}€</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Factures</p>
            <p className="text-2xl font-bold">{invoices.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrer par statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            <SelectItem value="paid">Payées</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="overdue">En retard</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° Facture</TableHead>
                <TableHead>Organisation</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Aucune facture
                  </TableCell>
                </TableRow>
              ) : invoices.map(inv => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-sm">{inv.invoice_number}</TableCell>
                  <TableCell>{(inv as any).companies?.nom ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{(inv as any).subscription_plans?.name ?? "—"}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{Number(inv.amount).toFixed(2)}€</TableCell>
                  <TableCell>
                    <Badge variant={statusColor(inv.status) as any}>{statusLabel(inv.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(inv.created_at).toLocaleDateString("fr-FR")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
