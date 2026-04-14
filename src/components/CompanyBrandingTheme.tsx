import { useEffect } from "react";
import { hexToHSL, useCompanyBranding } from "@/hooks/useCompanyBranding";
import { useUserPreferences } from "@/hooks/useUserPreferences";

const TOKEN_NAMES = [
  "--primary",
  "--ring",
  "--sidebar-primary",
  "--sidebar-ring",
  "--secondary",
  "--accent",
  "--background",
  "--sidebar-background",
  "--card",
  "--popover",
] as const;

function clearBrandingTokens(root: HTMLElement) {
  TOKEN_NAMES.forEach((token) => root.style.removeProperty(token));
}

export default function CompanyBrandingTheme() {
  const { branding } = useCompanyBranding();
  const { prefs } = useUserPreferences();

  useEffect(() => {
    const root = document.documentElement;
    clearBrandingTokens(root);

    // User prefs override company branding
    const primary = prefs.couleur_principale || branding.couleur_principale;
    const secondary = prefs.couleur_secondaire || branding.couleur_secondaire;
    const accent = prefs.couleur_accent || branding.couleur_accent;
    const fond = prefs.couleur_fond || branding.couleur_fond;
    const sidebar = prefs.couleur_sidebar || branding.couleur_sidebar;
    const carte = prefs.couleur_carte || branding.couleur_carte;

    if (primary) {
      const hsl = hexToHSL(primary);
      root.style.setProperty("--primary", hsl);
      root.style.setProperty("--ring", hsl);
      root.style.setProperty("--sidebar-primary", hsl);
      root.style.setProperty("--sidebar-ring", hsl);
    }

    if (secondary) {
      root.style.setProperty("--secondary", hexToHSL(secondary));
    }

    if (accent) {
      root.style.setProperty("--accent", hexToHSL(accent));
    }

    if (fond) {
      root.style.setProperty("--background", hexToHSL(fond));
    }

    if (sidebar) {
      root.style.setProperty("--sidebar-background", hexToHSL(sidebar));
    }

    if (carte) {
      const cardHsl = hexToHSL(carte);
      root.style.setProperty("--card", cardHsl);
      root.style.setProperty("--popover", cardHsl);
    }

    return () => {
      clearBrandingTokens(root);
    };
  }, [branding, prefs]);

  return null;
}
