import { usePermissions } from "@/hooks/usePermissions";

/**
 * Returns true if the current user has the "Membre de la Direction" role.
 * This role can only see data related to the Audit Committee (comite_audit),
 * never Board of Directors (CA) data.
 */
export function useIsDirectionMember(): boolean {
  const { roleName } = usePermissions();
  return roleName === "Membre de la Direction";
}
