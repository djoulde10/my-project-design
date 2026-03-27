import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useCompanyBranding } from "@/hooks/useCompanyBranding";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Building2, Palette, Upload, X, Save, Eye, FileText } from "lucide-react";

interface CompanySettings {
  nom: string;
  logo_url: string | null;
  couleur_principale: string | null;
  couleur_secondaire: string | null;
  couleur_accent: string | null;
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

function ColorPickerField({
  label,
  value,
  onChange,
  presets,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  presets?: typeof COLOR_PRESETS;
}) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">{label}</Label>
      {presets && (
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.value}
              onClick={() => onChange(p.value)}
              className={`group flex flex-col items-center gap-1 transition-transform ${
                value === p.value ? "scale-110" : "hover:scale-105"
              }`}
              title={p.label}
            >
              <div
                className={`w-8 h-8 rounded-lg shadow-sm border-2 transition-all ${
                  value === p.value
                    ? "border-foreground ring-2 ring-ring ring-offset-1 ring-offset-background"
                    : "border-transparent"
                }`}
                style={{ backgroundColor: p.value }}
              />
              <span className="text-[9px] text-muted-foreground">{p.label}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-9 h-9 rounded-lg border border-border cursor-pointer"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-28 font-mono text-sm"
          maxLength={7}
        />
      </div>
    </div>
  );
}

export default function OrganizationSettings() {
  const { user } = useAuth();
  const companyId = useCompanyId();
  const { invalidateCache } = useCompanyBranding();
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [platformName, setPlatformName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#1e40af");
  const [secondaryColor, setSecondaryColor] = useState("#6b7280");
  const [accentColor, setAccentColor] = useState("#f59e0b");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    loadSettings();
  }, [companyId]);

  async function loadSettings() {
    setLoading(true);
    const { data, error } = await supabase
      .from("companies")
      .select("nom, logo_url, couleur_principale, couleur_secondaire, couleur_accent, platform_name")
      .eq("id", companyId!)
      .single();

    if (error) {
      toast.error("Impossible de charger les paramètres");
      setLoading(false);
      return;
    }

    const s = data as any;
    setSettings(s);
    setPlatformName(s.platform_name ?? s.nom ?? "");
    setPrimaryColor(s.couleur_principale ?? "#1e40af");
    setSecondaryColor(s.couleur_secondaire ?? "#6b7280");
    setAccentColor(s.couleur_accent ?? "#f59e0b");
    setLogoUrl(s.logo_url);
    setLogoPreview(s.logo_url);
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
        couleur_secondaire: secondaryColor,
        couleur_accent: accentColor,
        logo_url: logoUrl,
      } as any)
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
          Personnalisation & Branding
        </h1>
        <p className="text-muted-foreground mt-1">
          Personnalisez l'apparence de la plateforme pour refléter l'identité de votre organisation
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
              Formats acceptés : PNG, JPG, SVG — Max 2 Mo. Affiché dans la navigation et les documents exportés.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-6">
              <div
                className="w-24 h-24 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden shrink-0 cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-2" />
                ) : (
                  <Building2 className="w-8 h-8 text-muted-foreground/40" />
                )}
              </div>
              <div className="space-y-2">
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? "Envoi…" : "Choisir un fichier"}
                </Button>
                {logoPreview && (
                  <Button variant="ghost" size="sm" onClick={removeLogo} className="text-destructive hover:text-destructive">
                    <X className="w-3 h-3 mr-1" />
                    Supprimer
                  </Button>
                )}
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
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
              Affiché dans la barre latérale, les en-têtes et les documents générés
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
                maxLength={60}
              />
              <p className="text-xs text-muted-foreground">
                Ex : « Espace Conseil – Ministère X » ou « Plateforme de gestion – Entreprise Y »
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Colors */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Palette className="w-4 h-4 text-primary" />
              Palette de couleurs
            </CardTitle>
            <CardDescription>
              Définissez les couleurs appliquées sur les boutons, menus et éléments interactifs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              <ColorPickerField
                label="Couleur principale"
                value={primaryColor}
                onChange={setPrimaryColor}
                presets={COLOR_PRESETS}
              />
              <ColorPickerField
                label="Couleur secondaire"
                value={secondaryColor}
                onChange={setSecondaryColor}
              />
              <ColorPickerField
                label="Couleur d'accent"
                value={accentColor}
                onChange={setAccentColor}
              />
            </div>
          </CardContent>
        </Card>

        {/* Live preview */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Eye className="w-4 h-4 text-muted-foreground" />
              Aperçu en temps réel
            </CardTitle>
            <CardDescription>Visualisez l'apparence de votre plateforme et de vos documents</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Navigation preview */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Barre de navigation</p>
              <div className="rounded-xl border border-border bg-sidebar p-4">
                <div className="flex items-center gap-3">
                  {logoPreview ? (
                    <img src={logoPreview} alt="" className="w-9 h-9 object-contain rounded-lg" />
                  ) : (
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
                      <Building2 className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <span className="font-semibold text-sm font-['Space_Grotesk'] text-sidebar-accent-foreground">
                    {platformName || settings?.nom || "GovBoard"}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <div className="px-4 py-2 rounded-lg text-white text-xs font-medium" style={{ backgroundColor: primaryColor }}>
                    Bouton principal
                  </div>
                  <div className="px-4 py-2 rounded-lg text-xs font-medium border" style={{ borderColor: secondaryColor, color: secondaryColor }}>
                    Bouton secondaire
                  </div>
                  <div className="px-4 py-2 rounded-lg text-white text-xs font-medium" style={{ backgroundColor: accentColor }}>
                    Accent
                  </div>
                </div>
              </div>
            </div>

            {/* Document preview */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Aperçu document (procès-verbal)</p>
              <div className="rounded-xl border border-border bg-card p-6 space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-3">
                    {logoPreview ? (
                      <img src={logoPreview} alt="" className="w-10 h-10 object-contain" />
                    ) : (
                      <div className="w-10 h-10 rounded flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
                        <FileText className="w-5 h-5 text-white" />
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-sm" style={{ color: primaryColor }}>
                        {platformName || settings?.nom || "GovBoard"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Procès-verbal de réunion</p>
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground text-right">
                    Date : 27/03/2026<br />
                    Réf : CA-2026-01
                  </div>
                </div>
                <h2 className="text-sm font-bold" style={{ color: primaryColor }}>
                  PROCÈS-VERBAL DU CONSEIL D'ADMINISTRATION
                </h2>
                <div className="h-2 w-full rounded-full" style={{ background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})` }} />
                <p className="text-xs text-muted-foreground">
                  Cet aperçu illustre comment le logo et les couleurs de votre organisation apparaîtront sur les documents exportés.
                </p>
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
