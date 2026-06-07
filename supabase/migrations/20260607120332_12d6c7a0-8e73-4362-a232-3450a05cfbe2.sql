
-- 1. Restrict conflict_of_interests SELECT to authorized roles
DROP POLICY IF EXISTS "Authenticated users can read conflict_of_interests" ON public.conflict_of_interests;

CREATE POLICY "Authorized users can read conflict_of_interests"
ON public.conflict_of_interests
FOR SELECT TO authenticated
USING (
  company_id = my_company_id()
  AND (
    user_has_permission(auth.uid(), 'gerer_conflits')
    OR user_has_permission(auth.uid(), 'gerer_membres')
    OR EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = conflict_of_interests.member_id AND m.user_id = auth.uid()
    )
  )
);

-- 2. Prevent privilege escalation on profiles: block role_id / statut / company_id changes
--    unless the editor is a super_admin.
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    IF NEW.role_id IS DISTINCT FROM OLD.role_id
       OR NEW.statut IS DISTINCT FROM OLD.statut
       OR NEW.company_id IS DISTINCT FROM OLD.company_id THEN
      RAISE EXCEPTION 'Modification du rôle, du statut ou de l''organisation interdite. Contactez un super administrateur.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_privilege_escalation_trg ON public.profiles;
CREATE TRIGGER prevent_profile_privilege_escalation_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- 3. Preserve audit log integrity: block UPDATE/DELETE on admin_audit_log and audit_log
--    Use RESTRICTIVE policies that always deny these operations from API roles.
CREATE POLICY "No update on admin_audit_log"
ON public.admin_audit_log AS RESTRICTIVE
FOR UPDATE TO authenticated, anon
USING (false) WITH CHECK (false);

CREATE POLICY "No delete on admin_audit_log"
ON public.admin_audit_log AS RESTRICTIVE
FOR DELETE TO authenticated, anon
USING (false);

CREATE POLICY "No update on audit_log"
ON public.audit_log AS RESTRICTIVE
FOR UPDATE TO authenticated, anon
USING (false) WITH CHECK (false);

CREATE POLICY "No delete on audit_log"
ON public.audit_log AS RESTRICTIVE
FOR DELETE TO authenticated, anon
USING (false);
