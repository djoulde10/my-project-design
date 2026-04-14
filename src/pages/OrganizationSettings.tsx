import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/hooks/usePermissions";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useCompanyBranding } from "@/hooks/useCompanyBranding";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Building2, Palette, Upload, X, Save, Eye, FileText, Sparkles, RotateCcw, Sun, Moon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface CompanySettings {
  nom: string;
  logo_url: string | null;
  couleur_principale: string | null;
  couleur_secondaire: string | null;
  couleur_accent: string | null;
  couleur_fond: string | null;
  couleur_sidebar: string | null;
  couleur_carte: string | null;
  platform_name: string | null;
}

const THEME_PRESETS = [
  {
    name: "Océan Profond",
    emoji: "🌊",
    primary: "#1e40af",
    secondary: "#6b7280",
    accent: "#f59e0b",
    background: "#f0f4f8",
    sidebar: "#0f172a",
    card: "#ffffff",
  },
  {
    name: "Forêt Émeraude",
    emoji: "🌿",
    primary: "#047857",
    secondary: "#6b7280",
    accent: "#d97706",
    background: "#f0fdf4",
    sidebar: "#052e16",
    card: "#ffffff",
  },
  {
    name: "Crépuscule Violet",
    emoji: "🌆",
    primary: "#7c3aed",
    secondary: "#8b5cf6",
    accent: "#f472b6",
    background: "#faf5ff",
    sidebar: "#1e1b4b",
    card: "#ffffff",
  },
  {
    name: "Sunset Doré",
    emoji: "🌅",
    primary: "#b45309",
    secondary: "#92400e",
    accent: "#dc2626",
    background: "#fffbeb",
    sidebar: "#451a03",
    card: "#ffffff",
  },
  {
    name: "Bordeaux Élégant",
    emoji: "🍷",
    primary: "#991b1b",
    secondary: "#78350f",
    accent: "#ca8a04",
    background: "#fef2f2",
    sidebar: "#450a0a",
    card: "#ffffff",
  },
  {
    name: "Bleu Nuit",
    emoji: "🌙",
    primary: "#1e3a5f",
    secondary: "#475569",
    accent: "#38bdf8",
    background: "#f1f5f9",
    sidebar: "#0c1524",
    card: "#ffffff",
  },
  {
    name: "Anthracite Moderne",
    emoji: "⚡",
    primary: "#334155",
    secondary: "#64748b",
    accent: "#06b6d4",
    background: "#f8fafc",
    sidebar: "#0f172a",
    card: "#ffffff",
  },
  {
    name: "Rose Poudré",
    emoji: "🌸",
    primary: "#be185d",
    secondary: "#9d174d",
    accent: "#7c3aed",
    background: "#fdf2f8",
    sidebar: "#500724",
    card: "#ffffff",
  },
];

function ColorSwatch({
  color,
  selected,
  onClick,
  size = "md",
}: {
  color: string;
  selected?: boolean;
  onClick?: () => void;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "w-7 h-7" : "w-10 h-10";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${dim} rounded-xl shadow-sm border-2 transition-all duration-200 hover:scale-110 active:scale-95 ${
        selected
          ? "border-foreground ring-2 ring-ring ring-offset-2 ring-offset-background scale-110"
          : "border-transparent hover:border-muted-foreground/30"
      }`}
      style={{ backgroundColor: color }}
    />
  );
}

function ColorControl({
  label,
  description,
  value,
  onChange,
  quickColors,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
  quickColors?: string[];
}) {
  return (
    <div className="space-y-3 p-4 rounded-xl bg-muted/30 border border-border/50">
      <div>
        <Label className="text-sm font-semibold">{label}</Label>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      {quickColors && (
        <div className="flex flex-wrap gap-1.5">
          {quickColors.map((c) => (
            <ColorSwatch key={c} color={c} selected={value === c} onClick={() => onChange(c)} size="sm" />
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-10 h-10 rounded-xl border border-border cursor-pointer appearance-none"
            style={{ backgroundColor: value }}
          />
        </div>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-28 font-mono text-sm"
          maxLength={7}
        />
        <div className="w-full h-2 rounded-full" style={{ backgroundColor: value }} />
      </div>
    </div>
  );
}

export default function OrganizationSettings() {
  const { user } = useAuth();
  const companyId = useCompanyId();
  const { invalidateCache } = useCompanyBranding();
  const { hasPermission } = usePermissions();
  const { prefs: userPrefs, savePrefs, invalidate: invalidateUserPrefs } = useUserPreferences();
  const isAdmin = hasPermission("gerer_utilisateurs");
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
  const [bgColor, setBgColor] = useState("#f0f4f8");
  const [sidebarColor, setSidebarColor] = useState("#0f172a");
  const [cardColor, setCardColor] = useState("#ffffff");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    loadSettings();
  }, [companyId]);

  // Once user prefs load, override color state with user's personal choices
  const [userPrefsApplied, setUserPrefsApplied] = useState(false);
  useEffect(() => {
    if (userPrefsApplied) return;
    if (!userPrefs) return;
    const hasAny = userPrefs.couleur_principale || userPrefs.couleur_secondaire || userPrefs.couleur_accent || userPrefs.couleur_fond || userPrefs.couleur_sidebar || userPrefs.couleur_carte;
    if (hasAny) {
      if (userPrefs.couleur_principale) setPrimaryColor(userPrefs.couleur_principale);
      if (userPrefs.couleur_secondaire) setSecondaryColor(userPrefs.couleur_secondaire);
      if (userPrefs.couleur_accent) setAccentColor(userPrefs.couleur_accent);
      if (userPrefs.couleur_fond) setBgColor(userPrefs.couleur_fond);
      if (userPrefs.couleur_sidebar) setSidebarColor(userPrefs.couleur_sidebar);
      if (userPrefs.couleur_carte) setCardColor(userPrefs.couleur_carte);
      setUserPrefsApplied(true);
    }
  }, [userPrefs]);

  async function loadSettings() {
    setLoading(true);
    const { data, error } = await supabase
      .from("companies")
      .select("nom, logo_url, couleur_principale, couleur_secondaire, couleur_accent, couleur_fond, couleur_sidebar, couleur_carte, platform_name")
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
    setBgColor(s.couleur_fond ?? "#f0f4f8");
    setSidebarColor(s.couleur_sidebar ?? "#0f172a");
    setCardColor(s.couleur_carte ?? "#ffffff");
    setLogoUrl(s.logo_url);
    setLogoPreview(s.logo_url);
    setLoading(false);
  }

  function applyPreset(preset: (typeof THEME_PRESETS)[0]) {
    setPrimaryColor(preset.primary);
    setSecondaryColor(preset.secondary);
    setAccentColor(preset.accent);
    setBgColor(preset.background);
    setSidebarColor(preset.sidebar);
    setCardColor(preset.card);
    setActivePreset(preset.name);
    toast.success(`Thème "${preset.name}" appliqué`);
  }

  function resetToDefault() {
    setPrimaryColor("#1e40af");
    setSecondaryColor("#6b7280");
    setAccentColor("#f59e0b");
    setBgColor("#f0f4f8");
    setSidebarColor("#0f172a");
    setCardColor("#ffffff");
    setActivePreset(null);
    toast.info("Couleurs réinitialisées par défaut");
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;
    if (!file.type.startsWith("image/")) { toast.error("Veuillez sélectionner un fichier image"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Le fichier ne doit pas dépasser 2 Mo"); return; }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const filePath = `${companyId}/logo.${ext}`;
    const { error } = await supabase.storage.from("company-logos").upload(filePath, file, { upsert: true });
    if (error) { toast.error("Échec du téléchargement du logo"); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("company-logos").getPublicUrl(filePath);
    const url = urlData.publicUrl + "?t=" + Date.now();
    setLogoUrl(url);
    setLogoPreview(url);
    setUploading(false);
    toast.success("Logo téléchargé");
  }

  function removeLogo() { setLogoUrl(null); setLogoPreview(null); }

  async function handleSave() {
    if (!companyId) return;
    setSaving(true);

    let error: any = null;

    if (isAdmin) {
      // Admins can update everything including logo and platform name
      const res = await supabase
        .from("companies")
        .update({
          platform_name: platformName.trim() || null,
          couleur_principale: primaryColor,
          couleur_secondaire: secondaryColor,
          couleur_accent: accentColor,
          couleur_fond: bgColor,
          couleur_sidebar: sidebarColor,
          couleur_carte: cardColor,
          logo_url: logoUrl,
        } as any)
        .eq("id", companyId);
      error = res.error;
    } else {
      // Non-admins can only update colors via secure RPC
      const res = await supabase.rpc("update_company_colors", {
        _couleur_principale: primaryColor,
        _couleur_secondaire: secondaryColor,
        _couleur_accent: accentColor,
        _couleur_fond: bgColor,
        _couleur_sidebar: sidebarColor,
        _couleur_carte: cardColor,
      });
      error = res.error;
    }

    if (error) {
      toast.error("Erreur lors de la sauvegarde");
    } else {
      toast.success("Paramètres enregistrés avec succès !");
      invalidateCache();
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

  const PRIMARY_QUICK = ["#1e40af", "#4338ca", "#7c3aed", "#047857", "#991b1b", "#b45309", "#1e3a5f", "#be185d"];
  const SECONDARY_QUICK = ["#6b7280", "#475569", "#64748b", "#78716c", "#9ca3af", "#8b5cf6", "#92400e", "#9d174d"];
  const ACCENT_QUICK = ["#f59e0b", "#06b6d4", "#f472b6", "#38bdf8", "#dc2626", "#d97706", "#ca8a04", "#10b981"];
  const BG_QUICK = ["#f0f4f8", "#f0fdf4", "#faf5ff", "#fffbeb", "#fef2f2", "#f1f5f9", "#f8fafc", "#fdf2f8"];
  const SIDEBAR_QUICK = ["#0f172a", "#052e16", "#1e1b4b", "#451a03", "#450a0a", "#0c1524", "#18181b", "#500724"];
  const CARD_QUICK = ["#ffffff", "#fafafa", "#f9fafb", "#fefefe", "#f8f9fa", "#fff", "#fefce8", "#fef7ff"];

  return (
    <div className="p-6 lg:p-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-['Space_Grotesk'] text-foreground">
            Personnalisation & Branding
          </h1>
          <p className="text-muted-foreground mt-1">
            Personnalisez l'apparence complète de votre plateforme
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={resetToDefault} className="gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" />
            Réinitialiser
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            <Save className="w-4 h-4" />
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </div>

      {/* Logo + Platform name row (admin only) */}
      {isAdmin && (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="w-4 h-4 text-primary" />
              Logo de l'organisation
            </CardTitle>
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
                    <X className="w-3 h-3 mr-1" /> Supprimer
                  </Button>
                )}
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="w-4 h-4 text-primary" />
              Nom de la plateforme
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              placeholder={settings?.nom ?? "GovBoard"}
              maxLength={60}
            />
            <p className="text-xs text-muted-foreground">
              Affiché dans la navigation, les en-têtes et les documents générés.
            </p>
          </CardContent>
        </Card>
      </div>
      )}

      {/* Theme presets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-accent" />
            Thèmes prédéfinis
          </CardTitle>
          <CardDescription>
            Choisissez un thème complet en un clic ou personnalisez chaque couleur manuellement
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {THEME_PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset)}
                className={`group relative p-3 rounded-xl border-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] text-left ${
                  activePreset === preset.name
                    ? "border-foreground shadow-lg"
                    : "border-border hover:border-muted-foreground/40 hover:shadow-md"
                }`}
              >
                {activePreset === preset.name && (
                  <Badge className="absolute -top-2 -right-2 text-[10px] px-1.5 py-0.5">Actif</Badge>
                )}
                {/* Color strip preview */}
                <div className="flex gap-0.5 rounded-lg overflow-hidden h-8 mb-2">
                  <div className="flex-1" style={{ backgroundColor: preset.sidebar }} />
                  <div className="flex-1" style={{ backgroundColor: preset.primary }} />
                  <div className="flex-1" style={{ backgroundColor: preset.accent }} />
                  <div className="flex-1" style={{ backgroundColor: preset.background }} />
                </div>
                <p className="text-xs font-semibold">
                  {preset.emoji} {preset.name}
                </p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detailed color controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="w-4 h-4 text-primary" />
            Personnalisation avancée des couleurs
          </CardTitle>
          <CardDescription>
            Modifiez chaque couleur individuellement pour un contrôle total de l'apparence
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="brand" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="brand">🎨 Marque</TabsTrigger>
              <TabsTrigger value="layout">📐 Interface</TabsTrigger>
              <TabsTrigger value="surfaces">🖼️ Surfaces</TabsTrigger>
            </TabsList>

            <TabsContent value="brand" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <ColorControl
                  label="Couleur principale"
                  description="Boutons, liens, éléments actifs"
                  value={primaryColor}
                  onChange={(v) => { setPrimaryColor(v); setActivePreset(null); }}
                  quickColors={PRIMARY_QUICK}
                />
                <ColorControl
                  label="Couleur secondaire"
                  description="Éléments secondaires, badges"
                  value={secondaryColor}
                  onChange={(v) => { setSecondaryColor(v); setActivePreset(null); }}
                  quickColors={SECONDARY_QUICK}
                />
                <ColorControl
                  label="Couleur d'accent"
                  description="Alertes, notifications, highlights"
                  value={accentColor}
                  onChange={(v) => { setAccentColor(v); setActivePreset(null); }}
                  quickColors={ACCENT_QUICK}
                />
              </div>
            </TabsContent>

            <TabsContent value="layout" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <ColorControl
                  label="Barre latérale"
                  description="Fond du menu de navigation principal"
                  value={sidebarColor}
                  onChange={(v) => { setSidebarColor(v); setActivePreset(null); }}
                  quickColors={SIDEBAR_QUICK}
                />
                <ColorControl
                  label="Fond de page"
                  description="Arrière-plan général de toute l'application"
                  value={bgColor}
                  onChange={(v) => { setBgColor(v); setActivePreset(null); }}
                  quickColors={BG_QUICK}
                />
              </div>
            </TabsContent>

            <TabsContent value="surfaces" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <ColorControl
                  label="Fond des cartes"
                  description="Arrière-plan des cartes, panneaux et modales"
                  value={cardColor}
                  onChange={(v) => { setCardColor(v); setActivePreset(null); }}
                  quickColors={CARD_QUICK}
                />
                <div className="p-4 rounded-xl bg-muted/30 border border-border/50 flex flex-col items-center justify-center gap-3">
                  <div className="text-3xl">🎨</div>
                  <p className="text-sm text-muted-foreground text-center">
                    D'autres options de personnalisation seront bientôt disponibles !
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Live preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Eye className="w-4 h-4 text-muted-foreground" />
            Aperçu en temps réel
          </CardTitle>
          <CardDescription>Visualisez le rendu de votre personnalisation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Full app preview */}
          <div className="rounded-xl border border-border overflow-hidden shadow-lg">
            {/* Mini app simulation */}
            <div className="flex h-64">
              {/* Sidebar preview */}
              <div className="w-48 shrink-0 p-3 flex flex-col gap-2" style={{ backgroundColor: sidebarColor }}>
                <div className="flex items-center gap-2 mb-3">
                  {logoPreview ? (
                    <img src={logoPreview} alt="" className="w-7 h-7 object-contain rounded" />
                  ) : (
                    <div className="w-7 h-7 rounded flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
                      <Building2 className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                  <span className="text-xs font-semibold text-white/90 truncate">
                    {platformName || settings?.nom || "GovBoard"}
                  </span>
                </div>
                {["Tableau de bord", "Sessions", "Procès-verbaux", "Documents"].map((item, i) => (
                  <div
                    key={item}
                    className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors"
                    style={{
                      backgroundColor: i === 0 ? `${primaryColor}22` : "transparent",
                      color: i === 0 ? primaryColor : "rgba(255,255,255,0.6)",
                    }}
                  >
                    {item}
                  </div>
                ))}
              </div>
              {/* Main content area */}
              <div className="flex-1 p-4 space-y-3" style={{ backgroundColor: bgColor }}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold" style={{ color: primaryColor }}>Tableau de bord</h3>
                  <div className="px-3 py-1 rounded-lg text-[10px] font-medium text-white" style={{ backgroundColor: primaryColor }}>
                    Nouvelle session
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Sessions", val: "12" },
                    { label: "Décisions", val: "48" },
                    { label: "Réalisation", val: "87%" },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-lg p-2.5 shadow-sm border border-black/5" style={{ backgroundColor: cardColor }}>
                      <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                      <p className="text-base font-bold" style={{ color: primaryColor }}>{stat.val}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg p-3 shadow-sm border border-black/5" style={{ backgroundColor: cardColor }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }} />
                    <p className="text-[10px] font-semibold">Prochaine réunion</p>
                  </div>
                  <div className="h-1.5 w-3/4 rounded-full" style={{ background: `linear-gradient(90deg, ${primaryColor}, ${accentColor})` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Document preview */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Aperçu document</p>
            <div className="rounded-xl border border-border p-6 space-y-3" style={{ backgroundColor: cardColor }}>
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
                  Date : 14/04/2026<br />
                  Réf : CA-2026-03
                </div>
              </div>
              <h2 className="text-sm font-bold" style={{ color: primaryColor }}>
                PROCÈS-VERBAL DU CONSEIL D'ADMINISTRATION
              </h2>
              <div className="h-2 w-full rounded-full" style={{ background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor}, ${accentColor})` }} />
              <p className="text-xs text-muted-foreground">
                Cet aperçu illustre le rendu de vos couleurs sur les documents exportés.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bottom save */}
      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2">
          <Save className="w-4 h-4" />
          {saving ? "Enregistrement…" : "Enregistrer toutes les modifications"}
        </Button>
      </div>
    </div>
  );
}
