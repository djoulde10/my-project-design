
-- 1. Restrict roles SELECT to roles referenced by user's company
DROP POLICY IF EXISTS "Auth users can read roles" ON public.roles;
CREATE POLICY "Users read roles used by their company"
  ON public.roles FOR SELECT
  TO authenticated
  USING (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.company_id = public.my_company_id()
        AND p.role_id = roles.id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role_id = roles.id
    )
  );

-- 2. Restrict role_permissions SELECT to roles used by user's company
DROP POLICY IF EXISTS "Auth users can read role_permissions" ON public.role_permissions;
CREATE POLICY "Users read role_permissions for their company roles"
  ON public.role_permissions FOR SELECT
  TO authenticated
  USING (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.company_id = public.my_company_id()
        AND p.role_id = role_permissions.role_id
    )
  );

-- 3. Realtime channel isolation by company prefix
DROP POLICY IF EXISTS "Company scoped realtime subscription" ON realtime.messages;
CREATE POLICY "Company scoped realtime subscription"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (
    realtime.topic() LIKE (public.my_company_id()::text || ':%')
    OR public.is_platform_admin()
  );

-- 4. Remove listing on public company-logos bucket (direct URLs still work)
DROP POLICY IF EXISTS "Public can read company logos by path" ON storage.objects;

-- 5. Revoke EXECUTE from anon on all SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_company_id() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_has_permission(uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_permissions(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_entity_permission(uuid, text, uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.members_safe_select(uuid, uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_admin_capability(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.publish_minute(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.queue_session_convocations(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_convocation_viewed(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_company_colors(text, text, text, text, text, text) FROM anon, PUBLIC;

-- 6. Revoke EXECUTE from authenticated on strictly internal helpers
-- (they are only invoked from server-side edge functions with service role or from other definer contexts)
REVOKE EXECUTE ON FUNCTION public.validate_api_key(text) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_api_key(text) TO service_role;
