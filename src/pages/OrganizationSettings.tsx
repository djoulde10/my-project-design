import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useCompanyId } from "@/hooks/useCompanyId";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Building2, Palette, Upload, X, Save, Eye } from "lucide-react";

interface CompanySettings {
  nom: string;
  logo_url: string | null;
  couleur_principale: string | null;
  platform_name: string | null;
}

const COLOR_PRESETS = [
  { label: "Bleu royal", value: "#1e40af" },
  { label: "Indigo", value: "#4338ca" },
  { label: "Émeraude", value: "#047857" },
  { label: "Bordeaux", value: "#991b1b" },
  { label: "Marine", value: "#1e3a5f" },
  { label: "Doré", value: "#b45309" },
  { label: "Violet", value: "#6d28d9" },
  { label: "Ardoise", value: "#334155" },
];

export default function OrganizationSettings() {
  const { user } = useAuth();
  const companyId = useCompanyId();
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [platformName, setPlatformName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#1e40af");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    loadSettings();
  }, [companyId]);

  async function loadSettings() {
    setLoading(true);
    const { data, error } = await supabase
      .from("companies")
      .select("nom, logo_url, couleur_principale, platform_name")
      .eq("id", companyId!)
      .single();

    if (error) {
      toast.error("Impossible de charger les paramètres");
      setLoading(false);
      return;
    }

    setSettings(data);
    setPlatformName(data.platform_name ?? data.nom ?? "");
    setPrimaryColor(data.couleur_principale ?? "#1e40af");
    setLogoUrl(data.logo_url);
    setLogoPreview(data.logo_url);
    setLoading(false);
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez sélectionner un fichier image");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Le fichier ne doit pas dépasser 2 Mo");
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const filePath = `${companyId}/logo.${ext}`;

    const { error } = await supabase.storage
      .from("company-logos")
      .upload(filePath, file, { upsert: true });

    if (error) {
      toast.error("Échec du téléchargement du logo");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("company-logos")
      .getPublicUrl(filePath);

    const url = urlData.publicUrl + "?t=" + Date.now();
    setLogoUrl(url);
    setLogoPreview(url);
    setUploading(false);
    toast.success("Logo téléchargé");
  }

  function removeLogo() {
    setLogoUrl(null);
    setLogoPreview(null);
  }

  async function handleSave() {
    if (!companyId) return;
    setSaving(true);

    const { error } = await supabase
      .from("companies")
      .update({
        platform_name: platformName.trim() || null,
        couleur_principale: primaryColor,
        logo_url: logoUrl,
      })
      .eq("id", companyId);

    if (error) {
      toast.error("Erreur lors de la sauvegarde");
    } else {
      toast.success("Paramètres enregistrés avec succès");
      loadSettings();
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-10 flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Chargement des paramètres…</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold font-['Space_Grotesk'] text-foreground">
          Personnalisation
        </h1>
        <p className="text-muted-foreground mt-1">
          Personnalisez l'apparence de la plateforme pour votre organisation
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Logo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="w-4 h-4 text-primary" />
              Logo de l'organisation
            </CardTitle>
            <CardDescription>
              Formats acceptés : PNG, JPG, SVG — Max 2 Mo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-6">
              <div
                className="w-24 h-24 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden shrink-0 cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Logo"
                    className="w-full h-full object-contain p-2"
                  />
                ) : (
                  <Building2 className="w-8 h-8 text-muted-foreground/40" />
                )}
              </div>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? "Envoi…" : "Choisir un fichier"}
                </Button>
                {logoPreview && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={removeLogo}
                    className="text-destructive hover:text-destructive"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Supprimer
                  </Button>
                )}
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
            />
          </CardContent>
        </Card>

        {/* Platform name */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="w-4 h-4 text-primary" />
              Nom de la plateforme
            </CardTitle>
            <CardDescription>
              Ce nom sera affiché dans la barre latérale et les en-têtes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="platform-name">Nom personnalisé</Label>
              <Input
                id="platform-name"
                value={platformName}
                onChange={(e) => setPlatformName(e.target.value)}
                placeholder={settings?.nom ?? "GovBoard"}
                maxLength={40}
              />
              <p className="text-xs text-muted-foreground">
                Laissez vide pour utiliser le nom par défaut
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Colors */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Palette className="w-4 h-4 text-primary" />
              Couleur principale
            </CardTitle>
            <CardDescription>
              Définissez la couleur d'accentuation utilisée dans l'interface
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-3">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => setPrimaryColor(preset.value)}
                  className={`group flex flex-col items-center gap-1.5 transition-transform ${
                    primaryColor === preset.value ? "scale-110" : "hover:scale-105"
                  }`}
                  title={preset.label}
                >
                  <div
                    className={`w-10 h-10 rounded-lg shadow-sm border-2 transition-all ${
                      primaryColor === preset.value
                        ? "border-foreground ring-2 ring-ring ring-offset-2 ring-offset-background"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: preset.value }}
                  />
                  <span className="text-[10px] text-muted-foreground">{preset.label}</span>
                </button>
              ))}
            </div>

            <Separator />

            <div className="flex items-center gap-4">
              <Label htmlFor="custom-color" className="shrink-0">Couleur personnalisée</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="custom-color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-border cursor-pointer"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-28 font-mono text-sm"
                  maxLength={7}
                />
              </div>
            </div>

            {/* Live preview */}
            <div className="rounded-xl border border-border bg-muted/20 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Aperçu</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border">
                {logoPreview ? (
                  <img src={logoPreview} alt="" className="w-8 h-8 object-contain rounded" />
                ) : (
                  <div
                    className="w-8 h-8 rounded flex items-center justify-center"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <Building2 className="w-4 h-4 text-white" />
                  </div>
                )}
                <span className="font-semibold text-sm font-['Space_Grotesk'] text-foreground">
                  {platformName || settings?.nom || "GovBoard"}
                </span>
              </div>
              <div className="flex gap-2">
                <div
                  className="px-4 py-2 rounded-lg text-white text-xs font-medium"
                  style={{ backgroundColor: primaryColor }}
                >
                  Bouton principal
                </div>
                <div
                  className="px-4 py-2 rounded-lg text-xs font-medium border"
                  style={{ borderColor: primaryColor, color: primaryColor }}
                >
                  Bouton secondaire
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save bar */}
      <div className="flex justify-end pt-4">
        <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2">
          <Save className="w-4 h-4" />
          {saving ? "Enregistrement…" : "Enregistrer les modifications"}
        </Button>
      </div>
    </div>
  );
}
