import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCallback } from "react";

interface AdminAuditEntry {
  action: string;
  entity_type: string;
  entity_id?: string;
  target_company_id?: string;
  details?: Record<string, unknown>;
}

/**
 * Hook to log Super Admin actions to the dedicated admin_audit_log table.
 * All administrative actions (org management, plan changes, feature flags, etc.)
 * are captured here and NOT in the organization-level audit_log.
 */
export function useAdminAuditLog() {
  const { user } = useAuth();

  const logAdminAction = useCallback(
    async (entry: AdminAuditEntry) => {
      if (!user) return;

      try {
        await supabase.from("admin_audit_log" as any).insert({
          action: entry.action,
          entity_type: entry.entity_type,
          entity_id: entry.entity_id ?? null,
          user_id: user.id,
          target_company_id: entry.target_company_id ?? null,
          details: entry.details ?? null,
        });
      } catch (err) {
        console.error("[AdminAudit] Failed to log action:", err);
      }
    },
    [user]
  );

  return { logAdminAction };
}
