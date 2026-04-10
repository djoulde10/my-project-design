
-- Fix INSERT policy on minutes: Secrétariat has modifier_session, not valider_pv
DROP POLICY IF EXISTS "Company users can insert minutes" ON public.minutes;

CREATE POLICY "Company users can insert minutes"
ON public.minutes
FOR INSERT
TO authenticated
WITH CHECK (
  (company_id = my_company_id()) 
  AND user_has_permission(auth.uid(), 'modifier_session'::text)
);
