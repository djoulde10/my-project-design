import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import EntityPermissionsDialog from "@/components/EntityPermissionsDialog";
import { useAuth } from "@/lib/auth";
import { useCompanyId } from "@/hooks/useCompanyId";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Upload, FileIcon, Download, FolderOpen, FileText, Gavel, BookOpen, Scale, Presentation, File, MessageSquare, ExternalLink, Cloud } from "lucide-react";
import { getGoogleDriveLink, getOneDriveLink } from "@/lib/calendarIntegrations";
import { showSuccess, showError } from "@/lib/toastHelpers";
import CommentThread from "@/components/CommentThread";
import { usePermissions } from "@/hooks/usePermissions";
import { DataTable, type DataTableColumn, type DataTableFilter } from "@/components/ui/data-table";
import PageSkeleton from "@/components/PageSkeleton";

const categories = [
  { value: "pv", label: "Procès-verbaux", icon: FileText },
  { value: "politique", label: "Politiques internes", icon: BookOpen },
  { value: "rapport", label: "Rapports", icon: Gavel },
  { value: "juridique", label: "Documents juridiques", icon: Scale },
  { value: "presentation", label: "Présentations", icon: Presentation },
  { value: "autre", label: "Autres", icon: File },
] as const;

const categoryLabels: Record<string, string> = {
  pv: "Procès-verbal", politique: "Politique interne", rapport: "Rapport",
  juridique: "Juridique", presentation: "Présentation", autre: "Autre",
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
  const { hasPermission } = usePermissions();
  const canManageDocs = hasPermission("gerer_documents");
  const companyId = useCompanyId();
  const [documents, setDocuments] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ session_id: "", name: "", category: "autre" });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [commentingId, setCommentingId] = useState<string | null>(null);
  const [permDocId, setPermDocId] = useState<string | null>(null);
  const [permDocName, setPermDocName] = useState("");

  const fetchAll = async () => {
    setLoading(true);
    const [docsRes, sessionsRes] = await Promise.all([
      supabase.from("documents").select("*, sessions(title)").order("created_at", { ascending: false }),
      supabase.from("sessions").select("id, title").order("session_date", { ascending: false }),
    ]);
    setDocuments(docsRes.data ?? []);
    setSessions(sessionsRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleUpload = async () => {
    if (!file || !form.session_id) return;
    setUploading(true);
    const filePath = `${companyId}/${form.session_id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("session-documents").upload(filePath, file);
    if (uploadError) { showError(uploadError, "Impossible de téléverser le fichier"); setUploading(false); return; }
    const { error } = await supabase.from("documents").insert({
      session_id: form.session_id, name: form.name || file.name, file_path: filePath,
      file_size: file.size, mime_type: file.type, uploaded_by: user?.id, category: form.category,
    });
    if (error) showError(error, "Impossible d'enregistrer le document");
    else {
      showSuccess("document_uploaded");
      setOpen(false); setForm({ session_id: "", name: "", category: "autre" }); setFile(null); fetchAll();
    }
    setUploading(false);
  };

  const handleDownload = async (doc: any) => {
    const { data } = await supabase.storage.from("session-documents").createSignedUrl(doc.file_path, 3600);
    if (data?.signedUrl) {
      if (user && companyId) {
        await supabase.from("document_downloads" as any).insert({ document_id: doc.id, user_id: user.id, company_id: companyId });
      }
      window.open(data.signedUrl, "_blank");
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const stats = categories.map(c => ({ ...c, count: documents.filter(d => d.category === c.value).length }));
  const filteredData = activeCategory === "all" ? documents : documents.filter((d) => d.category === activeCategory);

  const columns: DataTableColumn<any>[] = [
    {
      key: "name", label: "Document", alwaysVisible: true,
      accessor: (d) => d.name,
      render: (d) => (
        <div className="flex items-center gap-2">
          <FileIcon className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="font-medium truncate max-w-xs">{d.name}</span>
        </div>
      ),
    },
    {
      key: "category", label: "Catégorie", width: "w-[160px]",
      accessor: (d) => categoryLabels[d.category] ?? d.category,
      render: (d) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${categoryColors[d.category] || categoryColors.autre}`}>
          {categoryLabels[d.category] || d.category}
        </span>
      ),
    },
    {
      key: "session", label: "Session",
      accessor: (d) => d.sessions?.title ?? "",
      render: (d) => <span className="text-sm">{d.sessions?.title ?? "—"}</span>,
    },
    {
      key: "size", label: "Taille", width: "w-[100px]",
      accessor: (d) => d.file_size ?? 0,
      render: (d) => <span className="text-sm text-muted-foreground">{formatSize(d.file_size)}</span>,
    },
    {
      key: "version", label: "Version", width: "w-[90px]", hiddenByDefault: true,
      accessor: (d) => d.version ?? 1,
      render: (d) => <Badge variant="outline">v{d.version}</Badge>,
    },
    {
      key: "date", label: "Date", width: "w-[120px]",
      accessor: (d) => d.created_at,
      render: (d) => <span className="text-sm text-muted-foreground">{new Date(d.created_at).toLocaleDateString("fr-FR")}</span>,
    },
    {
      key: "actions", label: "Actions", width: "w-[100px]", alwaysVisible: true,
      render: (d) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDownload(d); }}>
            <Download className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setCommentingId(commentingId === d.id ? null : d.id); }}>
            <MessageSquare className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  const filters: DataTableFilter[] = [
    {
      key: "category", label: "Catégorie",
      options: categories.map((c) => ({ value: c.value, label: c.label, count: documents.filter((d) => d.category === c.value).length })),
      predicate: (d, v) => d.category === v,
    },
  ];

  if (loading) return <PageSkeleton />;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Centre de documentation</h1>
          <p className="text-sm text-muted-foreground">Stockez, organisez et consultez tous les documents</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={getGoogleDriveLink()} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm"><Cloud className="w-4 h-4 mr-1" />Google Drive<ExternalLink className="w-3 h-3 ml-1" /></Button>
          </a>
          <a href={getOneDriveLink()} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm"><Cloud className="w-4 h-4 mr-1" />OneDrive<ExternalLink className="w-3 h-3 ml-1" /></Button>
          </a>
          {canManageDocs && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Upload className="w-4 h-4 mr-2" />Uploader un document</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Uploader un document</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Catégorie</Label>
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{categories.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Session associée</Label>
                    <Select value={form.session_id} onValueChange={(v) => setForm({ ...form, session_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner une session" /></SelectTrigger>
                      <SelectContent>{sessions.map((s) => (<SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Nom du document</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Optionnel — le nom du fichier sera utilisé par défaut" /></div>
                  <div className="space-y-2"><Label>Fichier</Label><Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
                  <Button onClick={handleUpload} disabled={!form.session_id || !file || uploading}>{uploading ? "Upload en cours..." : "Uploader"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Cartes catégories cliquables */}
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

      <DataTable
        storageKey="documents"
        data={filteredData}
        columns={columns}
        rowKey={(d) => d.id}
        filters={filters}
        searchPlaceholder="Rechercher par nom ou session…"
        emptyMessage="Aucun document trouvé"
        defaultPageSize={20}
      />

      {commentingId && (
        <Card><CardContent className="p-4"><CommentThread entityType="document" entityId={commentingId} /></CardContent></Card>
      )}

      {permDocId && (
        <EntityPermissionsDialog
          open={!!permDocId}
          onOpenChange={(open) => { if (!open) setPermDocId(null); }}
          entityType="document" entityId={permDocId} entityName={permDocName}
        />
      )}
    </div>
  );
}
