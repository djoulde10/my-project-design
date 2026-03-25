import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type EntityType = "document" | "minute" | "session" | "decision" | "meeting";
export type PermissionAction = "view" | "edit" | "delete" | "comment";

interface EntityPermissionResult {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canComment: boolean;
  loading: boolean;
}

export function useEntityPermission(entityType: EntityType, entityId: string | null): EntityPermissionResult {
  const { user } = useAuth();
  const [result, setResult] = useState<EntityPermissionResult>({
    canView: false, canEdit: false, canDelete: false, canComment: false, loading: true,
  });

  useEffect(() => {
    if (!user || !entityId) {
      setResult({ canView: false, canEdit: false, canDelete: false, canComment: false, loading: false });
      return;
    }

    const check = async () => {
      const actions: PermissionAction[] = ["view", "edit", "delete", "comment"];
      const results = await Promise.all(
        actions.map((action) =>
          supabase.rpc("check_entity_permission", {
            _user_id: user.id,
            _entity_type: entityType,
            _entity_id: entityId,
            _action: action,
          }).then(({ data }) => data ?? false)
        )
      );

      setResult({
        canView: results[0],
        canEdit: results[1],
        canDelete: results[2],
        canComment: results[3],
        loading: false,
      });
    };

    check();
  }, [user, entityType, entityId]);

  return result;
}

export function useEntityPermissions(entityType: EntityType, entityId: string | null) {
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    if (!entityId) { setPermissions([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("entity_permissions")
      .select("*, profiles:user_id(full_name, avatar_url)")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId);
    setPermissions(data ?? []);
    setLoading(false);
  }, [entityType, entityId]);

  useEffect(() => { fetchPermissions(); }, [fetchPermissions]);

  return { permissions, loading, refetch: fetchPermissions };
}
