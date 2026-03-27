import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";

export interface CompanyBranding {
  nom: string;
  platform_name: string | null;
  logo_url: string | null;
  couleur_principale: string;
  couleur_secondaire: string | null;
  couleur_accent: string | null;
}

const DEFAULT_BRANDING: CompanyBranding = {
  nom: "GovBoard",
  platform_name: null,
  logo_url: null,
  couleur_principale: "#1e40af",
  couleur_secondaire: null,
  couleur_accent: null,
};

// Simple in-memory cache
let brandingCache: Record<string, { data: CompanyBranding; ts: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 min

function hexToHSL(hex: string): string {
  hex = hex.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function useCompanyBranding() {
  const companyId = useCompanyId();
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    // Check cache
    const cached = brandingCache[companyId];
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setBranding(cached.data);
      setLoading(false);
      return;
    }

    supabase
      .from("companies")
      .select("nom, platform_name, logo_url, couleur_principale, couleur_secondaire, couleur_accent")
      .eq("id", companyId)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          const b: CompanyBranding = {
            nom: data.nom,
            platform_name: data.platform_name,
            logo_url: data.logo_url,
            couleur_principale: data.couleur_principale ?? "#1e40af",
            couleur_secondaire: (data as any).couleur_secondaire ?? null,
            couleur_accent: (data as any).couleur_accent ?? null,
          };
          brandingCache[companyId] = { data: b, ts: Date.now() };
          setBranding(b);
        }
        setLoading(false);
      });
  }, [companyId]);

  // Apply CSS custom properties dynamically
  useEffect(() => {
    const root = document.documentElement;
    if (branding.couleur_principale) {
      root.style.setProperty("--brand-primary", hexToHSL(branding.couleur_principale));
    }
    if (branding.couleur_secondaire) {
      root.style.setProperty("--brand-secondary", hexToHSL(branding.couleur_secondaire));
    }
    if (branding.couleur_accent) {
      root.style.setProperty("--brand-accent", hexToHSL(branding.couleur_accent));
    }
    return () => {
      root.style.removeProperty("--brand-primary");
      root.style.removeProperty("--brand-secondary");
      root.style.removeProperty("--brand-accent");
    };
  }, [branding]);

  const displayName = useMemo(
    () => branding.platform_name || branding.nom || "GovBoard",
    [branding]
  );

  const invalidateCache = () => {
    if (companyId) delete brandingCache[companyId];
  };

  return { branding, displayName, loading, invalidateCache };
}
