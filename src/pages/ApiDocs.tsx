import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Play, Copy, ChevronDown, ChevronRight, Key, ArrowLeft, Shield, Zap, Globe, Code2 } from "lucide-react";
import { Link } from "react-router-dom";
import { showSuccess } from "@/lib/toastHelpers";

const API_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/public-api/v1`;

interface Param {
  name: string;
  type: string;
  desc: string;
  required?: boolean;
}

interface Endpoint {
  method: string;
  path: string;
  description: string;
  scope: string;
  params?: Param[];
  body?: Param[];
  response: string;
}

const methodColors: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  POST: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  PUT: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  DELETE: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
};

const endpoints: Record<string, Endpoint[]> = {
  "Réunions": [
    {
      method: "GET", path: "/v1/meetings", description: "Liste toutes les réunions/sessions.", scope: "read",
      params: [
        { name: "page", type: "integer", desc: "Page (défaut: 1)" },
        { name: "limit", type: "integer", desc: "Par page (défaut: 20, max: 100)" },
        { name: "status", type: "string", desc: "Filtrer par statut (brouillon, validee, tenue, cloturee, archivee)" },
        { name: "organ_id", type: "uuid", desc: "Filtrer par organe" },
        { name: "from_date", type: "datetime", desc: "Date de début" },
        { name: "to_date", type: "datetime", desc: "Date de fin" },
      ],
      response: `{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "title": "Session ordinaire Q1",
      "session_date": "2026-03-15T10:00:00Z",
      "status": "validee",
      "session_type": "ordinaire",
      "location": "Salle du conseil",
      "numero_session": "CA-2026-01"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 42 }
}`,
    },
    { method: "GET", path: "/v1/meetings/:id", description: "Détail d'une réunion.", scope: "read", response: `{ "status": "success", "data": { "id": "uuid", "title": "...", ... } }` },
    {
      method: "POST", path: "/v1/meetings", description: "Créer une réunion.", scope: "write",
      body: [
        { name: "title", type: "string", desc: "Titre de la réunion", required: true },
        { name: "session_date", type: "datetime", desc: "Date et heure", required: true },
        { name: "organ_id", type: "uuid", desc: "ID de l'organe", required: true },
        { name: "session_type", type: "string", desc: "ordinaire, extraordinaire, speciale" },
        { name: "location", type: "string", desc: "Lieu" },
        { name: "is_virtual", type: "boolean", desc: "Réunion virtuelle" },
      ],
      response: `{ "status": "success", "data": { "id": "uuid", "title": "...", ... } }`,
    },
    {
      method: "PUT", path: "/v1/meetings/:id", description: "Modifier une réunion.", scope: "write",
      body: [
        { name: "title", type: "string", desc: "Nouveau titre" },
        { name: "session_date", type: "datetime", desc: "Nouvelle date" },
        { name: "status", type: "string", desc: "Nouveau statut" },
      ],
      response: `{ "status": "success", "data": { "id": "uuid", ... } }`,
    },
    { method: "DELETE", path: "/v1/meetings/:id", description: "Supprimer une réunion.", scope: "admin", response: `{ "status": "success", "data": { "deleted": true } }` },
  ],
  "Procès-verbaux": [
    {
      method: "GET", path: "/v1/pvs", description: "Liste tous les procès-verbaux.", scope: "read",
      params: [
        { name: "page", type: "integer", desc: "Page" },
        { name: "limit", type: "integer", desc: "Par page" },
        { name: "pv_status", type: "string", desc: "Filtrer: brouillon, valide, signe" },
        { name: "session_id", type: "uuid", desc: "Filtrer par session" },
      ],
      response: `{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "session_id": "uuid",
      "pv_status": "valide",
      "content": "<p>Contenu du PV...</p>",
      "validated_at": "2026-03-16T14:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 15 }
}`,
    },
    { method: "GET", path: "/v1/pvs/:id", description: "Détail d'un PV.", scope: "read", response: `{ "status": "success", "data": { ... } }` },
    {
      method: "POST", path: "/v1/pvs", description: "Créer un PV.", scope: "write",
      body: [
        { name: "session_id", type: "uuid", desc: "ID de la session", required: true },
        { name: "content", type: "string", desc: "Contenu HTML du PV" },
      ],
      response: `{ "status": "success", "data": { "id": "uuid", ... } }`,
    },
    { method: "PUT", path: "/v1/pvs/:id", description: "Modifier un PV.", scope: "write", body: [{ name: "content", type: "string", desc: "Contenu mis à jour" }, { name: "pv_status", type: "string", desc: "Nouveau statut" }], response: `{ "status": "success", "data": { ... } }` },
    { method: "DELETE", path: "/v1/pvs/:id", description: "Supprimer un PV.", scope: "admin", response: `{ "status": "success", "data": { "deleted": true } }` },
  ],
  "Utilisateurs": [
    {
      method: "GET", path: "/v1/users", description: "Liste des utilisateurs de l'organisation.", scope: "read",
      params: [{ name: "statut", type: "string", desc: "Filtrer: actif, suspendu" }],
      response: `{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "full_name": "Jean Dupont",
      "statut": "actif",
      "role_id": "uuid",
      "created_at": "2026-01-01T00:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 8 }
}`,
    },
    { method: "GET", path: "/v1/users/:id", description: "Détail d'un utilisateur.", scope: "read", response: `{ "status": "success", "data": { ... } }` },
    {
      method: "PUT", path: "/v1/users/:id", description: "Modifier un utilisateur (champs limités).", scope: "write",
      body: [
        { name: "full_name", type: "string", desc: "Nom complet" },
        { name: "avatar_url", type: "string", desc: "URL de l'avatar" },
      ],
      response: `{ "status": "success", "data": { ... } }`,
    },
  ],
  "Documents": [
    {
      method: "GET", path: "/v1/documents", description: "Liste les documents.", scope: "read",
      params: [
        { name: "category", type: "string", desc: "Filtrer par catégorie" },
        { name: "session_id", type: "uuid", desc: "Filtrer par session" },
      ],
      response: `{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "name": "Rapport annuel 2025.pdf",
      "category": "rapport",
      "mime_type": "application/pdf",
      "file_size": 2048576
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 67 }
}`,
    },
    { method: "GET", path: "/v1/documents/:id", description: "Détail d'un document.", scope: "read", response: `{ "status": "success", "data": { ... } }` },
    { method: "DELETE", path: "/v1/documents/:id", description: "Supprimer un document.", scope: "admin", response: `{ "status": "success", "data": { "deleted": true } }` },
  ],
  "Décisions": [
    {
      method: "GET", path: "/v1/decisions", description: "Liste les décisions.", scope: "read",
      params: [{ name: "statut", type: "string", desc: "Filtrer par statut" }, { name: "session_id", type: "uuid", desc: "Filtrer par session" }],
      response: `{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "texte": "Approbation du budget 2026",
      "numero_decision": "DEC-001",
      "statut": "adoptee",
      "vote_pour": 8, "vote_contre": 1, "vote_abstention": 1
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 23 }
}`,
    },
    { method: "GET", path: "/v1/decisions/:id", description: "Détail d'une décision.", scope: "read", response: `{ "status": "success", "data": { ... } }` },
    { method: "POST", path: "/v1/decisions", description: "Créer une décision.", scope: "write", body: [{ name: "texte", type: "string", desc: "Texte de la décision", required: true }, { name: "session_id", type: "uuid", desc: "Session associée", required: true }], response: `{ "status": "success", "data": { ... } }` },
    { method: "PUT", path: "/v1/decisions/:id", description: "Modifier une décision.", scope: "write", response: `{ "status": "success", "data": { ... } }` },
    { method: "DELETE", path: "/v1/decisions/:id", description: "Supprimer une décision.", scope: "admin", response: `{ "status": "success", "data": { "deleted": true } }` },
  ],
  "Membres": [
    {
      method: "GET", path: "/v1/members", description: "Liste les membres.", scope: "read",
      params: [{ name: "organ_id", type: "uuid", desc: "Filtrer par organe" }, { name: "is_active", type: "boolean", desc: "Filtrer actifs/inactifs" }],
      response: `{ "status": "success", "data": [...], "pagination": {...} }`,
    },
    { method: "GET", path: "/v1/members/:id", description: "Détail d'un membre.", scope: "read", response: `{ "status": "success", "data": { ... } }` },
    { method: "POST", path: "/v1/members", description: "Ajouter un membre.", scope: "write", body: [{ name: "full_name", type: "string", desc: "Nom", required: true }, { name: "organ_id", type: "uuid", desc: "Organe", required: true }], response: `{ "status": "success", "data": { ... } }` },
    { method: "PUT", path: "/v1/members/:id", description: "Modifier un membre.", scope: "write", response: `{ "status": "success", "data": { ... } }` },
    { method: "DELETE", path: "/v1/members/:id", description: "Supprimer un membre.", scope: "admin", response: `{ "status": "success", "data": { "deleted": true } }` },
  ],
  "Organes": [
    { method: "GET", path: "/v1/organs", description: "Liste les organes de gouvernance.", scope: "read", response: `{ "status": "success", "data": [...] }` },
    { method: "GET", path: "/v1/organs/:id", description: "Détail d'un organe.", scope: "read", response: `{ "status": "success", "data": { ... } }` },
  ],
  "Actions": [
    {
      method: "GET", path: "/v1/actions", description: "Liste les actions de suivi.", scope: "read",
      params: [{ name: "status", type: "string", desc: "Filtrer: en_cours, terminee, en_retard, annulee" }],
      response: `{ "status": "success", "data": [...], "pagination": {...} }`,
    },
    { method: "GET", path: "/v1/actions/:id", description: "Détail d'une action.", scope: "read", response: `{ "status": "success", "data": { ... } }` },
  ],
};

function EndpointCard({ ep }: { ep: Endpoint }) {
  const [expanded, setExpanded] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const tryIt = async () => {
    if (!apiKey) return;
    setLoading(true);
    try {
      const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/public-api` + ep.path.replace("/:id", "");
      const res = await fetch(url, {
        method: ep.method === "DELETE" ? "GET" : ep.method === "PUT" ? "GET" : ep.method === "POST" ? "GET" : "GET",
        headers: { "Authorization": `Bearer ${apiKey}` },
      });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setResult(`Erreur: ${e.message}`);
    }
    setLoading(false);
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors" onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />}
        <span className={`font-mono text-xs font-bold px-2 py-1 rounded border ${methodColors[ep.method] || ""}`}>{ep.method}</span>
        <code className="text-sm font-medium text-foreground">{ep.path}</code>
        <Badge variant="outline" className="text-xs ml-2">{ep.scope}</Badge>
        <span className="text-sm text-muted-foreground ml-auto hidden sm:inline">{ep.description}</span>
      </button>
      {expanded && (
        <div className="border-t border-border p-4 space-y-4 bg-muted/20">
          <p className="text-sm text-muted-foreground sm:hidden">{ep.description}</p>
          {ep.params && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Paramètres de requête</h4>
              <div className="space-y-1.5">
                {ep.params.map((p) => (
                  <div key={p.name} className="flex items-center gap-2 text-sm">
                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{p.name}</code>
                    <Badge variant="outline" className="text-xs">{p.type}</Badge>
                    {p.required && <Badge variant="destructive" className="text-xs">requis</Badge>}
                    <span className="text-muted-foreground">{p.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {ep.body && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Corps de la requête (JSON)</h4>
              <div className="space-y-1.5">
                {ep.body.map((p) => (
                  <div key={p.name} className="flex items-center gap-2 text-sm">
                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{p.name}</code>
                    <Badge variant="outline" className="text-xs">{p.type}</Badge>
                    {p.required && <Badge variant="destructive" className="text-xs">requis</Badge>}
                    <span className="text-muted-foreground">{p.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <h4 className="text-sm font-semibold mb-2">Exemple de réponse</h4>
            <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto max-h-48 font-mono">{ep.response}</pre>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><Play className="w-4 h-4" />Tester (GET uniquement)</h4>
            <div className="flex gap-2">
              <Input placeholder="Votre clé API (gb_...)" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="font-mono text-xs" />
              <Button onClick={tryIt} disabled={loading || !apiKey} size="sm">{loading ? "..." : "Exécuter"}</Button>
            </div>
            {result && <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto max-h-64 mt-2 font-mono">{result}</pre>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ApiDocs() {
  const copyBase = () => {
    navigator.clipboard.writeText(API_BASE);
    showSuccess("copied", "URL copiée.");
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/api-keys">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            Documentation API v1
          </h1>
          <p className="text-muted-foreground">Référence complète de l'API publique GrigraBoard</p>
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <Shield className="w-8 h-8 text-primary shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm">Authentification</h3>
              <p className="text-xs text-muted-foreground mt-1">Bearer token via clé API. Scopes : read, write, admin.</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <Zap className="w-8 h-8 text-primary shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm">Rate Limiting</h3>
              <p className="text-xs text-muted-foreground mt-1">100 requêtes/minute par clé. Headers X-RateLimit-* inclus.</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <Globe className="w-8 h-8 text-primary shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm">Versioning</h3>
              <p className="text-xs text-muted-foreground mt-1">Version actuelle : v1. Préfixe /v1/ dans tous les chemins.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick start */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Code2 className="w-5 h-5" /> Démarrage rapide</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold mb-1">Base URL</h3>
            <div className="flex items-center gap-2">
              <code className="bg-muted px-3 py-2 rounded text-sm flex-1 break-all font-mono">{API_BASE}</code>
              <Button size="icon" variant="outline" onClick={copyBase}><Copy className="w-4 h-4" /></Button>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-1">Authentification</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Incluez votre clé API dans l'en-tête <code className="bg-muted px-1 py-0.5 rounded font-mono">Authorization</code>.
            </p>
            <pre className="bg-muted p-3 rounded-lg text-xs font-mono overflow-x-auto">{`curl -X GET "${API_BASE}/meetings" \\
  -H "Authorization: Bearer gb_votre_cle_api" \\
  -H "Content-Type: application/json"`}</pre>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-1">Créer une ressource (POST)</h3>
            <pre className="bg-muted p-3 rounded-lg text-xs font-mono overflow-x-auto">{`curl -X POST "${API_BASE}/meetings" \\
  -H "Authorization: Bearer gb_votre_cle_api" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Session Q2 2026",
    "session_date": "2026-06-15T10:00:00Z",
    "organ_id": "votre_organ_uuid"
  }'`}</pre>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-semibold mb-1">Format des réponses</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">✅ Succès :</p>
                  <pre className="bg-muted p-2 rounded text-xs font-mono">{`{ "status": "success", "data": {...} }`}</pre>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">❌ Erreur :</p>
                  <pre className="bg-muted p-2 rounded text-xs font-mono">{`{ "status": "error", "message": "..." }`}</pre>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-1">Codes HTTP</h3>
              <div className="grid grid-cols-2 gap-1.5 text-sm">
                <div className="flex items-center gap-2"><Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">200</Badge><span>Succès</span></div>
                <div className="flex items-center gap-2"><Badge className="bg-blue-500/15 text-blue-700 border-blue-500/30">201</Badge><span>Créé</span></div>
                <div className="flex items-center gap-2"><Badge variant="destructive">401</Badge><span>Non autorisé</span></div>
                <div className="flex items-center gap-2"><Badge variant="destructive">403</Badge><span>Interdit</span></div>
                <div className="flex items-center gap-2"><Badge variant="destructive">404</Badge><span>Introuvable</span></div>
                <div className="flex items-center gap-2"><Badge variant="destructive">429</Badge><span>Rate limit</span></div>
                <div className="flex items-center gap-2"><Badge variant="destructive">500</Badge><span>Erreur serveur</span></div>
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-1">Scopes des clés API</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
              <div className="p-2 bg-muted rounded-lg">
                <Badge variant="secondary" className="mb-1">read</Badge>
                <p className="text-xs text-muted-foreground">Lecture seule sur toutes les ressources.</p>
              </div>
              <div className="p-2 bg-muted rounded-lg">
                <Badge variant="default" className="mb-1">write</Badge>
                <p className="text-xs text-muted-foreground">Lecture + création/modification.</p>
              </div>
              <div className="p-2 bg-muted rounded-lg">
                <Badge variant="destructive" className="mb-1">admin</Badge>
                <p className="text-xs text-muted-foreground">Accès complet incluant suppression.</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Key className="w-4 h-4 text-primary" />
            <Link to="/api-keys" className="text-sm text-primary hover:underline">Gérer vos clés API →</Link>
          </div>
        </CardContent>
      </Card>

      {/* Endpoints */}
      <Tabs defaultValue="Réunions">
        <TabsList className="flex-wrap h-auto gap-1">
          {Object.keys(endpoints).map((cat) => (
            <TabsTrigger key={cat} value={cat} className="text-xs">{cat}</TabsTrigger>
          ))}
        </TabsList>
        {Object.entries(endpoints).map(([cat, eps]) => (
          <TabsContent key={cat} value={cat} className="space-y-3 mt-4">
            {eps.map((ep, i) => (
              <EndpointCard key={i} ep={ep} />
            ))}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
