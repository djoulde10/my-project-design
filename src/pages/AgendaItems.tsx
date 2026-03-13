import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCompanyId } from "@/hooks/useCompanyId";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import RichTextEditor from "@/components/RichTextEditor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Upload, FileIcon, Download, Trash2, Paperclip, Search, GripVertical } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { showSuccess, showError } from "@/lib/toastHelpers";

const emptyForm = {
  session_id: "", title: "", description: "", presenter_member_id: "",
  nature: "information" as "information" | "decision", order_index: 0,
};

export default function AgendaItems() {
  const { user } = useAuth();
  const { toast } = useToast();
  const companyId = useCompanyId();
  const [items, setItems] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  // Document attachment state
  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [docAgendaItem, setDocAgendaItem] = useState<any>(null);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docName, setDocName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [itemDocs, setItemDocs] = useState<Record<string, any[]>>({});
  const [search, setSearch] = useState("");
  const [selectedSession, setSelectedSession] = useState<string>("all");

  const fetchAll = async () => {
    const [itemsRes, sessionsRes, membersRes] = await Promise.all([
      supabase.from("agenda_items").select("*, sessions(title), members(full_name)").order("order_index"),
      supabase.from("sessions").select("id, title").in("status", ["brouillon", "validee"]).order("session_date", { ascending: false }),
      supabase.from("members").select("id, full_name").eq("is_active", true),
    ]);
    setItems(itemsRes.data ?? []);
    setSessions(sessionsRes.data ?? []);
    setMembers(membersRes.data ?? []);

    // Fetch documents linked to agenda items
    const { data: docs } = await supabase
      .from("documents")
      .select("id, name, file_path, file_size, mime_type, agenda_item_id")
      .not("agenda_item_id", "is", null);
    
    const grouped: Record<string, any[]> = {};
    (docs ?? []).forEach((d) => {
      if (d.agenda_item_id) {
        if (!grouped[d.agenda_item_id]) grouped[d.agenda_item_id] = [];
        grouped[d.agenda_item_id].push(d);
      }
    });
    setItemDocs(grouped);
  };

  useEffect(() => { fetchAll(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (item: any) => {
    setEditingId(item.id);
    setForm({
      session_id: item.session_id,
      title: item.title,
      description: item.description ?? "",
      presenter_member_id: item.presenter_member_id ?? "",
      nature: item.nature,
      order_index: item.order_index,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      ...form,
      presenter_member_id: form.presenter_member_id || null,
    };

    if (editingId) {
      const { error } = await supabase.from("agenda_items").update(payload).eq("id", editingId);
      if (error) {
        toast({ title: "Erreur", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Point d'ODJ modifié" });
        setOpen(false);
        fetchAll();
      }
    } else {
      const { error } = await supabase.from("agenda_items").insert([payload]);
      if (error) {
        toast({ title: "Erreur", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Point d'ODJ ajouté" });
        setOpen(false);
        fetchAll();
      }
    }
  };

  // Document attachment
  const openDocDialog = (item: any) => {
    setDocAgendaItem(item);
    setDocFile(null);
    setDocName("");
    setDocDialogOpen(true);
  };

  const handleDocUpload = async () => {
    if (!docFile || !docAgendaItem) return;
    setUploading(true);

    const filePath = `${companyId}/${docAgendaItem.session_id}/${Date.now()}_${docFile.name}`;
    const { error: uploadError } = await supabase.storage.from("session-documents").upload(filePath, docFile);

    if (uploadError) {
      toast({ title: "Erreur upload", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { error } = await supabase.from("documents").insert({
      session_id: docAgendaItem.session_id,
      agenda_item_id: docAgendaItem.id,
      name: docName || docFile.name,
      file_path: filePath,
      file_size: docFile.size,
      mime_type: docFile.type,
      uploaded_by: user?.id,
    });

    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Document attaché au point d'ODJ" });
      setDocDialogOpen(false);
      fetchAll();
    }
    setUploading(false);
  };

  const handleDocDownload = async (doc: any) => {
    const { data } = await supabase.storage.from("session-documents").createSignedUrl(doc.file_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const handleDocDelete = async (doc: any) => {
    await supabase.storage.from("session-documents").remove([doc.file_path]);
    const { error } = await supabase.from("documents").delete().eq("id", doc.id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Document supprimé" });
      fetchAll();
    }
  };

  // Filtering
  const filtered = items.filter((item) => {
    const matchSession = selectedSession === "all" || item.session_id === selectedSession;
    const matchSearch = !search || item.title.toLowerCase().includes(search.toLowerCase()) || (item as any).sessions?.title?.toLowerCase().includes(search.toLowerCase());
    return matchSession && matchSearch;
  });

  // Group by session
  const groupedBySession: Record<string, { sessionTitle: string; items: any[] }> = {};
  filtered.forEach((item) => {
    const sTitle = (item as any).sessions?.title ?? "Sans session";
    if (!groupedBySession[item.session_id]) {
      groupedBySession[item.session_id] = { sessionTitle: sTitle, items: [] };
    }
    groupedBySession[item.session_id].items.push(item);
  });

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Générateur d'ordre du jour</h1>
          <p className="text-muted-foreground">Créez et organisez les points d'ordre du jour par session</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Nouveau point</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={selectedSession} onValueChange={setSelectedSession}>
          <SelectTrigger className="w-[250px]"><SelectValue placeholder="Filtrer par session" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les sessions</SelectItem>
            {sessions.map((s) => (<SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Modifier le point d'ODJ" : "Ajouter un point d'ODJ"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Session</Label>
              <Select value={form.session_id} onValueChange={(v) => setForm({ ...form, session_id: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {sessions.map((s) => (<SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Titre</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <RichTextEditor content={form.description} onChange={(html) => setForm({ ...form, description: html })} minHeight="120px" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nature</Label>
                <Select value={form.nature} onValueChange={(v) => setForm({ ...form, nature: v as "information" | "decision" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="information">Information</SelectItem>
                    <SelectItem value="decision">Décision</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Présentateur</Label>
                <Select value={form.presenter_member_id} onValueChange={(v) => setForm({ ...form, presenter_member_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Optionnel" /></SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (<SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Ordre</Label>
              <Input type="number" value={form.order_index} onChange={(e) => setForm({ ...form, order_index: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={!form.session_id || !form.title}>
              {editingId ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document attachment dialog */}
      <Dialog open={docDialogOpen} onOpenChange={setDocDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attacher un document</DialogTitle>
          </DialogHeader>
          {docAgendaItem && (
            <p className="text-sm text-muted-foreground">Point : <strong>{docAgendaItem.title}</strong></p>
          )}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom du document</Label>
              <Input value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="Optionnel" />
            </div>
            <div className="space-y-2">
              <Label>Fichier</Label>
              <Input type="file" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleDocUpload} disabled={!docFile || uploading}>
              {uploading ? "Upload..." : "Attacher"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {Object.entries(groupedBySession).length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">Aucun point d'ordre du jour trouvé</CardContent>
        </Card>
      ) : (
        Object.entries(groupedBySession).map(([sessionId, group]) => (
          <Card key={sessionId}>
            <CardContent className="p-0">
              <div className="px-4 py-3 border-b bg-muted/30">
                <h3 className="font-semibold text-sm">{group.sessionTitle}</h3>
                <p className="text-xs text-muted-foreground">{group.items.length} point(s)</p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Titre</TableHead>
                    <TableHead>Nature</TableHead>
                    <TableHead>Présentateur</TableHead>
                    <TableHead>Documents</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.items.map((item, i) => {
                    const docs = itemDocs[item.id] ?? [];
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.title}</p>
                            {item.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.nature === "decision" ? "default" : "secondary"}>
                            {item.nature === "decision" ? "Décision" : "Information"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{(item as any).members?.full_name ?? "—"}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {docs.length === 0 ? (
                              <span className="text-xs text-muted-foreground">Aucun</span>
                            ) : docs.map((doc) => (
                              <div key={doc.id} className="flex items-center gap-1 text-xs">
                                <FileIcon className="w-3 h-3 text-primary" />
                                <button className="hover:underline text-primary truncate max-w-[120px]" onClick={() => handleDocDownload(doc)}>{doc.name}</button>
                                <button className="text-destructive hover:text-destructive/80" onClick={() => handleDocDelete(doc)}><Trash2 className="w-3 h-3" /></button>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(item)} title="Modifier"><Pencil className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => openDocDialog(item)} title="Attacher un document"><Paperclip className="w-4 h-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
