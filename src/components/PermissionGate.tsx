import { ReactNode } from "react";
import { usePermissions, PermissionName } from "@/hooks/usePermissions";

interface PermissionGateProps {
  children: ReactNode;
  permission?: PermissionName;
  permissions?: PermissionName[];
  requireAll?: boolean;
  fallback?: ReactNode;
}

export default function PermissionGate({
  children,
  permission,
  permissions,
  requireAll = false,
  fallback = null,
}: PermissionGateProps) {
  const { hasPermission, hasAnyPermission, loading } = usePermissions();

  if (loading) return null;

  if (permission) {
    return hasPermission(permission) ? <>{children}</> : <>{fallback}</>;
  }

  if (permissions && permissions.length > 0) {
    const allowed = requireAll
      ? permissions.every((p) => hasPermission(p))
      : hasAnyPermission(...permissions);
    return allowed ? <>{children}</> : <>{fallback}</>;
  }

  return <>{children}</>;
}
