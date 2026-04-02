
-- Notify president when a PV is validated (ready to sign)
CREATE OR REPLACE FUNCTION public.notify_pv_ready_to_sign()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  signer RECORD;
  session_title TEXT;
BEGIN
  -- Only trigger when status changes to 'valide'
  IF TG_OP != 'UPDATE' OR OLD.pv_status IS NOT DISTINCT FROM NEW.pv_status OR NEW.pv_status != 'valide' THEN
    RETURN NEW;
  END IF;

  SELECT s.title INTO session_title
  FROM public.sessions s WHERE s.id = NEW.session_id;

  -- Notify users with signer_pv permission in the same company
  FOR signer IN
    SELECT DISTINCT pr.id FROM public.profiles pr
    JOIN public.role_permissions rp ON rp.role_id = pr.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE p.nom = 'signer_pv' AND pr.statut = 'actif' AND pr.company_id = NEW.company_id
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (
      signer.id,
      'pv_ready_to_sign',
      'PV prêt à signer : ' || COALESCE(session_title, 'Session'),
      'Le procès-verbal de la session "' || COALESCE(session_title, '—') || '" a été validé et est prêt pour votre signature.',
      '/meetings',
      jsonb_build_object('session_id', NEW.session_id, 'minute_id', NEW.id)
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_pv_ready_to_sign
  AFTER UPDATE ON public.minutes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_pv_ready_to_sign();

-- Notify attendees when a PV is signed
CREATE OR REPLACE FUNCTION public.notify_pv_signed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  att RECORD;
  session_title TEXT;
  signer_name TEXT;
BEGIN
  -- Only trigger when status changes to 'signe'
  IF TG_OP != 'UPDATE' OR OLD.pv_status IS NOT DISTINCT FROM NEW.pv_status OR NEW.pv_status != 'signe' THEN
    RETURN NEW;
  END IF;

  SELECT s.title INTO session_title
  FROM public.sessions s WHERE s.id = NEW.session_id;

  -- Get signer name from signatures table
  SELECT COALESCE(p.full_name, 'Le Président') INTO signer_name
  FROM public.signatures sig
  JOIN public.profiles p ON p.id = sig.signed_by
  WHERE sig.entity_type = 'minute' AND sig.entity_id = NEW.id
  ORDER BY sig.signed_at DESC LIMIT 1;

  FOR att IN
    SELECT DISTINCT m.user_id FROM public.session_attendees sa
    JOIN public.members m ON m.id = sa.member_id
    WHERE sa.session_id = NEW.session_id AND m.user_id IS NOT NULL
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (
      att.user_id,
      'pv_signed',
      'PV signé : ' || COALESCE(session_title, 'Session'),
      COALESCE(signer_name, 'Le Président') || ' a signé le procès-verbal de la session "' || COALESCE(session_title, '—') || '".',
      '/meetings',
      jsonb_build_object('session_id', NEW.session_id, 'minute_id', NEW.id)
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_pv_signed
  AFTER UPDATE ON public.minutes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_pv_signed();
