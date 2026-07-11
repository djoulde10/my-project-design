
-- 1. Broader admin capability helper
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('super_admin','super_admin_readonly','admin_support','admin_billing','admin_security')
  )
$$;

CREATE OR REPLACE FUNCTION public.has_admin_capability(_capability text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND (
      ur.role = 'super_admin'
      OR (ur.role = 'super_admin_readonly' AND _capability = 'read')
      OR (ur.role = 'admin_support' AND _capability IN ('read','support'))
      OR (ur.role = 'admin_billing' AND _capability IN ('read','billing'))
      OR (ur.role = 'admin_security' AND _capability IN ('read','security'))
    )
  )
$$;

-- 2. Suspension fields on companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_reason text,
  ADD COLUMN IF NOT EXISTS suspended_by uuid REFERENCES auth.users(id);

-- Allow SA to fully manage companies
DROP POLICY IF EXISTS "Super admins can insert companies" ON public.companies;
DROP POLICY IF EXISTS "Super admins can update companies" ON public.companies;
DROP POLICY IF EXISTS "Super admins can delete companies" ON public.companies;
DROP POLICY IF EXISTS "Platform admins can read all companies" ON public.companies;

CREATE POLICY "Platform admins can read all companies" ON public.companies
  FOR SELECT TO authenticated USING (is_platform_admin() OR id = my_company_id());
CREATE POLICY "Super admins can insert companies" ON public.companies
  FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super admins can update companies" ON public.companies
  FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super admins can delete companies" ON public.companies
  FOR DELETE TO authenticated USING (is_super_admin());

-- 3. Broadcast table
CREATE TABLE IF NOT EXISTS public.admin_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  level text NOT NULL DEFAULT 'info',
  scope text NOT NULL DEFAULT 'all',
  target_company_ids uuid[],
  sent_by uuid REFERENCES auth.users(id),
  recipients_count integer DEFAULT 0,
  read_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_broadcasts TO authenticated;
GRANT ALL ON public.admin_broadcasts TO service_role;
ALTER TABLE public.admin_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins read broadcasts" ON public.admin_broadcasts
  FOR SELECT TO authenticated USING (is_platform_admin());
CREATE POLICY "Super admins manage broadcasts" ON public.admin_broadcasts
  FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

-- 4. Open read access on admin tables to all platform admins
DO $$
DECLARE _t text;
BEGIN
  FOREACH _t IN ARRAY ARRAY['invoices','subscription_plans','feature_flags','system_logs','support_tickets','admin_audit_log','organization_usage','login_logs','api_request_logs']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Platform admins can read %I" ON public.%I', _t, _t);
    EXECUTE format('CREATE POLICY "Platform admins can read %I" ON public.%I FOR SELECT TO authenticated USING (public.is_platform_admin())', _t, _t);
  END LOOP;
END $$;
