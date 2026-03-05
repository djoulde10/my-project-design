
-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL, -- 'session_created', 'document_added'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast queries
CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, is_read, created_at DESC);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow insert from service role (triggers/functions)
CREATE POLICY "Service can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Function: notify all session attendees
CREATE OR REPLACE FUNCTION public.notify_session_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  att RECORD;
  session_title TEXT;
  session_date TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT s.title, s.session_date INTO session_title, session_date
  FROM public.sessions s WHERE s.id = NEW.session_id;

  IF session_title IS NULL THEN
    RETURN NEW;
  END IF;

  FOR att IN
    SELECT m.user_id FROM public.session_attendees sa
    JOIN public.members m ON m.id = sa.member_id
    WHERE sa.session_id = NEW.session_id AND m.user_id IS NOT NULL
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (
      att.user_id,
      'session_created',
      'Nouvelle session : ' || session_title,
      'Vous êtes invité à la session "' || session_title || '" prévue le ' || to_char(session_date, 'DD/MM/YYYY à HH24:MI') || '.',
      '/sessions',
      jsonb_build_object('session_id', NEW.session_id)
    );
  END LOOP;
  RETURN NEW;
END;
$$;

-- Trigger on session_attendees insert (batch-friendly: fires per row after all inserts)
CREATE TRIGGER trg_notify_session_attendee
  AFTER INSERT ON public.session_attendees
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_session_created();

-- Function: notify when document added to a session
CREATE OR REPLACE FUNCTION public.notify_document_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  att RECORD;
  session_title TEXT;
  uploader_name TEXT;
BEGIN
  SELECT s.title INTO session_title
  FROM public.sessions s WHERE s.id = NEW.session_id;

  SELECT COALESCE(p.full_name, 'Un utilisateur') INTO uploader_name
  FROM public.profiles p WHERE p.id = NEW.uploaded_by;

  FOR att IN
    SELECT DISTINCT m.user_id FROM public.session_attendees sa
    JOIN public.members m ON m.id = sa.member_id
    WHERE sa.session_id = NEW.session_id AND m.user_id IS NOT NULL AND m.user_id != COALESCE(NEW.uploaded_by, '00000000-0000-0000-0000-000000000000')
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (
      att.user_id,
      'document_added',
      'Nouveau document : ' || NEW.name,
      uploader_name || ' a ajouté "' || NEW.name || '" à la session "' || COALESCE(session_title, '—') || '".',
      '/sessions',
      jsonb_build_object('session_id', NEW.session_id, 'document_id', NEW.id)
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_document_added
  AFTER INSERT ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_document_added();
