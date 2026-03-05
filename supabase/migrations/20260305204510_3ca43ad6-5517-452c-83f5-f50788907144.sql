
-- Helper function to get current user's company_id
CREATE OR REPLACE FUNCTION public.my_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid()
$$;

-- Drop existing overly permissive policies and replace with company-scoped ones

-- SESSIONS
DROP POLICY IF EXISTS "Authenticated users can manage sessions" ON public.sessions;
DROP POLICY IF EXISTS "Authenticated users can read sessions" ON public.sessions;
CREATE POLICY "Company users can read sessions" ON public.sessions FOR SELECT TO authenticated USING (company_id = public.my_company_id());
CREATE POLICY "Company users can manage sessions" ON public.sessions FOR ALL TO authenticated USING (company_id = public.my_company_id()) WITH CHECK (company_id = public.my_company_id());

-- AGENDA_ITEMS
DROP POLICY IF EXISTS "Authenticated users can manage agenda_items" ON public.agenda_items;
DROP POLICY IF EXISTS "Authenticated users can read agenda_items" ON public.agenda_items;
CREATE POLICY "Company users can read agenda_items" ON public.agenda_items FOR SELECT TO authenticated USING (company_id = public.my_company_id());
CREATE POLICY "Company users can manage agenda_items" ON public.agenda_items FOR ALL TO authenticated USING (company_id = public.my_company_id()) WITH CHECK (company_id = public.my_company_id());

-- DOCUMENTS
DROP POLICY IF EXISTS "Authenticated users can manage documents" ON public.documents;
DROP POLICY IF EXISTS "Authenticated users can read documents" ON public.documents;
CREATE POLICY "Company users can read documents" ON public.documents FOR SELECT TO authenticated USING (company_id = public.my_company_id());
CREATE POLICY "Company users can manage documents" ON public.documents FOR ALL TO authenticated USING (company_id = public.my_company_id()) WITH CHECK (company_id = public.my_company_id());

-- MEMBERS
DROP POLICY IF EXISTS "Authenticated users can manage members" ON public.members;
DROP POLICY IF EXISTS "Authenticated users can read members" ON public.members;
CREATE POLICY "Company users can read members" ON public.members FOR SELECT TO authenticated USING (company_id = public.my_company_id());
CREATE POLICY "Company users can manage members" ON public.members FOR ALL TO authenticated USING (company_id = public.my_company_id()) WITH CHECK (company_id = public.my_company_id());

-- ORGANS
DROP POLICY IF EXISTS "Authenticated users can manage organs" ON public.organs;
DROP POLICY IF EXISTS "Authenticated users can read organs" ON public.organs;
CREATE POLICY "Company users can read organs" ON public.organs FOR SELECT TO authenticated USING (company_id = public.my_company_id());
CREATE POLICY "Company users can manage organs" ON public.organs FOR ALL TO authenticated USING (company_id = public.my_company_id()) WITH CHECK (company_id = public.my_company_id());

-- MINUTES
DROP POLICY IF EXISTS "Authenticated users can manage minutes" ON public.minutes;
DROP POLICY IF EXISTS "Authenticated users can read minutes" ON public.minutes;
CREATE POLICY "Company users can read minutes" ON public.minutes FOR SELECT TO authenticated USING (company_id = public.my_company_id());
CREATE POLICY "Company users can manage minutes" ON public.minutes FOR ALL TO authenticated USING (company_id = public.my_company_id()) WITH CHECK (company_id = public.my_company_id());

-- ACTIONS
DROP POLICY IF EXISTS "Authenticated users can manage actions" ON public.actions;
DROP POLICY IF EXISTS "Authenticated users can read actions" ON public.actions;
CREATE POLICY "Company users can read actions" ON public.actions FOR SELECT TO authenticated USING (company_id = public.my_company_id());
CREATE POLICY "Company users can manage actions" ON public.actions FOR ALL TO authenticated USING (company_id = public.my_company_id()) WITH CHECK (company_id = public.my_company_id());

-- DECISIONS
DROP POLICY IF EXISTS "Auth users can manage decisions" ON public.decisions;
DROP POLICY IF EXISTS "Auth users can read decisions" ON public.decisions;
CREATE POLICY "Company users can read decisions" ON public.decisions FOR SELECT TO authenticated USING (company_id = public.my_company_id());
CREATE POLICY "Company users can manage decisions" ON public.decisions FOR ALL TO authenticated USING (company_id = public.my_company_id()) WITH CHECK (company_id = public.my_company_id());

-- MEETINGS
DROP POLICY IF EXISTS "Auth users can manage meetings" ON public.meetings;
DROP POLICY IF EXISTS "Auth users can read meetings" ON public.meetings;
CREATE POLICY "Company users can read meetings" ON public.meetings FOR SELECT TO authenticated USING (company_id = public.my_company_id());
CREATE POLICY "Company users can manage meetings" ON public.meetings FOR ALL TO authenticated USING (company_id = public.my_company_id()) WITH CHECK (company_id = public.my_company_id());

-- MEETING_TEMPLATES
DROP POLICY IF EXISTS "Auth users can manage meeting_templates" ON public.meeting_templates;
DROP POLICY IF EXISTS "Auth users can read meeting_templates" ON public.meeting_templates;
CREATE POLICY "Company users can read meeting_templates" ON public.meeting_templates FOR SELECT TO authenticated USING (company_id = public.my_company_id());
CREATE POLICY "Company users can manage meeting_templates" ON public.meeting_templates FOR ALL TO authenticated USING (company_id = public.my_company_id()) WITH CHECK (company_id = public.my_company_id());

-- AUDIT_LOG
DROP POLICY IF EXISTS "Authenticated users can insert audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "Authenticated users can read audit_log" ON public.audit_log;
CREATE POLICY "Company users can read audit_log" ON public.audit_log FOR SELECT TO authenticated USING (company_id = public.my_company_id());
CREATE POLICY "Company users can insert audit_log" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (company_id = public.my_company_id());

-- COMPANIES - users can only see/manage their own company
DROP POLICY IF EXISTS "Auth users can manage companies" ON public.companies;
DROP POLICY IF EXISTS "Auth users can read companies" ON public.companies;
CREATE POLICY "Company users can read own company" ON public.companies FOR SELECT TO authenticated USING (id = public.my_company_id());
CREATE POLICY "Company users can manage own company" ON public.companies FOR ALL TO authenticated USING (id = public.my_company_id()) WITH CHECK (id = public.my_company_id());

-- SOLUTIONS (no company_id, scoped via agenda_items -> sessions)
DROP POLICY IF EXISTS "Authenticated users can manage solutions" ON public.solutions;
DROP POLICY IF EXISTS "Authenticated users can read solutions" ON public.solutions;
CREATE POLICY "Company users can read solutions" ON public.solutions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.agenda_items ai WHERE ai.id = agenda_item_id AND ai.company_id = public.my_company_id())
);
CREATE POLICY "Company users can manage solutions" ON public.solutions FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.agenda_items ai WHERE ai.id = agenda_item_id AND ai.company_id = public.my_company_id())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.agenda_items ai WHERE ai.id = agenda_item_id AND ai.company_id = public.my_company_id())
);

-- SESSION_ATTENDEES (no company_id, scoped via sessions)
DROP POLICY IF EXISTS "Authenticated users can manage session_attendees" ON public.session_attendees;
DROP POLICY IF EXISTS "Authenticated users can read session_attendees" ON public.session_attendees;
CREATE POLICY "Company users can read session_attendees" ON public.session_attendees FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.company_id = public.my_company_id())
);
CREATE POLICY "Company users can manage session_attendees" ON public.session_attendees FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.company_id = public.my_company_id())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.company_id = public.my_company_id())
);
