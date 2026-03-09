
-- Create a generic audit trigger function that logs all changes to audit_log
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _company_id uuid;
  _details jsonb;
  _entity_id uuid;
  _action text;
BEGIN
  _user_id := auth.uid();
  
  -- Determine action
  _action := TG_OP;
  
  -- Get entity_id and details based on operation
  IF TG_OP = 'DELETE' THEN
    _entity_id := OLD.id;
    _details := to_jsonb(OLD);
    -- Try to get company_id from OLD record
    IF to_jsonb(OLD) ? 'company_id' THEN
      _company_id := (to_jsonb(OLD)->>'company_id')::uuid;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    _entity_id := NEW.id;
    _details := to_jsonb(NEW);
    IF to_jsonb(NEW) ? 'company_id' THEN
      _company_id := (to_jsonb(NEW)->>'company_id')::uuid;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    _entity_id := NEW.id;
    -- For updates, store old and new values of changed fields
    _details := jsonb_build_object(
      'old', to_jsonb(OLD),
      'new', to_jsonb(NEW)
    );
    IF to_jsonb(NEW) ? 'company_id' THEN
      _company_id := (to_jsonb(NEW)->>'company_id')::uuid;
    END IF;
  END IF;

  -- Fallback company_id from user profile
  IF _company_id IS NULL AND _user_id IS NOT NULL THEN
    SELECT company_id INTO _company_id FROM public.profiles WHERE id = _user_id;
  END IF;

  -- Remove sensitive/large fields from details
  _details := _details - 'password' - 'password_hash';

  INSERT INTO public.audit_log (action, entity_type, entity_id, user_id, company_id, details)
  VALUES (_action, TG_TABLE_NAME, _entity_id, _user_id, _company_id, _details);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

-- Attach triggers to all main tables
CREATE TRIGGER audit_sessions AFTER INSERT OR UPDATE OR DELETE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_agenda_items AFTER INSERT OR UPDATE OR DELETE ON public.agenda_items FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_documents AFTER INSERT OR UPDATE OR DELETE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_minutes AFTER INSERT OR UPDATE OR DELETE ON public.minutes FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_minute_versions AFTER INSERT OR UPDATE OR DELETE ON public.minute_versions FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_solutions AFTER INSERT OR UPDATE OR DELETE ON public.solutions FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_actions AFTER INSERT OR UPDATE OR DELETE ON public.actions FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_members AFTER INSERT OR UPDATE OR DELETE ON public.members FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_session_attendees AFTER INSERT OR UPDATE OR DELETE ON public.session_attendees FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_decisions AFTER INSERT OR UPDATE OR DELETE ON public.decisions FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_organs AFTER INSERT OR UPDATE OR DELETE ON public.organs FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_signatures AFTER INSERT OR UPDATE OR DELETE ON public.signatures FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_meetings AFTER INSERT OR UPDATE OR DELETE ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_meeting_templates AFTER INSERT OR UPDATE OR DELETE ON public.meeting_templates FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_profiles AFTER UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_notifications AFTER INSERT OR UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
