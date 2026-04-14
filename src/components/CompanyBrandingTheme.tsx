import { useEffect } from "react";
import { hexToHSL, useCompanyBranding } from "@/hooks/useCompanyBranding";

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

  useEffect(() => {
    const root = document.documentElement;
    clearBrandingTokens(root);

    if (branding.couleur_principale) {
      const hsl = hexToHSL(branding.couleur_principale);
      root.style.setProperty("--primary", hsl);
      root.style.setProperty("--ring", hsl);
      root.style.setProperty("--sidebar-primary", hsl);
      root.style.setProperty("--sidebar-ring", hsl);
    }

    if (branding.couleur_secondaire) {
      root.style.setProperty("--secondary", hexToHSL(branding.couleur_secondaire));
    }

    if (branding.couleur_accent) {
      root.style.setProperty("--accent", hexToHSL(branding.couleur_accent));
    }

    if (branding.couleur_fond) {
      root.style.setProperty("--background", hexToHSL(branding.couleur_fond));
    }

    if (branding.couleur_sidebar) {
      root.style.setProperty("--sidebar-background", hexToHSL(branding.couleur_sidebar));
    }

    if (branding.couleur_carte) {
      const cardHsl = hexToHSL(branding.couleur_carte);
      root.style.setProperty("--card", cardHsl);
      root.style.setProperty("--popover", cardHsl);
    }

    return () => {
      clearBrandingTokens(root);
    };
  }, [branding]);

  return null;
}
