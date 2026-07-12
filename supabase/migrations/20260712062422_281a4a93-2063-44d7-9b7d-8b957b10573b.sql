
-- Broadcast RPC (fan out to notifications with elevated rights)
CREATE OR REPLACE FUNCTION public.send_admin_broadcast(
  _title text,
  _message text,
  _level text DEFAULT 'info',
  _scope text DEFAULT 'all',
  _target_company_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _broadcast_id uuid;
  _recipients int := 0;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  IF _title IS NULL OR length(btrim(_title)) = 0 OR _message IS NULL OR length(btrim(_message)) = 0 THEN
    RAISE EXCEPTION 'Titre et message requis';
  END IF;

  INSERT INTO public.admin_broadcasts (title, message, level, scope, target_company_ids, sent_by, recipients_count)
  VALUES (
    _title, _message, _level, _scope,
    CASE WHEN _scope = 'org' AND _target_company_id IS NOT NULL THEN ARRAY[_target_company_id] ELSE NULL END,
    auth.uid(), 0
  )
  RETURNING id INTO _broadcast_id;

  WITH targets AS (
    SELECT id FROM public.profiles
    WHERE statut = 'actif'
      AND (
        _scope = 'all'
        OR (_scope = 'org' AND company_id = _target_company_id)
      )
  ), ins AS (
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    SELECT t.id, 'admin_broadcast', _title, _message, '/',
           jsonb_build_object('broadcast_id', _broadcast_id, 'level', _level)
    FROM targets t
    RETURNING 1
  )
  SELECT count(*) INTO _recipients FROM ins;

  UPDATE public.admin_broadcasts SET recipients_count = _recipients WHERE id = _broadcast_id;

  RETURN jsonb_build_object('broadcast_id', _broadcast_id, 'recipients', _recipients);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.send_admin_broadcast(text, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_admin_broadcast(text, text, text, text, uuid) TO authenticated;
