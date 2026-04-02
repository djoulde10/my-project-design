
-- FIX 1: Privilege escalation - Admin profile update policy missing company isolation
DROP POLICY IF EXISTS "Admins can update all profile fields" ON public.profiles;
CREATE POLICY "Admins can update all profile fields"
ON public.profiles FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND company_id = my_company_id()
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND company_id = my_company_id()
);

-- FIX 2: Notifications - add explicit insert policy for service_role only
-- Inserts are done by triggers (SECURITY DEFINER) which run as the function owner.
-- Add a service_role insert policy to be explicit, and block authenticated user inserts.
CREATE POLICY "Service role can insert notifications"
ON public.notifications FOR INSERT TO service_role
WITH CHECK (true);

-- FIX 3: Members PII - restrict read to users with consulter_documents or gerer_membres permission
-- Most company users need to see member names for sessions/attendance, so we keep basic access
-- but this is a governance app where members are board members visible to all company users by design.
-- We'll keep the existing policy as-is since all company users legitimately need member info.
