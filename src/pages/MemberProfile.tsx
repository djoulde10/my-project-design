import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, User, Mail, Phone, Calendar, Building, FileText, Download, Shield, Briefcase, Globe, MapPin, Linkedin } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const qualityLabels: Record<string, string> = {
  pca: "Président du Conseil d'Administration",
  administrateur: "Administrateur",
  president_comite: "Président du Comité",
  secretariat_juridique: "Secrétariat juridique",
  autre: "Autre",
};

export default function MemberProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [member, setMember] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      setLoading(true);
      const [memberRes, attendeesRes] = await Promise.all([
        supabase.from("members").select("*, organs(name, type)").eq("id", id).single(),
        supabase.from("session_attendees").select("session_id, is_present, sessions(id, title, session_date, status, organs(name))").eq("member_id", id).order("created_at", { ascending: false }),
      ]);

      setMember(memberRes.data);
      const sessionList = (attendeesRes.data ?? []).map((a: any) => ({ ...a.sessions, is_present: a.is_present }));
      setSessions(sessionList);

      // Fetch documents from sessions this member attended
      const sessionIds = sessionList.map((s: any) => s.id).filter(Boolean);
      if (sessionIds.length > 0) {
        const { data: docs } = await supabase.from("documents").select("*, sessions(title)").in("session_id", sessionIds).order("created_at", { ascending: false }).limit(20);
        setDocuments(docs ?? []);
      }

      setLoading(false);
    };
    fetchData();
  }, [id]);

  const handleDownload = async (doc: any) => {
    const { data } = await supabase.storage.from("session-documents").createSignedUrl(doc.file_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Chargement...</div>;
  if (!member) return <div className="p-8 text-center text-muted-foreground">Membre introuvable</div>;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <Button variant="ghost" onClick={() => navigate("/members")} className="gap-2">
        <ArrowLeft className="w-4 h-4" /> Retour aux membres
      </Button>

      {/* Header card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="w-10 h-10 text-primary" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <h1 className="text-2xl font-bold">{member.full_name}</h1>
                <Badge className="mt-1">{qualityLabels[member.quality] ?? member.quality}</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building className="w-4 h-4" />
                  <span>{member.organs?.name}</span>
                </div>
                {member.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    <a href={`mailto:${member.email}`} className="hover:underline">{member.email}</a>
                  </div>
                )}
                {member.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    <span>{member.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Shield className="w-4 h-4" />
                  <Badge variant={member.is_active ? "default" : "secondary"}>
                    {member.is_active ? "Actif" : "Inactif"}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="info" className="space-y-4">
        <TabsList>
          <TabsTrigger value="info">Informations</TabsTrigger>
          <TabsTrigger value="sessions">Sessions ({sessions.length})</TabsTrigger>
          <TabsTrigger value="documents">Documents ({documents.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <Card>
            <CardHeader><CardTitle className="text-lg">Détails du mandat</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Organe</p>
                  <p className="font-medium">{member.organs?.name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Type d'organe</p>
                  <p className="font-medium">{member.organs?.type === "ca" ? "Conseil d'Administration" : "Comité d'Audit"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Qualité / Fonction</p>
                  <p className="font-medium">{qualityLabels[member.quality] ?? member.quality}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Période de mandat</p>
                  <p className="font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    {member.mandate_start ? new Date(member.mandate_start).toLocaleDateString("fr-FR") : "—"}
                    {" — "}
                    {member.mandate_end ? new Date(member.mandate_end).toLocaleDateString("fr-FR") : "En cours"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{member.email || "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Téléphone</p>
                  <p className="font-medium">{member.phone || "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Session</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Organe</TableHead>
                    <TableHead>Présence</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucune session</TableCell></TableRow>
                  ) : sessions.map((s: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{s.title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {s.session_date ? new Date(s.session_date).toLocaleDateString("fr-FR") : "—"}
                      </TableCell>
                      <TableCell className="text-sm">{s.organs?.name}</TableCell>
                      <TableCell>
                        <Badge variant={s.is_present ? "default" : "secondary"}>
                          {s.is_present ? "Présent" : "Absent"}
                        </Badge>
                      </TableCell>
                      <TableCell><Badge variant="outline">{s.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Session</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Aucun document associé</TableCell></TableRow>
                  ) : documents.map((doc: any) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        {doc.name}
                      </TableCell>
                      <TableCell className="text-sm">{doc.sessions?.title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(doc.created_at).toLocaleDateString("fr-FR")}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleDownload(doc)}>
                          <Download className="w-4 h-4" />
                        </Button>
                      </TableCell>
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
