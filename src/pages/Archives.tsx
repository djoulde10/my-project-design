import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Archive } from "lucide-react";

export default function Archives() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [organs, setOrgans] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterOrgan, setFilterOrgan] = useState("all");
  const [filterYear, setFilterYear] = useState("all");

  useEffect(() => {
    const fetchData = async () => {
      const [sessRes, orgRes] = await Promise.all([
        supabase.from("sessions").select("*, organs(name)").in("status", ["cloturee", "archivee"]).order("session_date", { ascending: false }),
        supabase.from("organs").select("*"),
      ]);
      setSessions(sessRes.data ?? []);
      setOrgans(orgRes.data ?? []);
    };
    fetchData();
  }, []);

  const years = [...new Set(sessions.map((s) => new Date(s.session_date).getFullYear()))].sort((a, b) => b - a);

  const filtered = sessions.filter((s) => {
    const matchSearch = !search || s.title.toLowerCase().includes(search.toLowerCase());
    const matchOrgan = filterOrgan === "all" || s.organ_id === filterOrgan;
    const matchYear = filterYear === "all" || new Date(s.session_date).getFullYear().toString() === filterYear;
    return matchSearch && matchOrgan && matchYear;
  });

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Archive className="w-6 h-6" />Archives</h1>
        <p className="text-muted-foreground">Sessions clôturées et archivées</p>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterOrgan} onValueChange={setFilterOrgan}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Organe" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les organes</SelectItem>
            {organs.map((o) => (<SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Année" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            {years.map((y) => (<SelectItem key={y} value={y.toString()}>{y}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Session</TableHead>
                <TableHead>Organe</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucune archive trouvée</TableCell></TableRow>
              ) : (
                filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.title}</TableCell>
                    <TableCell>{(s as any).organs?.name}</TableCell>
                    <TableCell className="text-sm">{new Date(s.session_date).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{s.session_type}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={s.status === "archivee" ? "secondary" : "default"}>
                        {s.status === "archivee" ? "Archivée" : "Clôturée"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
