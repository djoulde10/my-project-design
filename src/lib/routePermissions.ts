import type { PermissionName } from "@/hooks/usePermissions";

/**
 * Maps route paths to required permissions.
 * Routes not listed here are accessible to all authenticated users.
 * If multiple permissions are listed, ANY of them grants access.
 */
export const routePermissionMap: Record<string, PermissionName[]> = {
  "/sessions": ["creer_session", "modifier_session"],
  "/members": ["gerer_membres"],
  "/agenda": ["modifier_session"],
  "/meetings": ["valider_pv", "consulter_documents"],
  "/decisions": ["creer_decisions", "consulter_documents"],
  "/actions": ["suivre_actions"],
  "/documents": ["consulter_documents", "gerer_documents"],
  "/conflicts": ["gerer_conflits"],
  "/archives": ["consulter_documents"],
  "/audit": ["consulter_audit"],
  "/users": ["gerer_utilisateurs"],
  "/permissions": ["gerer_utilisateurs"],
  "/approvals": ["gerer_approbations", "valider_pv"],
  "/api-keys": ["gerer_api"],
  "/api-docs": ["gerer_api"],
  "/settings": ["gerer_utilisateurs"],
};

export function getRequiredPermissions(path: string): PermissionName[] | null {
  // Exact match first
  if (routePermissionMap[path]) return routePermissionMap[path];
  
  // Check prefix matches (e.g., /members/:id)
  for (const [route, perms] of Object.entries(routePermissionMap)) {
    if (path.startsWith(route + "/")) return perms;
  }

  return null; // No restriction
}
