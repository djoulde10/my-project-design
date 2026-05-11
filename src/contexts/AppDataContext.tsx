import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface CompanyBranding {
  nom: string;
  platform_name: string | null;
  logo_url: string | null;
  couleur_principale: string;
  couleur_secondaire: string | null;
  couleur_accent: string | null;
  couleur_fond: string | null;
  couleur_sidebar: string | null;
  couleur_carte: string | null;
}

export interface UserColorPreferences {
  couleur_principale: string | null;
  couleur_secondaire: string | null;
  couleur_accent: string | null;
  couleur_fond: string | null;
  couleur_sidebar: string | null;
  couleur_carte: string | null;
}

const DEFAULT_BRANDING: CompanyBranding = {
  nom: "GovBoard",
  platform_name: null,
  logo_url: null,
  couleur_principale: "#1e40af",
  couleur_secondaire: null,
  couleur_accent: null,
  couleur_fond: null,
  couleur_sidebar: null,
  couleur_carte: null,
};

const EMPTY_PREFS: UserColorPreferences = {
  couleur_principale: null,
  couleur_secondaire: null,
  couleur_accent: null,
  couleur_fond: null,
  couleur_sidebar: null,
  couleur_carte: null,
};

type AppDataContextValue = {
  loading: boolean;
  permissions: string[];
  roleName: string | null;
  companyId: string | null;
  isSuperAdmin: boolean;
  branding: CompanyBranding;
  displayName: string;
  prefs: UserColorPreferences;
  quality: string | null;
  refreshAppData: () => void;
  invalidateBranding: () => void;
  invalidatePrefs: () => void;
  savePrefs: (colors: UserColorPreferences) => Promise<boolean>;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [roleName, setRoleName] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [prefs, setPrefs] = useState<UserColorPreferences>(EMPTY_PREFS);
  const [quality, setQuality] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user) {
        setPermissions([]);
        setRoleName(null);
        setCompanyId(null);
        setIsSuperAdmin(false);
        setBranding(DEFAULT_BRANDING);
        setPrefs(EMPTY_PREFS);
        setQuality(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const [{ data: profile }, { data: superRoles }, { data: member }] = await Promise.all([
        supabase.from("profiles").select("role_id, statut, company_id, roles(nom)").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "super_admin"),
        supabase.from("members").select("quality").eq("user_id", user.id).eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

      const activeProfile = profile && (profile as any).statut === "actif";
      const nextCompanyId = (profile as any)?.company_id ?? null;

      const [rolePerms, brandingRes, prefsRes] = await Promise.all([
        activeProfile && (profile as any).role_id
          ? supabase.from("role_permissions").select("permissions(nom)").eq("role_id", (profile as any).role_id)
          : Promise.resolve({ data: [] as any[] }),
        nextCompanyId
          ? supabase.from("companies").select("nom, platform_name, logo_url, couleur_principale, couleur_secondaire, couleur_accent, couleur_fond, couleur_sidebar, couleur_carte").eq("id", nextCompanyId).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from("user_preferences").select("couleur_principale, couleur_secondaire, couleur_accent, couleur_fond, couleur_sidebar, couleur_carte").eq("user_id", user.id).maybeSingle(),
      ]);

      if (cancelled) return;

      setPermissions(activeProfile ? ((rolePerms.data ?? []).map((r: any) => r.permissions?.nom).filter(Boolean)) : []);
      setRoleName(activeProfile ? ((profile as any).roles?.nom ?? null) : null);
      setCompanyId(nextCompanyId);
      setIsSuperAdmin((superRoles ?? []).length > 0);
      setQuality((member as any)?.quality ?? null);

      if (brandingRes.data) {
        const d = brandingRes.data as any;
        setBranding({
          nom: d.nom,
          platform_name: d.platform_name,
          logo_url: d.logo_url,
          couleur_principale: d.couleur_principale ?? "#1e40af",
          couleur_secondaire: d.couleur_secondaire ?? null,
          couleur_accent: d.couleur_accent ?? null,
          couleur_fond: d.couleur_fond ?? null,
          couleur_sidebar: d.couleur_sidebar ?? null,
          couleur_carte: d.couleur_carte ?? null,
        });
      } else {
        setBranding(DEFAULT_BRANDING);
      }

      const p = prefsRes.data as any;
      setPrefs(p ? {
        couleur_principale: p.couleur_principale ?? null,
        couleur_secondaire: p.couleur_secondaire ?? null,
        couleur_accent: p.couleur_accent ?? null,
        couleur_fond: p.couleur_fond ?? null,
        couleur_sidebar: p.couleur_sidebar ?? null,
        couleur_carte: p.couleur_carte ?? null,
      } : EMPTY_PREFS);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [user, version]);

  const value = useMemo<AppDataContextValue>(() => ({
    loading,
    permissions,
    roleName,
    companyId,
    isSuperAdmin,
    branding,
    displayName: branding.platform_name || branding.nom || "GovBoard",
    prefs,
    quality,
    refreshAppData: () => setVersion((v) => v + 1),
    invalidateBranding: () => setVersion((v) => v + 1),
    invalidatePrefs: () => setVersion((v) => v + 1),
    savePrefs: async (colors) => {
      if (!user) return false;
      const { error } = await supabase.from("user_preferences").upsert({ user_id: user.id, ...colors } as any, { onConflict: "user_id" });
      if (!error) setPrefs(colors);
      return !error;
    },
  }), [loading, permissions, roleName, companyId, isSuperAdmin, branding, prefs, quality, user]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}