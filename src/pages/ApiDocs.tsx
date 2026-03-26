import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Play, Copy, ChevronDown, ChevronRight, Key, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { showSuccess } from "@/lib/toastHelpers";

const API_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/public-api`;

interface Endpoint {
  method: string;
  path: string;
  description: string;
  params?: { name: string; type: string; desc: string }[];
  response: string;
}

const endpoints: Record<string, Endpoint[]> = {
  Sessions: [
    {
      method: "GET", path: "/sessions", description: "Liste toutes les sessions de votre organisation.",
      params: [
        { name: "page", type: "integer", desc: "Numéro de page (défaut: 1)" },
        { name: "limit", type: "integer", desc: "Nombre par page (défaut: 20, max: 100)" },
      ],
      response: `{
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
    { method: "GET", path: "/sessions/:id", description: "Détail d'une session spécifique.", response: `{ "data": { "id": "uuid", "title": "...", ... } }` },
  ],
  "Procès-verbaux": [
    {
      method: "GET", path: "/minutes", description: "Liste tous les procès-verbaux.",
      params: [
        { name: "page", type: "integer", desc: "Numéro de page" },
        { name: "limit", type: "integer", desc: "Nombre par page" },
      ],
      response: `{
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
    { method: "GET", path: "/minutes/:id", description: "Détail d'un procès-verbal.", response: `{ "data": { ... } }` },
  ],
  Membres: [
    {
      method: "GET", path: "/members", description: "Liste tous les membres de vos organes.",
      response: `{
  "data": [
    {
      "id": "uuid",
      "full_name": "Jean Dupont",
      "email": "jean@example.com",
      "quality": "administrateur",
      "is_active": true,
      "titre_poste": "Directeur Financier"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 12 }
}`,
    },
    { method: "GET", path: "/members/:id", description: "Détail d'un membre.", response: `{ "data": { ... } }` },
  ],
  Documents: [
    {
      method: "GET", path: "/documents", description: "Liste tous les documents.",
      response: `{
  "data": [
    {
      "id": "uuid",
      "name": "Rapport annuel 2025.pdf",
      "category": "rapport",
      "mime_type": "application/pdf",
      "file_size": 2048576,
      "session_id": "uuid"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 67 }
}`,
    },
    { method: "GET", path: "/documents/:id", description: "Détail d'un document.", response: `{ "data": { ... } }` },
  ],
  Décisions: [
    {
      method: "GET", path: "/decisions", description: "Liste toutes les décisions.",
      response: `{
  "data": [
    {
      "id": "uuid",
      "texte": "Approbation du budget 2026",
      "numero_decision": "DEC-001",
      "statut": "adoptee",
      "vote_pour": 8,
      "vote_contre": 1,
      "vote_abstention": 1
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 23 }
}`,
    },
    { method: "GET", path: "/decisions/:id", description: "Détail d'une décision.", response: `{ "data": { ... } }` },
  ],
  Organes: [
    {
      method: "GET", path: "/organs", description: "Liste tous les organes de gouvernance.",
      response: `{
  "data": [
    { "id": "uuid", "name": "Conseil d'Administration", "type": "ca", "description": "..." }
  ]
}`,
    },
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
      const url = API_BASE + ep.path.replace("/:id", "");
      const res = await fetch(url, { headers: { "x-api-key": apiKey } });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setResult(`Erreur: ${e.message}`);
    }
    setLoading(false);
  };

  return (
    <div className="border rounded-lg">
      <button className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors" onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
        <Badge variant="secondary" className="font-mono text-xs">{ep.method}</Badge>
        <code className="text-sm font-medium">{ep.path}</code>
        <span className="text-sm text-muted-foreground ml-auto">{ep.description}</span>
      </button>
      {expanded && (
        <div className="border-t p-4 space-y-4">
          {ep.params && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Paramètres</h4>
              <div className="space-y-1">
                {ep.params.map((p) => (
                  <div key={p.name} className="flex items-center gap-2 text-sm">
                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{p.name}</code>
                    <Badge variant="outline" className="text-xs">{p.type}</Badge>
                    <span className="text-muted-foreground">{p.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <h4 className="text-sm font-semibold mb-2">Exemple de réponse</h4>
            <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto max-h-48">{ep.response}</pre>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><Play className="w-4 h-4" />Essayer</h4>
            <div className="flex gap-2">
              <Input placeholder="Votre clé API (gb_...)" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="font-mono text-xs" />
              <Button onClick={tryIt} disabled={loading || !apiKey} size="sm">
                {loading ? "..." : "Exécuter"}
              </Button>
            </div>
            {result && <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto max-h-64 mt-2">{result}</pre>}
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
      <div className="flex items-center gap-4">
        <Link to="/api-keys">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            Documentation API
          </h1>
          <p className="text-muted-foreground">Référence complète de l'API publique GrigraBoard</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Démarrage rapide</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold mb-1">URL de base</h3>
            <div className="flex items-center gap-2">
              <code className="bg-muted px-3 py-2 rounded text-sm flex-1 break-all">{API_BASE}</code>
              <Button size="icon" variant="outline" onClick={copyBase}><Copy className="w-4 h-4" /></Button>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-1">Authentification</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Toutes les requêtes nécessitent un en-tête <code className="bg-muted px-1 py-0.5 rounded">x-api-key</code> contenant votre clé API.
            </p>
            <pre className="bg-muted p-3 rounded-lg text-xs">{`curl -H "x-api-key: gb_votre_cle_api" \\
  ${API_BASE}/sessions`}</pre>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-1">Pagination</h3>
            <p className="text-sm text-muted-foreground">
              Les endpoints de liste supportent <code className="bg-muted px-1 py-0.5 rounded">?page=1&limit=20</code> (max 100 par page).
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-1">Codes de réponse</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <div className="flex items-center gap-2"><Badge variant="default">200</Badge><span>Succès</span></div>
              <div className="flex items-center gap-2"><Badge variant="destructive">401</Badge><span>Non autorisé</span></div>
              <div className="flex items-center gap-2"><Badge variant="destructive">403</Badge><span>Interdit</span></div>
              <div className="flex items-center gap-2"><Badge variant="destructive">500</Badge><span>Erreur serveur</span></div>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Key className="w-4 h-4 text-primary" />
            <Link to="/api-keys" className="text-sm text-primary hover:underline">Gérer vos clés API →</Link>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="Sessions">
        <TabsList className="flex-wrap h-auto">
          {Object.keys(endpoints).map((cat) => (
            <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
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
