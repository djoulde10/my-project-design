import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type PermissionName =
  | "gerer_utilisateurs"
  | "creer_session"
  | "modifier_session"
  | "valider_pv"
  | "signer_pv"
  | "consulter_documents"
  | "gerer_documents"
  | "gerer_membres"
  | "creer_decisions"
  | "suivre_actions"
  | "consulter_audit"
  | "gerer_organes"
  | "gerer_conflits"
  | "gerer_approbations"
  | "gerer_api"
  | "gerer_support"
  | "consulter_analytics";

export function usePermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [roleName, setRoleName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPermissions([]);
      setRoleName(null);
      setLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      // Get user's role and permissions via profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("role_id, statut, roles(nom)")
        .eq("id", user.id)
        .single();

      if (!profile || profile.statut !== "actif") {
        setPermissions([]);
        setRoleName(null);
        setLoading(false);
        return;
      }

      setRoleName((profile as any).roles?.nom ?? null);

      if (profile.role_id) {
        const { data: rp } = await supabase
          .from("role_permissions")
          .select("permissions(nom)")
          .eq("role_id", profile.role_id);

        const perms = (rp ?? []).map((r: any) => r.permissions?.nom).filter(Boolean);
        setPermissions(perms);
      }

      setLoading(false);
    };

    fetchPermissions();
  }, [user]);

  const hasPermission = (perm: PermissionName): boolean => {
    return permissions.includes(perm);
  };

  const hasAnyPermission = (...perms: PermissionName[]): boolean => {
    return perms.some((p) => permissions.includes(p));
  };

  return { permissions, roleName, loading, hasPermission, hasAnyPermission };
}
