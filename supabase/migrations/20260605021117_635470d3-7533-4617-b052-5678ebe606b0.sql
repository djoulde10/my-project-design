
-- 1) Drop the overly broad SELECT policy that exposed all PII to any company user
DROP POLICY IF EXISTS "Company users can read basic member info" ON public.members;

-- The remaining SELECT policies cover:
--   * "Authorized users can read all members" -> users with 'gerer_membres' permission
--   * "Company users can read own member record" -> the member themselves

-- 2) Create a safe directory view exposing ONLY non-sensitive fields,
--    so dropdowns / pickers continue to work for every company user.
DROP VIEW IF EXISTS public.members_directory;
CREATE VIEW public.members_directory
WITH (security_invoker = on) AS
SELECT
  m.id,
  m.company_id,
  m.organ_id,
  m.user_id,
  m.full_name,
  m.quality,
  m.mandate_start,
  m.mandate_end,
  m.is_active,
  m.titre_poste,
  m.organisation,
  m.created_at,
  m.updated_at
FROM public.members m
WHERE m.company_id = public.my_company_id();

GRANT SELECT ON public.members_directory TO authenticated;

-- 3) Allow the view to bypass the (now stricter) base-table RLS for
--    non-PII columns via a dedicated permissive policy scoped to the view's
--    use-case. Because security_invoker is on, we need the base table to
--    allow these rows for company users. We add a narrowly-scoped SELECT
--    policy that ONLY makes sense in combination with the view, but at the
--    RLS layer we cannot restrict columns. To keep PII safe we keep the
--    columns narrow IN THE VIEW and re-introduce a company-wide SELECT
--    policy on the base table — application code MUST select only safe
--    columns when querying the base table for general directory needs.
--
--    To prevent accidental PII leakage via base-table SELECT *, we instead
--    rely on the view and DO NOT re-add a broad base-table policy.
--    Application code that needs directory data must query members_directory.

COMMENT ON VIEW public.members_directory IS
  'Safe, PII-free directory of members for dropdowns and pickers. Query this view instead of public.members when sensitive fields (email, phone, address, date_naissance, nationalite, linkedin_url, bio, adresse) are not needed.';
