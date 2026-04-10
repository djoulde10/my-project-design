-- Drop triggers that reference the removed 'signe' status
DROP TRIGGER IF EXISTS trg_notify_pv_signed ON public.minutes;
DROP TRIGGER IF EXISTS trigger_notify_pv_signed ON public.minutes;
DROP TRIGGER IF EXISTS trg_notify_pv_ready_to_sign ON public.minutes;
DROP TRIGGER IF EXISTS trigger_notify_pv_ready_to_sign ON public.minutes;

-- Drop the obsolete functions
DROP FUNCTION IF EXISTS public.notify_pv_signed();
DROP FUNCTION IF EXISTS public.notify_pv_ready_to_sign();

-- Update notify_minute_changed to also notify presidents when PV is sent for validation
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

  -- Notify session attendees
  FOR att IN
    SELECT DISTINCT m.user_id FROM public.session_attendees sa
    JOIN public.members m ON m.id = sa.member_id
    WHERE sa.session_id = NEW.session_id AND m.user_id IS NOT NULL
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (
      att.user_id,
      notif_type,
      notif_title,
      notif_message,
      '/meetings',
      jsonb_build_object('session_id', NEW.session_id, 'minute_id', NEW.id, 'pv_status', NEW.pv_status::text)
    );
  END LOOP;

  -- When sent for validation, also notify presidents (valider_pv permission holders)
  IF TG_OP = 'UPDATE' AND NEW.pv_status = 'en_attente_validation' AND OLD.pv_status = 'brouillon' THEN
    FOR att IN
      SELECT DISTINCT pr.id FROM public.profiles pr
      JOIN public.role_permissions rp ON rp.role_id = pr.role_id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE p.nom = 'valider_pv' AND pr.statut = 'actif' AND pr.company_id = NEW.company_id
    LOOP
      INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
      VALUES (
        att.id,
        'pv_pending_validation',
        'PV en attente de validation : ' || session_title,
        'Le procès-verbal de la session "' || session_title || '" est prêt pour votre validation.',
        '/meetings',
        jsonb_build_object('session_id', NEW.session_id, 'minute_id', NEW.id)
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;