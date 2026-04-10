
CREATE OR REPLACE FUNCTION public.publish_minute(_minute_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
  _pv_status text;
  _is_published boolean;
BEGIN
  -- Get minute details
  SELECT m.company_id, m.pv_status, m.is_published
  INTO _company_id, _pv_status, _is_published
  FROM public.minutes m
  WHERE m.id = _minute_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PV introuvable';
  END IF;

  -- Check user belongs to same company
  IF _company_id IS DISTINCT FROM my_company_id() THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  -- Check user has modifier_session permission (Secrétariat juridique has this)
  IF NOT user_has_permission(auth.uid(), 'modifier_session') THEN
    RAISE EXCEPTION 'Permission insuffisante pour publier';
  END IF;

  -- Check PV is validated
  IF _pv_status != 'valide' THEN
    RAISE EXCEPTION 'Le PV doit être validé avant publication';
  END IF;

  -- Check not already published
  IF _is_published THEN
    RETURN true;
  END IF;

  -- Publish
  UPDATE public.minutes SET is_published = true, updated_at = now() WHERE id = _minute_id;

  RETURN true;
END;
$$;
