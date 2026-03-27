import { useEffect } from "react";
import { hexToHSL, useCompanyBranding } from "@/hooks/useCompanyBranding";

const TOKEN_NAMES = [
  "--primary",
  "--ring",
  "--sidebar-primary",
  "--sidebar-ring",
  "--secondary",
  "--accent",
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

    return () => {
      clearBrandingTokens(root);
    };
  }, [branding.couleur_principale, branding.couleur_secondaire, branding.couleur_accent]);

  return null;
}