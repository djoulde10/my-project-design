CREATE OR REPLACE FUNCTION public.notify_comment_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mentioned_user_id uuid;
  author_name text;
  entity_label text;
  entity_link text;
BEGIN
  IF COALESCE(array_length(NEW.mentions, 1), 0) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(full_name, 'Quelqu''un')
  INTO author_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  entity_label := CASE NEW.entity_type
    WHEN 'minute' THEN 'procès-verbal'
    WHEN 'document' THEN 'document'
    WHEN 'decision' THEN 'décision'
    ELSE 'élément'
  END;

  entity_link := CASE NEW.entity_type
    WHEN 'minute' THEN '/meetings'
    WHEN 'document' THEN '/documents'
    WHEN 'decision' THEN '/decisions'
    ELSE '/'
  END;

  FOREACH mentioned_user_id IN ARRAY NEW.mentions LOOP
    IF mentioned_user_id IS NULL OR mentioned_user_id = NEW.user_id THEN
      CONTINUE;
    END IF;

    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (
      mentioned_user_id,
      'mention',
      author_name || ' vous a mentionné',
      author_name || ' vous a mentionné dans un commentaire sur un ' || entity_label || '.',
      entity_link,
      jsonb_build_object(
        'entity_type', NEW.entity_type,
        'entity_id', NEW.entity_id,
        'comment_id', NEW.id
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_comment_mentions ON public.comments;
CREATE TRIGGER notify_comment_mentions
AFTER INSERT ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.notify_comment_mentions();

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END;
$$;