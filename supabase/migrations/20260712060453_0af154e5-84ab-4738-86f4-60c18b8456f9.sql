
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.audit_trigger_func() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_attendee_added() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_agenda_item_created() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_approval_request() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_comment_mentions() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_document_added() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_minute_changed() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_session_created() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_session_updated() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_notification_quota() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_session_number() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_decision_number() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_member_quality() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_member_quality_from_role() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_privilege_escalation() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auto_queue_convocations_on_publish() FROM anon, authenticated, PUBLIC;
