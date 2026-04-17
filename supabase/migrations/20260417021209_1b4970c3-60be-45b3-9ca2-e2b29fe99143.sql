-- Enable pgcrypto for gen_random_bytes (used to generate convocation tokens)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Recreate functions referencing the schema-qualified name to avoid search_path issues
CREATE OR REPLACE FUNCTION public.auto_queue_convocations_on_publish()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _company_id uuid;
  _att record;
BEGIN
  IF NEW.is_published = true AND (OLD.is_published IS DISTINCT FROM true) THEN
    _company_id := NEW.company_id;
    FOR _att IN
      SELECT DISTINCT m.user_id, m.id AS member_id, COALESCE(m.email, u.email) AS email
      FROM public.session_attendees sa
      JOIN public.members m ON m.id = sa.member_id
      LEFT JOIN auth.users u ON u.id = m.user_id
      WHERE sa.session_id = NEW.id
        AND m.user_id IS NOT NULL
        AND COALESCE(m.email, u.email) IS NOT NULL
    LOOP
      INSERT INTO public.convocation_views (session_id, user_id, member_id, company_id, email, token, email_status)
      VALUES (NEW.id, _att.user_id, _att.member_id, _company_id, _att.email,
              encode(extensions.gen_random_bytes(24), 'hex'), 'pending')
      ON CONFLICT (session_id, user_id) DO NOTHING;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.queue_session_convocations(_session_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _company_id uuid;
  _count integer := 0;
  _att record;
BEGIN
  SELECT company_id INTO _company_id FROM public.sessions WHERE id = _session_id;
  IF _company_id IS NULL THEN
    RETURN 0;
  END IF;

  IF NOT (
    user_has_permission(auth.uid(), 'creer_session')
    OR user_has_permission(auth.uid(), 'modifier_session')
    OR has_role(auth.uid(), 'admin')
  ) THEN
    RAISE EXCEPTION 'Permission insuffisante';
  END IF;

  FOR _att IN
    SELECT DISTINCT m.user_id, m.id AS member_id, COALESCE(m.email, p_email.email) AS email
    FROM public.session_attendees sa
    JOIN public.members m ON m.id = sa.member_id
    LEFT JOIN auth.users p_email ON p_email.id = m.user_id
    WHERE sa.session_id = _session_id
      AND m.user_id IS NOT NULL
      AND COALESCE(m.email, p_email.email) IS NOT NULL
  LOOP
    INSERT INTO public.convocation_views (session_id, user_id, member_id, company_id, email, token, email_status)
    VALUES (
      _session_id, _att.user_id, _att.member_id, _company_id, _att.email,
      encode(extensions.gen_random_bytes(24), 'hex'), 'pending'
    )
    ON CONFLICT (session_id, user_id) DO UPDATE
      SET email_status = CASE WHEN convocation_views.email_status = 'failed' THEN 'pending' ELSE convocation_views.email_status END,
          updated_at = now();
    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$function$;