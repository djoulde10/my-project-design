import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ToggleRight, Building2 } from "lucide-react";
import { useAdminAuditLog } from "@/hooks/useAdminAuditLog";

const FEATURE_KEYS = [
  { key: "ai_assistant", label: "Assistant IA", description: "Accès à l'assistant IA conversationnel" },
  { key: "ai_analysis", label: "Analyse IA des réunions", description: "Analyse automatique des procès-verbaux" },
  { key: "tts", label: "Synthèse vocale (TTS)", description: "Lecture audio des PV" },
  { key: "pdf_export", label: "Export PDF", description: "Génération de documents PDF" },
  { key: "signatures", label: "Signatures électroniques", description: "Signatures des procès-verbaux" },
  { key: "advanced_analytics", label: "Analytics avancés", description: "Tableaux de bord et statistiques détaillées" },
  { key: "conflict_management", label: "Gestion des conflits d'intérêts", description: "Module conflits d'intérêts" },
  { key: "approval_workflow", label: "Workflow d'approbation", description: "Processus d'approbation des PV" },
];

export default function AdminFeatureFlags() {
  const { logAdminAction } = useAdminAuditLog();
  const [orgs, setOrgs] = useState<any[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>("");
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("companies").select("id, nom, statut").order("nom").then(({ data }) => {
      setOrgs(data ?? []);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selectedOrg) { setFlags({}); return; }
    supabase.from("feature_flags").select("feature_key, enabled").eq("company_id", selectedOrg).then(({ data }) => {
      const map: Record<string, boolean> = {};
      (data ?? []).forEach(f => { map[f.feature_key] = f.enabled; });
      setFlags(map);
    });
  }, [selectedOrg]);

  const toggleFlag = async (key: string, enabled: boolean) => {
    setSaving(true);
    const { error } = await supabase.from("feature_flags").upsert(
      { company_id: selectedOrg, feature_key: key, enabled, updated_at: new Date().toISOString() },
      { onConflict: "company_id,feature_key" }
    );
    if (error) { toast.error("Erreur: " + error.message); setSaving(false); return; }
    setFlags(f => ({ ...f, [key]: enabled }));
    toast.success(`${key} ${enabled ? "activé" : "désactivé"}`);
    setSaving(false);
  };

  const enableAll = async () => {
    setSaving(true);
    const inserts = FEATURE_KEYS.map(f => ({
      company_id: selectedOrg, feature_key: f.key, enabled: true, updated_at: new Date().toISOString(),
    }));
    await supabase.from("feature_flags").upsert(inserts, { onConflict: "company_id,feature_key" });
    const map: Record<string, boolean> = {};
    FEATURE_KEYS.forEach(f => { map[f.key] = true; });
    setFlags(map);
    toast.success("Toutes les fonctionnalités activées");
    setSaving(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Chargement...</div>;

  return (
    <div className="p-4 lg:p-8 space-y-6 overflow-y-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-['Space_Grotesk']">Feature Flags</h1>
        <p className="text-muted-foreground text-sm mt-1">Activer/désactiver des fonctionnalités par organisation</p>
      </div>

      <div className="flex items-center gap-3">
        <Select value={selectedOrg} onValueChange={setSelectedOrg}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Sélectionner une organisation" />
          </SelectTrigger>
          <SelectContent>
            {orgs.map(o => (
              <SelectItem key={o.id} value={o.id}>
                <div className="flex items-center gap-2">
                  <Building2 className="w-3 h-3" /> {o.nom}
                  <Badge variant={o.statut === "actif" ? "default" : "destructive"} className="text-[10px] ml-1">{o.statut}</Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedOrg && (
          <Button variant="outline" size="sm" onClick={enableAll} disabled={saving}>
            <ToggleRight className="w-4 h-4 mr-1" /> Tout activer
          </Button>
        )}
      </div>

      {!selectedOrg ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Sélectionnez une organisation pour gérer ses fonctionnalités</CardContent></Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {FEATURE_KEYS.map(feat => (
            <Card key={feat.key}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{feat.label}</p>
                  <p className="text-xs text-muted-foreground">{feat.description}</p>
                </div>
                <Switch
                  checked={flags[feat.key] ?? false}
                  onCheckedChange={v => toggleFlag(feat.key, v)}
                  disabled={saving}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
