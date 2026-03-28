
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'profiles', 'companies', 'organs', 'members', 'sessions', 'agenda_items',
    'decisions', 'actions', 'documents', 'minutes', 'minute_versions',
    'meetings', 'meeting_templates', 'signatures', 'comments',
    'conflict_of_interests', 'approval_requests', 'notifications',
    'entity_permissions', 'role_permissions', 'roles', 'permissions',
    'feature_flags', 'api_keys', 'session_attendees', 'solutions',
    'support_tickets', 'meeting_ai_analysis'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_trigger ON public.%I', tbl);
    EXECUTE format(
      'CREATE TRIGGER audit_trigger
       AFTER INSERT OR UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func()',
      tbl
    );
  END LOOP;
END;
$$;
