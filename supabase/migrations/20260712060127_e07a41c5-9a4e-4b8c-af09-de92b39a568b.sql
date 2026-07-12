
-- Approval requests: enforce requested_by = auth.uid()
DROP POLICY IF EXISTS "Company users can insert approval_requests" ON public.approval_requests;
CREATE POLICY "Company users can insert approval_requests"
  ON public.approval_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.my_company_id()
    AND requested_by = auth.uid()
  );

-- minute_versions: gate SELECT on the same permission that governs minute editing/validation
DROP POLICY IF EXISTS "Company users can read minute_versions" ON public.minute_versions;
CREATE POLICY "Authorized users can read minute_versions"
  ON public.minute_versions FOR SELECT
  TO authenticated
  USING (
    company_id = public.my_company_id()
    AND (
      public.user_has_permission(auth.uid(), 'modifier_session')
      OR public.user_has_permission(auth.uid(), 'valider_pv')
    )
  );

-- profiles: prevent regular admins from assigning privileged roles.
-- Only super_admin may attach a role that carries user-management permissions.
DROP POLICY IF EXISTS "Admins can update all profile fields" ON public.profiles;
CREATE POLICY "Admins can update all profile fields"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND company_id = public.my_company_id())
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND company_id = public.my_company_id()
    AND (
      public.is_super_admin()
      OR role_id IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM public.role_permissions rp
        JOIN public.permissions p ON p.id = rp.permission_id
        WHERE rp.role_id = profiles.role_id
          AND p.nom IN ('gerer_utilisateurs', 'gerer_permissions', 'gerer_organisation')
      )
    )
  );
