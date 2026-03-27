-- Harden permission enforcement across entity data and fix exposed policies

-- API keys: only authorized managers can read keys
DROP POLICY IF EXISTS "Company users can read api_keys" ON public.api_keys;
CREATE POLICY "Authorized users can read api_keys"
ON public.api_keys
FOR SELECT
TO authenticated
USING (
  company_id = my_company_id()
  AND user_has_permission(auth.uid(), 'gerer_utilisateurs')
);

-- user_roles: restrict visibility to self, same-company managers, or super admins
DROP POLICY IF EXISTS "Authenticated users can read user_roles" ON public.user_roles;
CREATE POLICY "Restricted users can read user_roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'super_admin')
  OR (
    user_has_permission(auth.uid(), 'gerer_utilisateurs')
    AND EXISTS (
      SELECT 1
      FROM public.profiles self_profile
      JOIN public.profiles target_profile ON target_profile.id = public.user_roles.user_id
      WHERE self_profile.id = auth.uid()
        AND self_profile.company_id = target_profile.company_id
    )
  )
);

-- conflict_of_interests: authenticated only
DROP POLICY IF EXISTS "Company users can delete conflict_of_interests" ON public.conflict_of_interests;
DROP POLICY IF EXISTS "Company users can insert conflict_of_interests" ON public.conflict_of_interests;
DROP POLICY IF EXISTS "Company users can read conflict_of_interests" ON public.conflict_of_interests;
DROP POLICY IF EXISTS "Company users can update conflict_of_interests" ON public.conflict_of_interests;

CREATE POLICY "Authenticated users can read conflict_of_interests"
ON public.conflict_of_interests
FOR SELECT
TO authenticated
USING (company_id = my_company_id());

CREATE POLICY "Authenticated users can insert conflict_of_interests"
ON public.conflict_of_interests
FOR INSERT
TO authenticated
WITH CHECK (company_id = my_company_id());

CREATE POLICY "Authenticated users can update conflict_of_interests"
ON public.conflict_of_interests
FOR UPDATE
TO authenticated
USING (company_id = my_company_id())
WITH CHECK (company_id = my_company_id());

CREATE POLICY "Authenticated users can delete conflict_of_interests"
ON public.conflict_of_interests
FOR DELETE
TO authenticated
USING (
  company_id = my_company_id()
  AND user_has_permission(auth.uid(), 'gerer_membres')
);

-- Entity-aware RLS for business tables using existing ACL function
DROP POLICY IF EXISTS "Company users can read documents" ON public.documents;
DROP POLICY IF EXISTS "Company users can update documents" ON public.documents;
DROP POLICY IF EXISTS "Company users can delete documents" ON public.documents;
CREATE POLICY "Authorized users can read documents"
ON public.documents
FOR SELECT
TO authenticated
USING (
  company_id = my_company_id()
  AND check_entity_permission(auth.uid(), 'document', id, 'view')
);
CREATE POLICY "Authorized users can update documents"
ON public.documents
FOR UPDATE
TO authenticated
USING (
  company_id = my_company_id()
  AND check_entity_permission(auth.uid(), 'document', id, 'edit')
)
WITH CHECK (company_id = my_company_id());
CREATE POLICY "Authorized users can delete documents"
ON public.documents
FOR DELETE
TO authenticated
USING (
  company_id = my_company_id()
  AND check_entity_permission(auth.uid(), 'document', id, 'delete')
);

DROP POLICY IF EXISTS "Company users can read minutes" ON public.minutes;
DROP POLICY IF EXISTS "Company users can update minutes" ON public.minutes;
DROP POLICY IF EXISTS "Company users can delete minutes" ON public.minutes;
CREATE POLICY "Authorized users can read minutes"
ON public.minutes
FOR SELECT
TO authenticated
USING (
  company_id = my_company_id()
  AND check_entity_permission(auth.uid(), 'minute', id, 'view')
);
CREATE POLICY "Authorized users can update minutes"
ON public.minutes
FOR UPDATE
TO authenticated
USING (
  company_id = my_company_id()
  AND check_entity_permission(auth.uid(), 'minute', id, 'edit')
)
WITH CHECK (company_id = my_company_id());
CREATE POLICY "Authorized users can delete minutes"
ON public.minutes
FOR DELETE
TO authenticated
USING (
  company_id = my_company_id()
  AND check_entity_permission(auth.uid(), 'minute', id, 'delete')
);

DROP POLICY IF EXISTS "Company users can read decisions" ON public.decisions;
DROP POLICY IF EXISTS "Company users can update decisions" ON public.decisions;
DROP POLICY IF EXISTS "Company users can delete decisions" ON public.decisions;
CREATE POLICY "Authorized users can read decisions"
ON public.decisions
FOR SELECT
TO authenticated
USING (
  company_id = my_company_id()
  AND check_entity_permission(auth.uid(), 'decision', id, 'view')
);
CREATE POLICY "Authorized users can update decisions"
ON public.decisions
FOR UPDATE
TO authenticated
USING (
  company_id = my_company_id()
  AND check_entity_permission(auth.uid(), 'decision', id, 'edit')
)
WITH CHECK (company_id = my_company_id());
CREATE POLICY "Authorized users can delete decisions"
ON public.decisions
FOR DELETE
TO authenticated
USING (
  company_id = my_company_id()
  AND check_entity_permission(auth.uid(), 'decision', id, 'delete')
);

DROP POLICY IF EXISTS "Company users can read sessions" ON public.sessions;
DROP POLICY IF EXISTS "Company users can update sessions" ON public.sessions;
DROP POLICY IF EXISTS "Company users can delete sessions" ON public.sessions;
CREATE POLICY "Authorized users can read sessions"
ON public.sessions
FOR SELECT
TO authenticated
USING (
  company_id = my_company_id()
  AND check_entity_permission(auth.uid(), 'session', id, 'view')
);
CREATE POLICY "Authorized users can update sessions"
ON public.sessions
FOR UPDATE
TO authenticated
USING (
  company_id = my_company_id()
  AND check_entity_permission(auth.uid(), 'session', id, 'edit')
)
WITH CHECK (company_id = my_company_id());
CREATE POLICY "Authorized users can delete sessions"
ON public.sessions
FOR DELETE
TO authenticated
USING (
  company_id = my_company_id()
  AND check_entity_permission(auth.uid(), 'session', id, 'delete')
);

DROP POLICY IF EXISTS "Company users can read meetings" ON public.meetings;
DROP POLICY IF EXISTS "Company users can update meetings" ON public.meetings;
DROP POLICY IF EXISTS "Company users can delete meetings" ON public.meetings;
CREATE POLICY "Authorized users can read meetings"
ON public.meetings
FOR SELECT
TO authenticated
USING (
  company_id = my_company_id()
  AND check_entity_permission(auth.uid(), 'meeting', id, 'view')
);
CREATE POLICY "Authorized users can update meetings"
ON public.meetings
FOR UPDATE
TO authenticated
USING (
  company_id = my_company_id()
  AND check_entity_permission(auth.uid(), 'meeting', id, 'edit')
)
WITH CHECK (company_id = my_company_id());
CREATE POLICY "Authorized users can delete meetings"
ON public.meetings
FOR DELETE
TO authenticated
USING (
  company_id = my_company_id()
  AND check_entity_permission(auth.uid(), 'meeting', id, 'delete')
);

DROP POLICY IF EXISTS "Company users can read comments" ON public.comments;
DROP POLICY IF EXISTS "Company users can insert comments" ON public.comments;
DROP POLICY IF EXISTS "Users can update own comments" ON public.comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON public.comments;
CREATE POLICY "Authorized users can read comments"
ON public.comments
FOR SELECT
TO authenticated
USING (
  company_id = my_company_id()
  AND check_entity_permission(auth.uid(), entity_type, entity_id, 'view')
);
CREATE POLICY "Authorized users can insert comments"
ON public.comments
FOR INSERT
TO authenticated
WITH CHECK (
  company_id = my_company_id()
  AND auth.uid() = user_id
  AND check_entity_permission(auth.uid(), entity_type, entity_id, 'comment')
);
CREATE POLICY "Authorized users can update own comments"
ON public.comments
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND check_entity_permission(auth.uid(), entity_type, entity_id, 'comment')
)
WITH CHECK (
  auth.uid() = user_id
  AND check_entity_permission(auth.uid(), entity_type, entity_id, 'comment')
);
CREATE POLICY "Authorized users can delete own comments"
ON public.comments
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  AND check_entity_permission(auth.uid(), entity_type, entity_id, 'comment')
);