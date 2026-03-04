import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, History } from "lucide-react";

const actionColors: Record<string, string> = {
  INSERT: "bg-emerald-100 text-emerald-800",
  UPDATE: "bg-amber-100 text-amber-800",
  DELETE: "bg-destructive/10 text-destructive",
};

export default function AuditLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterTable, setFilterTable] = useState("all");

  useEffect(() => {
    const fetchLogs = async () => {
      let query = supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (filterTable !== "all") {
        query = query.eq("table_name", filterTable);
      }
      const { data } = await query;
      setLogs(data ?? []);
    };
    fetchLogs();
  }, [filterTable]);

  const tableNames = ["sessions", "agenda_items", "documents", "minutes", "solutions", "actions", "members", "session_attendees"];

  const filtered = logs.filter((l) =>
    !search || l.action?.toLowerCase().includes(search.toLowerCase()) ||
    l.table_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.record_id?.includes(search)
  );

  const renderJson = (val: any) => {
    if (!val) return <span className="text-muted-foreground">—</span>;
    const keys = Object.keys(val).filter(k => !["id", "created_at", "updated_at"].includes(k));
    if (keys.length === 0) return <span className="text-muted-foreground">—</span>;
    return (
      <div className="max-w-xs max-h-24 overflow-auto text-xs font-mono bg-muted rounded p-1.5">
        {keys.slice(0, 4).map(k => (
          <div key={k} className="truncate"><span className="text-primary">{k}:</span> {JSON.stringify(val[k])}</div>
        ))}
        {keys.length > 4 && <div className="text-muted-foreground">+{keys.length - 4} champs...</div>}
      </div>
    );
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><History className="w-6 h-6" />Journal d'audit</h1>
        <p className="text-muted-foreground">Traçabilité complète de toutes les actions critiques</p>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterTable} onValueChange={setFilterTable}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Toutes les tables" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les tables</SelectItem>
            {tableNames.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Table</TableHead>
                <TableHead>Anciennes valeurs</TableHead>
                <TableHead>Nouvelles valeurs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucun enregistrement</TableCell></TableRow>
              ) : filtered.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {new Date(l.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                  <TableCell><Badge className={actionColors[l.action] ?? ""}>{l.action}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{l.table_name}</Badge></TableCell>
                  <TableCell>{renderJson(l.old_values)}</TableCell>
                  <TableCell>{renderJson(l.new_values)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
