import { usePermissions } from "@/hooks/usePermissions";

/**
 * Cross-organ restriction for Presidents:
 * - PCA has full access on CA organs, but is read-only (like "Membre") on Comité d'Audit organs.
 * - Président du Comité d'Audit has full access on Comité d'Audit organs, but is read-only on CA organs.
 * 
 * Returns a function that checks if the user is restricted (read-only) for a given organ type.
 */
export function usePresidentOrganRestriction() {
  const { roleName } = usePermissions();

  const isPresident = roleName === "PCA" || roleName === "Président du Comité d'Audit";

  /**
   * Returns true if the current user should be treated as read-only for the given organ type.
   * @param organType - "ca" or "comite_audit"
   */
  const isReadOnlyForOrgan = (organType: string): boolean => {
    if (!isPresident) return false;
    if (roleName === "PCA" && organType === "comite_audit") return true;
    if (roleName === "Président du Comité d'Audit" && organType === "ca") return true;
    return false;
  };

  return { isPresident, isReadOnlyForOrgan, roleName };
}
