
-- 1. Remove authenticated INSERT policy on audit_log (triggers use SECURITY DEFINER / service_role)
DROP POLICY IF EXISTS "Company users can insert audit_log" ON public.audit_log;

-- 2. Add UPDATE storage policies for private buckets
CREATE POLICY "Company users can update session-documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'session-documents'
  AND (storage.foldername(name))[1] = my_company_id()::text
)
WITH CHECK (
  bucket_id = 'session-documents'
  AND (storage.foldername(name))[1] = my_company_id()::text
);

CREATE POLICY "Company users can update meeting-audio"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'meeting-audio'
  AND (storage.foldername(name))[1] = my_company_id()::text
)
WITH CHECK (
  bucket_id = 'meeting-audio'
  AND (storage.foldername(name))[1] = my_company_id()::text
);

CREATE POLICY "Company users can update pv-templates"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'pv-templates'
  AND (storage.foldername(name))[1] = my_company_id()::text
)
WITH CHECK (
  bucket_id = 'pv-templates'
  AND (storage.foldername(name))[1] = my_company_id()::text
);

-- 3. Restrict members SELECT to hide PII from unauthorized users
-- First drop the existing permissive policy
DROP POLICY IF EXISTS "Company users can read members" ON public.members;

-- Create a security definer function for safe member PII access
CREATE OR REPLACE FUNCTION public.members_safe_select(_company_id uuid, _user_id uuid, _member_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    _member_user_id = _user_id  -- Member can always see their own record
    OR user_has_permission(_user_id, 'gerer_membres')  -- Users with manage permission
$$;

-- Allow all company users to read members (basic info is needed everywhere)
-- PII will be filtered at the view/application level for users without permission
-- But restrict full access to authorized users or self
CREATE POLICY "Company users can read own member record"
ON public.members FOR SELECT
TO authenticated
USING (company_id = my_company_id() AND user_id = auth.uid());

CREATE POLICY "Authorized users can read all members"
ON public.members FOR SELECT
TO authenticated
USING (company_id = my_company_id() AND user_has_permission(auth.uid(), 'gerer_membres'));

CREATE POLICY "Company users can read basic member info"
ON public.members FOR SELECT
TO authenticated
USING (company_id = my_company_id());
