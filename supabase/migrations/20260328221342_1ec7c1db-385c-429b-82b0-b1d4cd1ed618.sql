
-- Fix 1: Audit log forgery - restrict INSERT to only allow user's own user_id
DROP POLICY IF EXISTS "Company users can insert audit_log" ON public.audit_log;
CREATE POLICY "Company users can insert audit_log"
ON public.audit_log FOR INSERT TO authenticated
WITH CHECK (company_id = my_company_id() AND user_id = auth.uid());

-- Also allow service_role for trigger-based inserts
DROP POLICY IF EXISTS "Service role can insert audit_log" ON public.audit_log;
CREATE POLICY "Service role can insert audit_log"
ON public.audit_log FOR INSERT TO service_role
WITH CHECK (true);

-- Fix 2: Conflict of interests - restrict INSERT and UPDATE to users with gerer_conflits or gerer_membres permission
DROP POLICY IF EXISTS "Authenticated users can insert conflict_of_interests" ON public.conflict_of_interests;
CREATE POLICY "Authorized users can insert conflict_of_interests"
ON public.conflict_of_interests FOR INSERT TO authenticated
WITH CHECK (
  company_id = my_company_id()
  AND user_has_permission(auth.uid(), 'gerer_conflits')
);

DROP POLICY IF EXISTS "Authenticated users can update conflict_of_interests" ON public.conflict_of_interests;
CREATE POLICY "Authorized users can update conflict_of_interests"
ON public.conflict_of_interests FOR UPDATE TO authenticated
USING (company_id = my_company_id() AND user_has_permission(auth.uid(), 'gerer_conflits'))
WITH CHECK (company_id = my_company_id() AND user_has_permission(auth.uid(), 'gerer_conflits'));

-- Fix 3: Login logs - restrict INSERT to enforce email matches JWT claim
DROP POLICY IF EXISTS "Users can insert own login_logs" ON public.login_logs;
CREATE POLICY "Users can insert own login_logs"
ON public.login_logs FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND email = auth.email());

-- Also allow service_role for server-side inserts
DROP POLICY IF EXISTS "Service role can insert login_logs" ON public.login_logs;
CREATE POLICY "Service role can insert login_logs"
ON public.login_logs FOR INSERT TO service_role
WITH CHECK (true);
