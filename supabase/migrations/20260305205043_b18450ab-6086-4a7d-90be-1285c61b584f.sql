
-- =============================================
-- FIX 1: Remove notification injection vulnerability
-- =============================================
-- Drop the overly permissive INSERT policy. SECURITY DEFINER triggers bypass RLS anyway.
DROP POLICY IF EXISTS "Service can insert notifications" ON public.notifications;

-- =============================================
-- FIX 2: Restrict profile self-escalation
-- =============================================
-- Replace the profiles UPDATE policy to only allow updating safe columns
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Users can only update their own safe fields (full_name, avatar_url)
-- We use a restrictive approach: the policy allows UPDATE but role_id/statut changes
-- are blocked by checking they haven't changed
CREATE POLICY "Users can update own safe fields" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role_id IS NOT DISTINCT FROM (SELECT p.role_id FROM public.profiles p WHERE p.id = auth.uid())
    AND statut IS NOT DISTINCT FROM (SELECT p.statut FROM public.profiles p WHERE p.id = auth.uid())
    AND company_id IS NOT DISTINCT FROM (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid())
  );

-- Admin-only policy for changing role_id, statut, company_id
CREATE POLICY "Admins can update all profile fields" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- FIX 3: Add role-based write policies for key tables
-- =============================================

-- Sessions: require creer_session for INSERT, modifier_session for UPDATE
DROP POLICY IF EXISTS "Company users can manage sessions" ON public.sessions;
CREATE POLICY "Company users can insert sessions" ON public.sessions
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.my_company_id() AND public.user_has_permission(auth.uid(), 'creer_session'));
CREATE POLICY "Company users can update sessions" ON public.sessions
  FOR UPDATE TO authenticated
  USING (company_id = public.my_company_id() AND public.user_has_permission(auth.uid(), 'modifier_session'))
  WITH CHECK (company_id = public.my_company_id());
CREATE POLICY "Company users can delete sessions" ON public.sessions
  FOR DELETE TO authenticated
  USING (company_id = public.my_company_id() AND public.user_has_permission(auth.uid(), 'modifier_session'));

-- Decisions: require creer_decisions
DROP POLICY IF EXISTS "Company users can manage decisions" ON public.decisions;
CREATE POLICY "Company users can insert decisions" ON public.decisions
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.my_company_id() AND public.user_has_permission(auth.uid(), 'creer_decisions'));
CREATE POLICY "Company users can update decisions" ON public.decisions
  FOR UPDATE TO authenticated
  USING (company_id = public.my_company_id() AND public.user_has_permission(auth.uid(), 'creer_decisions'))
  WITH CHECK (company_id = public.my_company_id());
CREATE POLICY "Company users can delete decisions" ON public.decisions
  FOR DELETE TO authenticated
  USING (company_id = public.my_company_id() AND public.user_has_permission(auth.uid(), 'creer_decisions'));

-- Documents: require gerer_documents
DROP POLICY IF EXISTS "Company users can manage documents" ON public.documents;
CREATE POLICY "Company users can insert documents" ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.my_company_id() AND public.user_has_permission(auth.uid(), 'gerer_documents'));
CREATE POLICY "Company users can update documents" ON public.documents
  FOR UPDATE TO authenticated
  USING (company_id = public.my_company_id() AND public.user_has_permission(auth.uid(), 'gerer_documents'))
  WITH CHECK (company_id = public.my_company_id());
CREATE POLICY "Company users can delete documents" ON public.documents
  FOR DELETE TO authenticated
  USING (company_id = public.my_company_id() AND public.user_has_permission(auth.uid(), 'gerer_documents'));

-- Members: require gerer_membres
DROP POLICY IF EXISTS "Company users can manage members" ON public.members;
CREATE POLICY "Company users can insert members" ON public.members
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.my_company_id() AND public.user_has_permission(auth.uid(), 'gerer_membres'));
CREATE POLICY "Company users can update members" ON public.members
  FOR UPDATE TO authenticated
  USING (company_id = public.my_company_id() AND public.user_has_permission(auth.uid(), 'gerer_membres'))
  WITH CHECK (company_id = public.my_company_id());
CREATE POLICY "Company users can delete members" ON public.members
  FOR DELETE TO authenticated
  USING (company_id = public.my_company_id() AND public.user_has_permission(auth.uid(), 'gerer_membres'));

-- Minutes: require valider_pv for write
DROP POLICY IF EXISTS "Company users can manage minutes" ON public.minutes;
CREATE POLICY "Company users can insert minutes" ON public.minutes
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.my_company_id() AND public.user_has_permission(auth.uid(), 'valider_pv'));
CREATE POLICY "Company users can update minutes" ON public.minutes
  FOR UPDATE TO authenticated
  USING (company_id = public.my_company_id() AND public.user_has_permission(auth.uid(), 'valider_pv'))
  WITH CHECK (company_id = public.my_company_id());
CREATE POLICY "Company users can delete minutes" ON public.minutes
  FOR DELETE TO authenticated
  USING (company_id = public.my_company_id() AND public.user_has_permission(auth.uid(), 'valider_pv'));

-- Organs: require gerer_organes
DROP POLICY IF EXISTS "Company users can manage organs" ON public.organs;
CREATE POLICY "Company users can insert organs" ON public.organs
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.my_company_id() AND public.user_has_permission(auth.uid(), 'gerer_organes'));
CREATE POLICY "Company users can update organs" ON public.organs
  FOR UPDATE TO authenticated
  USING (company_id = public.my_company_id() AND public.user_has_permission(auth.uid(), 'gerer_organes'))
  WITH CHECK (company_id = public.my_company_id());
CREATE POLICY "Company users can delete organs" ON public.organs
  FOR DELETE TO authenticated
  USING (company_id = public.my_company_id() AND public.user_has_permission(auth.uid(), 'gerer_organes'));

-- Actions: require suivre_actions
DROP POLICY IF EXISTS "Company users can manage actions" ON public.actions;
CREATE POLICY "Company users can insert actions" ON public.actions
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.my_company_id() AND public.user_has_permission(auth.uid(), 'suivre_actions'));
CREATE POLICY "Company users can update actions" ON public.actions
  FOR UPDATE TO authenticated
  USING (company_id = public.my_company_id() AND public.user_has_permission(auth.uid(), 'suivre_actions'))
  WITH CHECK (company_id = public.my_company_id());
CREATE POLICY "Company users can delete actions" ON public.actions
  FOR DELETE TO authenticated
  USING (company_id = public.my_company_id() AND public.user_has_permission(auth.uid(), 'suivre_actions'));

-- Agenda items: same as sessions (modifier_session)
DROP POLICY IF EXISTS "Company users can manage agenda_items" ON public.agenda_items;
CREATE POLICY "Company users can insert agenda_items" ON public.agenda_items
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.my_company_id() AND public.user_has_permission(auth.uid(), 'modifier_session'));
CREATE POLICY "Company users can update agenda_items" ON public.agenda_items
  FOR UPDATE TO authenticated
  USING (company_id = public.my_company_id() AND public.user_has_permission(auth.uid(), 'modifier_session'))
  WITH CHECK (company_id = public.my_company_id());
CREATE POLICY "Company users can delete agenda_items" ON public.agenda_items
  FOR DELETE TO authenticated
  USING (company_id = public.my_company_id() AND public.user_has_permission(auth.uid(), 'modifier_session'));

-- Session attendees: same as sessions
DROP POLICY IF EXISTS "Company users can manage session_attendees" ON public.session_attendees;
CREATE POLICY "Company users can insert session_attendees" ON public.session_attendees
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.company_id = public.my_company_id()) AND public.user_has_permission(auth.uid(), 'modifier_session'));
CREATE POLICY "Company users can update session_attendees" ON public.session_attendees
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.company_id = public.my_company_id()) AND public.user_has_permission(auth.uid(), 'modifier_session'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.company_id = public.my_company_id()));
CREATE POLICY "Company users can delete session_attendees" ON public.session_attendees
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.company_id = public.my_company_id()) AND public.user_has_permission(auth.uid(), 'modifier_session'));

-- Solutions: same permission as decisions
DROP POLICY IF EXISTS "Company users can manage solutions" ON public.solutions;
CREATE POLICY "Company users can insert solutions" ON public.solutions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.agenda_items ai WHERE ai.id = agenda_item_id AND ai.company_id = public.my_company_id()) AND public.user_has_permission(auth.uid(), 'creer_decisions'));
CREATE POLICY "Company users can update solutions" ON public.solutions
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.agenda_items ai WHERE ai.id = agenda_item_id AND ai.company_id = public.my_company_id()) AND public.user_has_permission(auth.uid(), 'creer_decisions'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.agenda_items ai WHERE ai.id = agenda_item_id AND ai.company_id = public.my_company_id()));
CREATE POLICY "Company users can delete solutions" ON public.solutions
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.agenda_items ai WHERE ai.id = agenda_item_id AND ai.company_id = public.my_company_id()) AND public.user_has_permission(auth.uid(), 'creer_decisions'));

-- Meetings: same as sessions
DROP POLICY IF EXISTS "Company users can manage meetings" ON public.meetings;
CREATE POLICY "Company users can insert meetings" ON public.meetings
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.my_company_id() AND public.user_has_permission(auth.uid(), 'creer_session'));
CREATE POLICY "Company users can update meetings" ON public.meetings
  FOR UPDATE TO authenticated
  USING (company_id = public.my_company_id() AND public.user_has_permission(auth.uid(), 'modifier_session'))
  WITH CHECK (company_id = public.my_company_id());
CREATE POLICY "Company users can delete meetings" ON public.meetings
  FOR DELETE TO authenticated
  USING (company_id = public.my_company_id() AND public.user_has_permission(auth.uid(), 'modifier_session'));

-- Meeting templates: same as documents
DROP POLICY IF EXISTS "Company users can manage meeting_templates" ON public.meeting_templates;
CREATE POLICY "Company users can insert meeting_templates" ON public.meeting_templates
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.my_company_id() AND public.user_has_permission(auth.uid(), 'gerer_documents'));
CREATE POLICY "Company users can update meeting_templates" ON public.meeting_templates
  FOR UPDATE TO authenticated
  USING (company_id = public.my_company_id() AND public.user_has_permission(auth.uid(), 'gerer_documents'))
  WITH CHECK (company_id = public.my_company_id());
CREATE POLICY "Company users can delete meeting_templates" ON public.meeting_templates
  FOR DELETE TO authenticated
  USING (company_id = public.my_company_id() AND public.user_has_permission(auth.uid(), 'gerer_documents'));

-- Companies: only admins can update
DROP POLICY IF EXISTS "Company users can manage own company" ON public.companies;
CREATE POLICY "Admins can manage own company" ON public.companies
  FOR ALL TO authenticated
  USING (id = public.my_company_id() AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (id = public.my_company_id() AND public.has_role(auth.uid(), 'admin'));

-- =============================================
-- FIX 4: Storage bucket company isolation
-- =============================================

-- Drop existing overly permissive storage policies
DROP POLICY IF EXISTS "Authenticated users can upload session docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read session docs" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can upload meeting audio" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can read meeting audio" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can delete meeting audio" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can upload pv templates" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can read pv templates" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can delete pv templates" ON storage.objects;

-- Company-scoped storage policies using path prefix: {company_id}/...
CREATE POLICY "Company scoped upload session docs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'session-documents'
    AND (storage.foldername(name))[1] = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Company scoped read session docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'session-documents'
    AND (storage.foldername(name))[1] = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Company scoped delete session docs" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'session-documents'
    AND (storage.foldername(name))[1] = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Company scoped upload meeting audio" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'meeting-audio'
    AND (storage.foldername(name))[1] = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Company scoped read meeting audio" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'meeting-audio'
    AND (storage.foldername(name))[1] = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Company scoped delete meeting audio" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'meeting-audio'
    AND (storage.foldername(name))[1] = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Company scoped upload pv templates" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'pv-templates'
    AND (storage.foldername(name))[1] = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Company scoped read pv templates" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'pv-templates'
    AND (storage.foldername(name))[1] = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Company scoped delete pv templates" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'pv-templates'
    AND (storage.foldername(name))[1] = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid())
  );
