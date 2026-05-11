import { useAppData } from "@/contexts/AppDataContext";

export type PermissionName =
  | "gerer_utilisateurs"
  | "creer_session"
  | "modifier_session"
  | "valider_pv"
  
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
  const { permissions, roleName, loading } = useAppData();

  const hasPermission = (perm: PermissionName): boolean => {
    return permissions.includes(perm);
  };

  const hasAnyPermission = (...perms: PermissionName[]): boolean => {
    return perms.some((p) => permissions.includes(p));
  };

  return { permissions, roleName, loading, hasPermission, hasAnyPermission };
}
