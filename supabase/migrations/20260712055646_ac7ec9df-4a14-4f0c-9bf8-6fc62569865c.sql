
-- Restrict roles writes to super_admin only
DROP POLICY IF EXISTS "Admins can manage roles" ON public.roles;
CREATE POLICY "Super admins can manage roles"
  ON public.roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Restrict role_permissions writes to super_admin only
DROP POLICY IF EXISTS "Admins can manage role_permissions" ON public.role_permissions;
CREATE POLICY "Super admins can manage role_permissions"
  ON public.role_permissions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Allow authenticated users to insert audit_log entries scoped to their own company & user
CREATE POLICY "Authenticated users can insert own audit_log"
  ON public.audit_log FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND company_id = public.my_company_id()
  );
