-- 1. REALTIME : activer sur toutes les tables clés
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sessions','minutes','decisions','actions','agenda_items','documents','session_attendees','approval_requests','convocation_views','meetings','meeting_ai_analysis']
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
  END LOOP;
END $$;

-- 2. PRIVILEGE ESCALATION : bloquer écriture user_roles
DROP POLICY IF EXISTS "Only super admins can insert user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only super admins can update user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only super admins can delete user_roles" ON public.user_roles;

CREATE POLICY "Only super admins can insert user_roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin());

CREATE POLICY "Only super admins can update user_roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY "Only super admins can delete user_roles"
ON public.user_roles FOR DELETE TO authenticated
USING (public.is_super_admin());

-- 3. CONVOCATION TOKEN : retirer la lecture large, ne garder que destinataire / créateur / admin
DROP POLICY IF EXISTS "Managers can read company convocation views" ON public.convocation_views;

CREATE POLICY "Session creator and admins can read convocation views"
ON public.convocation_views FOR SELECT TO authenticated
USING (
  company_id = my_company_id() AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = convocation_views.session_id AND s.created_by = auth.uid())
    OR user_has_permission(auth.uid(), 'gerer_utilisateurs')
  )
);

-- 4. SIGNATURES : restreindre lecture
DROP POLICY IF EXISTS "Company users can read signatures" ON public.signatures;

CREATE POLICY "Authorized users can read signatures"
ON public.signatures FOR SELECT TO authenticated
USING (
  company_id = my_company_id() AND (
    signed_by = auth.uid()
    OR user_has_permission(auth.uid(), 'valider_pv')
    OR user_has_permission(auth.uid(), 'gerer_utilisateurs')
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- 5. STORAGE : empêcher listing du bucket company-logos (lecture par chemin direct conservée)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public can list company logos" ON storage.objects;
DROP POLICY IF EXISTS "Public can read company logos" ON storage.objects;

CREATE POLICY "Public can read company logos by path"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'company-logos');
