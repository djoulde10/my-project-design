import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AdminLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      // Use audit_log as system logs source
      let q = supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (filter !== "all") q = q.eq("entity_type", filter);

      const { data } = await q;
      setLogs(data ?? []);
      setLoading(false);
    };
    fetch();
  }, [filter]);

  const levelColor = (action: string) => {
    if (action === "DELETE") return "destructive";
    if (action === "INSERT") return "default";
    return "secondary";
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Chargement...</div>;

  const entityTypes = [...new Set(logs.map(l => l.entity_type).filter(Boolean))];

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-['Space_Grotesk']">Logs système</h1>
        <p className="text-muted-foreground text-sm mt-1">Journal d'activité global de la plateforme</p>
      </div>

      <div className="flex items-center gap-4">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrer par type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            {entityTypes.map(t => (
              <SelectItem key={t} value={t!}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    Aucun log
                  </TableCell>
                </TableRow>
              ) : logs.map(log => (
                <TableRow key={log.id}>
                  <TableCell>
                    <Badge variant={levelColor(log.action) as any}>{log.action}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{log.entity_type ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(log.created_at).toLocaleString("fr-FR")}
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
