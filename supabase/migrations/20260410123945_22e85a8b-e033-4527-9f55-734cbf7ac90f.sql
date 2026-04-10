
-- 1. Remove duplicate audit triggers (keep audit_<table>, drop audit_trigger)
DROP TRIGGER IF EXISTS audit_trigger ON public.agenda_items;
DROP TRIGGER IF EXISTS audit_trigger ON public.approval_requests;
DROP TRIGGER IF EXISTS audit_trigger ON public.comments;
DROP TRIGGER IF EXISTS audit_trigger ON public.documents;
DROP TRIGGER IF EXISTS audit_trigger ON public.minutes;
DROP TRIGGER IF EXISTS audit_trigger ON public.session_attendees;
DROP TRIGGER IF EXISTS audit_trigger ON public.sessions;

-- 2. Remove the duplicate session notification trigger
-- trg_notify_session_attendee (notify_session_created) sends to ALL attendees on each insert
-- trg_notify_attendee_added already notifies the specific member added
DROP TRIGGER IF EXISTS trg_notify_session_attendee ON public.session_attendees;

-- 3. Update notify_minute_changed to deduplicate president notifications
CREATE OR REPLACE FUNCTION public.notify_minute_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  att RECORD;
  session_title TEXT;
  notif_type TEXT;
  notif_title TEXT;
  notif_message TEXT;
  notified_users uuid[] := '{}';
BEGIN
  SELECT s.title INTO session_title
  FROM public.sessions s WHERE s.id = NEW.session_id;

  IF session_title IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    notif_type := 'minute_created';
    notif_title := 'Nouveau PV : ' || session_title;
    notif_message := 'Un procès-verbal a été créé pour la session "' || session_title || '".';
  ELSIF TG_OP = 'UPDATE' AND OLD.pv_status IS DISTINCT FROM NEW.pv_status THEN
    notif_type := 'minute_status_changed';
    notif_title := 'PV mis à jour : ' || session_title;
    notif_message := 'Le procès-verbal de la session "' || session_title || '" est passé au statut "' || NEW.pv_status::text || '".';
  ELSIF TG_OP = 'UPDATE' AND OLD.content IS DISTINCT FROM NEW.content THEN
    notif_type := 'minute_updated';
    notif_title := 'PV modifié : ' || session_title;
    notif_message := 'Le contenu du procès-verbal de la session "' || session_title || '" a été mis à jour.';
  ELSE
    RETURN NEW;
  END IF;

  -- Notify session attendees (only for non-draft status changes visible to them)
  -- Skip notifying attendees for draft-only changes since they can't see drafts
  IF NOT (TG_OP = 'INSERT' AND NEW.pv_status = 'brouillon') THEN
    FOR att IN
      SELECT DISTINCT m.user_id FROM public.session_attendees sa
      JOIN public.members m ON m.id = sa.member_id
      WHERE sa.session_id = NEW.session_id AND m.user_id IS NOT NULL
    LOOP
      INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
      VALUES (att.user_id, notif_type, notif_title, notif_message, '/meetings',
        jsonb_build_object('session_id', NEW.session_id, 'minute_id', NEW.id, 'pv_status', NEW.pv_status::text));
      notified_users := array_append(notified_users, att.user_id);
    END LOOP;
  END IF;

  -- When sent for validation, also notify presidents NOT already notified
  IF TG_OP = 'UPDATE' AND NEW.pv_status = 'en_attente_validation' AND OLD.pv_status = 'brouillon' THEN
    FOR att IN
      SELECT DISTINCT pr.id FROM public.profiles pr
      JOIN public.role_permissions rp ON rp.role_id = pr.role_id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE p.nom = 'valider_pv' AND pr.statut = 'actif' AND pr.company_id = NEW.company_id
        AND NOT (pr.id = ANY(notified_users))
    LOOP
      INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
      VALUES (att.id, 'pv_pending_validation',
        'PV en attente de validation : ' || session_title,
        'Le procès-verbal de la session "' || session_title || '" est prêt pour votre validation.',
        '/meetings', jsonb_build_object('session_id', NEW.session_id, 'minute_id', NEW.id));
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. Create function to enforce 15-notification quota per user
CREATE OR REPLACE FUNCTION public.enforce_notification_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.notifications
  WHERE id IN (
    SELECT id FROM public.notifications
    WHERE user_id = NEW.user_id
    ORDER BY created_at DESC
    OFFSET 15
  );
  RETURN NEW;
END;
$function$;

-- 5. Create trigger to enforce quota after each insert
CREATE TRIGGER trg_enforce_notification_quota
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.enforce_notification_quota();
