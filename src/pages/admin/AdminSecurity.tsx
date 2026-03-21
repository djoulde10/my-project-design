import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";

export default function AdminSecurity() {
  const [loginLogs, setLoginLogs] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    let q = supabase.from("login_logs").select("*").order("created_at", { ascending: false }).limit(200);
    if (filter === "success") q = q.eq("success", true);
    if (filter === "failed") q = q.eq("success", false);
    const { data } = await q;
    setLoginLogs(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, [filter]);

  const totalLogins = loginLogs.length;
  const failedLogins = loginLogs.filter(l => !l.success).length;
  const suspiciousCount = loginLogs.filter(l => !l.success).length;

  return (
    <div className="p-4 lg:p-8 space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-['Space_Grotesk']">Sécurité</h1>
          <p className="text-muted-foreground text-sm mt-1">Journal des connexions et surveillance</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchLogs}><RefreshCw className="w-4 h-4 mr-2" /> Actualiser</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-success" />
            <div>
              <p className="text-xs text-muted-foreground">Connexions totales</p>
              <p className="text-xl font-bold">{totalLogins}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <ShieldX className="w-5 h-5 text-destructive" />
            <div>
              <p className="text-xs text-muted-foreground">Échecs</p>
              <p className="text-xl font-bold">{failedLogins}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-warning" />
            <div>
              <p className="text-xs text-muted-foreground">Activités suspectes</p>
              <p className="text-xl font-bold">{suspiciousCount > 3 ? suspiciousCount : 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            <SelectItem value="success">Réussies</SelectItem>
            <SelectItem value="failed">Échouées</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Résultat</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
              ) : loginLogs.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Aucun log de connexion</TableCell></TableRow>
              ) : loginLogs.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm">{log.email ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={log.success ? "default" : "destructive"}>
                      {log.success ? "Réussie" : "Échouée"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(log.created_at).toLocaleString("fr-FR")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
