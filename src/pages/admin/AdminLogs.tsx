import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, RefreshCw } from "lucide-react";

export default function AdminLogs() {
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("audit");

  const fetchLogs = async () => {
    setLoading(true);
    const [auditRes, sysRes] = await Promise.all([
      (() => {
        let q = supabase.from("audit_log").select("*, companies:company_id(nom)").order("created_at", { ascending: false }).limit(300);
        if (filter !== "all") q = q.eq("entity_type", filter);
        return q;
      })(),
      (() => {
        let q = supabase.from("system_logs").select("*, companies:company_id(nom)").order("created_at", { ascending: false }).limit(300);
        if (levelFilter !== "all") q = q.eq("level", levelFilter);
        return q;
      })(),
    ]);
    setAuditLogs(auditRes.data ?? []);
    setSystemLogs(sysRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, [filter, levelFilter]);

  const actionColor = (action: string) => {
    if (action === "DELETE") return "destructive";
    if (action === "INSERT") return "default";
    return "secondary";
  };

  const levelColor = (level: string) => {
    switch (level) {
      case "error": return "destructive";
      case "warning": return "secondary";
      default: return "outline";
    }
  };

  const entityTypes = [...new Set(auditLogs.map(l => l.entity_type).filter(Boolean))];

  const filteredAudit = auditLogs.filter(l =>
    !search || JSON.stringify(l).toLowerCase().includes(search.toLowerCase())
  );

  const filteredSystem = systemLogs.filter(l =>
    !search || l.message?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 lg:p-8 space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-['Space_Grotesk']">Logs système</h1>
          <p className="text-muted-foreground text-sm mt-1">Journal d'activité global</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchLogs}><RefreshCw className="w-4 h-4 mr-2" /> Actualiser</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="audit">Audit ({auditLogs.length})</TabsTrigger>
          <TabsTrigger value="system">Système ({systemLogs.length})</TabsTrigger>
        </TabsList>

        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-10" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {tab === "audit" && (
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {entityTypes.map(t => <SelectItem key={t} value={t!}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {tab === "system" && (
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Niveau" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Organisation</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
                  ) : filteredAudit.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Aucun log</TableCell></TableRow>
                  ) : filteredAudit.map(log => (
                    <TableRow key={log.id}>
                      <TableCell><Badge variant={actionColor(log.action) as any}>{log.action}</Badge></TableCell>
                      <TableCell className="text-sm">{log.entity_type ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{(log as any).companies?.nom ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(log.created_at).toLocaleString("fr-FR")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="mt-4">
          <Card>
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
                  ) : filteredSystem.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucun log</TableCell></TableRow>
                  ) : filteredSystem.map(log => (
                    <TableRow key={log.id}>
                      <TableCell><Badge variant={levelColor(log.level) as any}>{log.level}</Badge></TableCell>
                      <TableCell className="text-sm">{log.category}</TableCell>
                      <TableCell className="text-sm max-w-xs truncate">{log.message}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{(log as any).companies?.nom ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(log.created_at).toLocaleString("fr-FR")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
