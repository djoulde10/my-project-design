
-- 1. Trigger: Notify when agenda item is created
CREATE OR REPLACE FUNCTION public.notify_agenda_item_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  att RECORD;
  session_title TEXT;
BEGIN
  SELECT s.title INTO session_title
  FROM public.sessions s WHERE s.id = NEW.session_id;

  IF session_title IS NULL THEN
    RETURN NEW;
  END IF;

  FOR att IN
    SELECT DISTINCT m.user_id FROM public.session_attendees sa
    JOIN public.members m ON m.id = sa.member_id
    WHERE sa.session_id = NEW.session_id AND m.user_id IS NOT NULL
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (
      att.user_id,
      'agenda_item_created',
      'Nouvel ordre du jour : ' || NEW.title,
      'Un nouveau point a été ajouté à l''ordre du jour de la session "' || session_title || '" : ' || NEW.title,
      '/agenda',
      jsonb_build_object('session_id', NEW.session_id, 'agenda_item_id', NEW.id, 'nature', NEW.nature)
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_agenda_item_created ON public.agenda_items;
CREATE TRIGGER trg_notify_agenda_item_created
AFTER INSERT ON public.agenda_items
FOR EACH ROW EXECUTE FUNCTION public.notify_agenda_item_created();

-- 2. Trigger: Notify when minute (PV) is created or updated
CREATE OR REPLACE FUNCTION public.notify_minute_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    notif_message := 'Un procès-verbal a été créé pour la session "' || session_title || '". Vous pouvez le consulter et le relire.';
  ELSIF TG_OP = 'UPDATE' AND OLD.pv_status IS DISTINCT FROM NEW.pv_status THEN
    notif_type := 'minute_status_changed';
    notif_title := 'PV mis à jour : ' || session_title;
    notif_message := 'Le procès-verbal de la session "' || session_title || '" est passé au statut "' || NEW.pv_status || '".';
  ELSIF TG_OP = 'UPDATE' AND OLD.content IS DISTINCT FROM NEW.content THEN
    notif_type := 'minute_updated';
    notif_title := 'PV modifié : ' || session_title;
    notif_message := 'Le contenu du procès-verbal de la session "' || session_title || '" a été mis à jour.';
  ELSE
    RETURN NEW;
  END IF;

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
      jsonb_build_object('session_id', NEW.session_id, 'minute_id', NEW.id, 'pv_status', NEW.pv_status)
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_minute_changed ON public.minutes;
CREATE TRIGGER trg_notify_minute_changed
AFTER INSERT OR UPDATE ON public.minutes
FOR EACH ROW EXECUTE FUNCTION public.notify_minute_changed();

-- 3. Add email_sent column to notifications for tracking
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS email_sent boolean NOT NULL DEFAULT false;
