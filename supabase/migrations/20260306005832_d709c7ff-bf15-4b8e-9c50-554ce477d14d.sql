
DROP POLICY IF EXISTS "Users can read all profiles" ON public.profiles;
CREATE POLICY "Company users can read own profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (company_id = public.my_company_id());
