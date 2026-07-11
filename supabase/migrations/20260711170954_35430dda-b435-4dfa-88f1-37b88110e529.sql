
DROP POLICY IF EXISTS "Platform admins can read all profiles" ON public.profiles;
CREATE POLICY "Platform admins can read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (is_platform_admin() OR company_id = my_company_id());
