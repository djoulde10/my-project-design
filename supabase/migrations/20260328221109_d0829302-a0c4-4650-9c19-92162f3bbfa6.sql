
-- Fix privilege escalation: restrict entity_permissions management to users with 'gerer_utilisateurs' permission

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Grantors can manage own entity_permissions" ON public.entity_permissions;
DROP POLICY IF EXISTS "Company users can view entity_permissions" ON public.entity_permissions;
DROP POLICY IF EXISTS "Grantors can update own entity_permissions" ON public.entity_permissions;
DROP POLICY IF EXISTS "Grantors can delete own entity_permissions" ON public.entity_permissions;

-- SELECT: users can see permissions for their company
CREATE POLICY "Company users can view entity_permissions"
ON public.entity_permissions FOR SELECT TO authenticated
USING (company_id = my_company_id());

-- INSERT: only users with 'gerer_utilisateurs' permission can grant permissions
CREATE POLICY "Authorized users can insert entity_permissions"
ON public.entity_permissions FOR INSERT TO authenticated
WITH CHECK (
  company_id = my_company_id()
  AND granted_by = auth.uid()
  AND user_has_permission(auth.uid(), 'gerer_utilisateurs')
);

-- UPDATE: only users with 'gerer_utilisateurs' permission can update permissions
CREATE POLICY "Authorized users can update entity_permissions"
ON public.entity_permissions FOR UPDATE TO authenticated
USING (company_id = my_company_id() AND user_has_permission(auth.uid(), 'gerer_utilisateurs'))
WITH CHECK (company_id = my_company_id() AND user_has_permission(auth.uid(), 'gerer_utilisateurs'));

-- DELETE: only users with 'gerer_utilisateurs' permission can delete permissions
CREATE POLICY "Authorized users can delete entity_permissions"
ON public.entity_permissions FOR DELETE TO authenticated
USING (company_id = my_company_id() AND user_has_permission(auth.uid(), 'gerer_utilisateurs'));
