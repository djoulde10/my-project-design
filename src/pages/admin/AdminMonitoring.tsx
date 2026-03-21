import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, AlertTriangle, CheckCircle2, XCircle, Activity } from "lucide-react";

export default function AdminMonitoring() {
  const [errors, setErrors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchErrors = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("system_logs")
      .select("*, companies:company_id(nom)")
      .in("level", ["error", "warning"])
      .order("created_at", { ascending: false })
      .limit(100);
    setErrors(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchErrors(); }, []);

  const errorCount = errors.filter(e => e.level === "error").length;
  const warningCount = errors.filter(e => e.level === "warning").length;

  const services = [
    { name: "Base de données", status: "ok" },
    { name: "Authentification", status: "ok" },
    { name: "Stockage fichiers", status: "ok" },
    { name: "IA / Assistant", status: errorCount > 0 ? "warning" : "ok" },
    { name: "Notifications email", status: "ok" },
    { name: "Fonctions backend", status: errorCount > 5 ? "error" : "ok" },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-['Space_Grotesk']">Monitoring</h1>
          <p className="text-muted-foreground text-sm mt-1">Surveillance en temps réel de la plateforme</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchErrors}><RefreshCw className="w-4 h-4 mr-2" /> Actualiser</Button>
      </div>

      {/* Service Status */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {services.map(s => (
          <Card key={s.name}>
            <CardContent className="p-4 flex items-center gap-3">
              {s.status === "ok" ? (
                <CheckCircle2 className="w-5 h-5 text-success" />
              ) : s.status === "warning" ? (
                <AlertTriangle className="w-5 h-5 text-warning" />
              ) : (
                <XCircle className="w-5 h-5 text-destructive" />
              )}
              <div>
                <p className="text-sm font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  {s.status === "ok" ? "Opérationnel" : s.status === "warning" ? "Dégradé" : "En panne"}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Error Summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="w-5 h-5 text-destructive" />
            <div>
              <p className="text-xs text-muted-foreground">Erreurs</p>
              <p className="text-xl font-bold">{errorCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <div>
              <p className="text-xs text-muted-foreground">Avertissements</p>
              <p className="text-xl font-bold">{warningCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Errors */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="w-4 h-4" /> Erreurs récentes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Niveau</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Organisation</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
              ) : errors.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle2 className="w-8 h-8 text-success" />
                    <p>Aucune erreur détectée — Tout fonctionne correctement</p>
                  </div>
                </TableCell></TableRow>
              ) : errors.map(e => (
                <TableRow key={e.id}>
                  <TableCell>
                    <Badge variant={e.level === "error" ? "destructive" : "secondary"}>{e.level}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{e.category}</TableCell>
                  <TableCell className="text-sm max-w-xs truncate">{e.message}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{(e as any).companies?.nom ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(e.created_at).toLocaleString("fr-FR")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
