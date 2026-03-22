import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCompanyId } from "@/hooks/useCompanyId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileIcon, Download, Search, FolderOpen, FileText, Gavel, BookOpen, Scale, Presentation, File, MessageSquare } from "lucide-react";
import { showSuccess, showError } from "@/lib/toastHelpers";
import CommentThread from "@/components/CommentThread";

const categories = [
  { value: "all", label: "Tous", icon: FolderOpen },
  { value: "pv", label: "Procès-verbaux", icon: FileText },
  { value: "politique", label: "Politiques internes", icon: BookOpen },
  { value: "rapport", label: "Rapports", icon: Gavel },
  { value: "juridique", label: "Documents juridiques", icon: Scale },
  { value: "presentation", label: "Présentations", icon: Presentation },
  { value: "autre", label: "Autres", icon: File },
] as const;

const categoryLabels: Record<string, string> = {
  pv: "Procès-verbal",
  politique: "Politique interne",
  rapport: "Rapport",
  juridique: "Juridique",
  presentation: "Présentation",
  autre: "Autre",
};

const categoryColors: Record<string, string> = {
  pv: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  politique: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  rapport: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  juridique: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  presentation: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  autre: "bg-muted text-muted-foreground",
};

export default function Documents() {
  const { user } = useAuth();
  
  const companyId = useCompanyId();
  const [documents, setDocuments] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ session_id: "", name: "", category: "autre" });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const fetchAll = async () => {
    const [docsRes, sessionsRes] = await Promise.all([
      supabase.from("documents").select("*, sessions(title)").order("created_at", { ascending: false }),
      supabase.from("sessions").select("id, title").order("session_date", { ascending: false }),
    ]);
    setDocuments(docsRes.data ?? []);
    setSessions(sessionsRes.data ?? []);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleUpload = async () => {
    if (!file || !form.session_id) return;
    setUploading(true);

    const filePath = `${companyId}/${form.session_id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("session-documents").upload(filePath, file);

    if (uploadError) {
      showError(uploadError, "Impossible de téléverser le fichier");
      setUploading(false);
      return;
    }

    const { error } = await supabase.from("documents").insert({
      session_id: form.session_id,
      name: form.name || file.name,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.type,
      uploaded_by: user?.id,
      category: form.category,
    });

    if (error) {
      showError(error, "Impossible d'enregistrer le document");
    } else {
      showSuccess("document_uploaded");
      setOpen(false);
      setForm({ session_id: "", name: "", category: "autre" });
      setFile(null);
      fetchAll();
    }
    setUploading(false);
  };

  const handleDownload = async (doc: any) => {
    const { data } = await supabase.storage.from("session-documents").createSignedUrl(doc.file_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filtered = documents.filter((doc) => {
    const matchCategory = activeCategory === "all" || doc.category === activeCategory;
    const matchSearch = !search || doc.name.toLowerCase().includes(search.toLowerCase()) || (doc as any).sessions?.title?.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  });

  // Stats per category
  const stats = categories.filter(c => c.value !== "all").map(c => ({
    ...c,
    count: documents.filter(d => d.category === c.value).length,
  }));

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Centre de documentation</h1>
          <p className="text-sm text-muted-foreground">Stockez, organisez et consultez tous les documents</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Upload className="w-4 h-4 mr-2" />Uploader un document</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Uploader un document</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.filter(c => c.value !== "all").map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Session associée</Label>
                <Select value={form.session_id} onValueChange={(v) => setForm({ ...form, session_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner une session" /></SelectTrigger>
                  <SelectContent>
                    {sessions.map((s) => (<SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nom du document</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Optionnel — le nom du fichier sera utilisé par défaut" />
              </div>
              <div className="space-y-2">
                <Label>Fichier</Label>
                <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={handleUpload} disabled={!form.session_id || !file || uploading}>
                {uploading ? "Upload en cours..." : "Uploader"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Category stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((s) => (
          <Card
            key={s.value}
            className={`cursor-pointer transition-all hover:shadow-md ${activeCategory === s.value ? "ring-2 ring-primary" : ""}`}
            onClick={() => setActiveCategory(activeCategory === s.value ? "all" : s.value)}
          >
            <CardContent className="p-4 flex flex-col items-center gap-2">
              <s.icon className="w-5 h-5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground text-center">{s.label}</span>
              <span className="text-lg font-bold">{s.count}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Rechercher par nom ou session..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Documents table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[750px]">
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Taille</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucun document trouvé</TableCell></TableRow>
              ) : (
                filtered.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileIcon className="w-4 h-4 text-primary" />
                        <span className="font-medium">{doc.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${categoryColors[doc.category] || categoryColors.autre}`}>
                        {categoryLabels[doc.category] || doc.category}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{(doc as any).sessions?.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatSize(doc.file_size)}</TableCell>
                    <TableCell><Badge variant="outline">v{doc.version}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(doc.created_at).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDownload(doc)}>
                        <Download className="w-4 h-4" />
                      </Button>
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
