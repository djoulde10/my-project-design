
-- Drop existing audit triggers
DROP TRIGGER IF EXISTS audit_sessions ON public.sessions;
DROP TRIGGER IF EXISTS audit_agenda_items ON public.agenda_items;
DROP TRIGGER IF EXISTS audit_documents ON public.documents;
DROP TRIGGER IF EXISTS audit_minutes ON public.minutes;
DROP TRIGGER IF EXISTS audit_minute_versions ON public.minute_versions;
DROP TRIGGER IF EXISTS audit_decisions ON public.decisions;
DROP TRIGGER IF EXISTS audit_actions ON public.actions;
DROP TRIGGER IF EXISTS audit_members ON public.members;
DROP TRIGGER IF EXISTS audit_organs ON public.organs;
DROP TRIGGER IF EXISTS audit_session_attendees ON public.session_attendees;
DROP TRIGGER IF EXISTS audit_solutions ON public.solutions;
DROP TRIGGER IF EXISTS audit_comments ON public.comments;
DROP TRIGGER IF EXISTS audit_companies ON public.companies;
DROP TRIGGER IF EXISTS audit_profiles ON public.profiles;
DROP TRIGGER IF EXISTS audit_roles ON public.roles;
DROP TRIGGER IF EXISTS audit_role_permissions ON public.role_permissions;
DROP TRIGGER IF EXISTS audit_conflict_of_interests ON public.conflict_of_interests;
DROP TRIGGER IF EXISTS audit_approval_requests ON public.approval_requests;
DROP TRIGGER IF EXISTS audit_entity_permissions ON public.entity_permissions;
DROP TRIGGER IF EXISTS audit_meetings ON public.meetings;
DROP TRIGGER IF EXISTS audit_meeting_templates ON public.meeting_templates;
DROP TRIGGER IF EXISTS audit_meeting_ai_analysis ON public.meeting_ai_analysis;
DROP TRIGGER IF EXISTS audit_signatures ON public.signatures;
DROP TRIGGER IF EXISTS audit_api_keys ON public.api_keys;
DROP TRIGGER IF EXISTS audit_feature_flags ON public.feature_flags;
DROP TRIGGER IF EXISTS audit_invoices ON public.invoices;
DROP TRIGGER IF EXISTS audit_subscription_plans ON public.subscription_plans;
DROP TRIGGER IF EXISTS audit_support_tickets ON public.support_tickets;
DROP TRIGGER IF EXISTS audit_organization_usage ON public.organization_usage;

-- Create all audit triggers
CREATE TRIGGER audit_sessions AFTER INSERT OR UPDATE OR DELETE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_agenda_items AFTER INSERT OR UPDATE OR DELETE ON public.agenda_items FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_documents AFTER INSERT OR UPDATE OR DELETE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_minutes AFTER INSERT OR UPDATE OR DELETE ON public.minutes FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_minute_versions AFTER INSERT OR UPDATE OR DELETE ON public.minute_versions FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_decisions AFTER INSERT OR UPDATE OR DELETE ON public.decisions FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_actions AFTER INSERT OR UPDATE OR DELETE ON public.actions FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_members AFTER INSERT OR UPDATE OR DELETE ON public.members FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_organs AFTER INSERT OR UPDATE OR DELETE ON public.organs FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_session_attendees AFTER INSERT OR UPDATE OR DELETE ON public.session_attendees FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_solutions AFTER INSERT OR UPDATE OR DELETE ON public.solutions FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_comments AFTER INSERT OR UPDATE OR DELETE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_companies AFTER INSERT OR UPDATE OR DELETE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_profiles AFTER INSERT OR UPDATE OR DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_roles AFTER INSERT OR UPDATE OR DELETE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_role_permissions AFTER INSERT OR UPDATE OR DELETE ON public.role_permissions FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_conflict_of_interests AFTER INSERT OR UPDATE OR DELETE ON public.conflict_of_interests FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_approval_requests AFTER INSERT OR UPDATE OR DELETE ON public.approval_requests FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_entity_permissions AFTER INSERT OR UPDATE OR DELETE ON public.entity_permissions FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_meetings AFTER INSERT OR UPDATE OR DELETE ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_meeting_templates AFTER INSERT OR UPDATE OR DELETE ON public.meeting_templates FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_meeting_ai_analysis AFTER INSERT OR UPDATE OR DELETE ON public.meeting_ai_analysis FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_signatures AFTER INSERT OR UPDATE OR DELETE ON public.signatures FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_api_keys AFTER INSERT OR UPDATE OR DELETE ON public.api_keys FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_feature_flags AFTER INSERT OR UPDATE OR DELETE ON public.feature_flags FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_invoices AFTER INSERT OR UPDATE OR DELETE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_subscription_plans AFTER INSERT OR UPDATE OR DELETE ON public.subscription_plans FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_support_tickets AFTER INSERT OR UPDATE OR DELETE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_organization_usage AFTER INSERT OR UPDATE OR DELETE ON public.organization_usage FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- Document downloads table
CREATE TABLE public.document_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  company_id uuid REFERENCES public.companies(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.document_downloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own downloads" ON public.document_downloads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND company_id = my_company_id());

CREATE POLICY "Company admins can read downloads" ON public.document_downloads FOR SELECT TO authenticated
  USING (company_id = my_company_id() AND (user_has_permission(auth.uid(), 'consulter_audit') OR user_has_permission(auth.uid(), 'gerer_utilisateurs')));

CREATE POLICY "Users can read own downloads" ON public.document_downloads FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Super admins can read all downloads" ON public.document_downloads FOR SELECT TO authenticated
  USING (is_super_admin());

CREATE TRIGGER audit_document_downloads AFTER INSERT ON public.document_downloads FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
