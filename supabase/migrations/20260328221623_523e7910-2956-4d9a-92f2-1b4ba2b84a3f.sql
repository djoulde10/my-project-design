
-- Fix 1: API request logs - restrict SELECT to admins/users with gerer_utilisateurs permission
DROP POLICY IF EXISTS "Company admins can read own api_request_logs" ON public.api_request_logs;
CREATE POLICY "Company admins can read own api_request_logs"
ON public.api_request_logs FOR SELECT TO authenticated
USING (
  company_id = my_company_id()
  AND (has_role(auth.uid(), 'admin'::app_role) OR user_has_permission(auth.uid(), 'gerer_utilisateurs'))
);

-- Fix 2: Signatures - restrict SELECT to users with signer_pv or valider_pv permission
DROP POLICY IF EXISTS "Company users can read signatures" ON public.signatures;
CREATE POLICY "Company users can read signatures"
ON public.signatures FOR SELECT TO authenticated
USING (
  company_id = my_company_id()
  AND (user_has_permission(auth.uid(), 'signer_pv') OR user_has_permission(auth.uid(), 'valider_pv'))
);

-- Fix 3: Audit log - restrict SELECT to admins or users with consulter_audit permission
DROP POLICY IF EXISTS "Company users can read audit_log" ON public.audit_log;
CREATE POLICY "Company admins can read audit_log"
ON public.audit_log FOR SELECT TO authenticated
USING (
  company_id = my_company_id()
  AND (has_role(auth.uid(), 'admin'::app_role) OR user_has_permission(auth.uid(), 'gerer_utilisateurs'))
);
