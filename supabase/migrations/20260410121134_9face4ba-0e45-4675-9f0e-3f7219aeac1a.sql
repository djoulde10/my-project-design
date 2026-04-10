
-- Add en_attente_validation to pv_status enum
ALTER TYPE public.pv_status ADD VALUE IF NOT EXISTS 'en_attente_validation' AFTER 'brouillon';

-- Replace SELECT policy: brouillon only visible to secretariat (modifier_session)
DROP POLICY IF EXISTS "Authorized users can read minutes" ON public.minutes;
CREATE POLICY "Authorized users can read minutes"
ON public.minutes
FOR SELECT
TO authenticated
USING (
  company_id = my_company_id()
  AND (
    -- Brouillon: only visible to users with modifier_session
    (pv_status = 'brouillon' AND user_has_permission(auth.uid(), 'modifier_session'::text))
    OR
    -- All other statuses: visible to all company users
    pv_status != 'brouillon'
  )
);

-- Replace UPDATE policy: allow both secretariat (modifier_session) and presidents (valider_pv)
DROP POLICY IF EXISTS "Authorized users can update minutes" ON public.minutes;
CREATE POLICY "Authorized users can update minutes"
ON public.minutes
FOR UPDATE
TO authenticated
USING (
  company_id = my_company_id()
  AND (
    user_has_permission(auth.uid(), 'modifier_session'::text)
    OR user_has_permission(auth.uid(), 'valider_pv'::text)
  )
)
WITH CHECK (
  company_id = my_company_id()
);
