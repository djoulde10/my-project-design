
-- Remove 'signe' from pv_status enum
-- First update any existing rows that have 'signe' to 'valide'
UPDATE public.minutes SET pv_status = 'valide' WHERE pv_status = 'signe';

-- Recreate enum without 'signe'
ALTER TYPE public.pv_status RENAME TO pv_status_old;
CREATE TYPE public.pv_status AS ENUM ('brouillon', 'valide');
ALTER TABLE public.minutes ALTER COLUMN pv_status DROP DEFAULT;
ALTER TABLE public.minutes ALTER COLUMN pv_status TYPE public.pv_status USING pv_status::text::public.pv_status;
ALTER TABLE public.minutes ALTER COLUMN pv_status SET DEFAULT 'brouillon'::public.pv_status;
DROP TYPE public.pv_status_old;

-- Drop the block_signed_minute_edit function (no longer needed)
DROP FUNCTION IF EXISTS public.block_signed_minute_edit() CASCADE;

-- Update publish_minute to also set session status to 'tenue'
CREATE OR REPLACE FUNCTION public.publish_minute(_minute_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _company_id uuid;
  _pv_status text;
  _is_published boolean;
  _session_id uuid;
BEGIN
  -- Get minute details
  SELECT m.company_id, m.pv_status, m.is_published, m.session_id
  INTO _company_id, _pv_status, _is_published, _session_id
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

  -- Publish the PV
  UPDATE public.minutes SET is_published = true, updated_at = now() WHERE id = _minute_id;

  -- Auto-update session status to 'tenue' if not already past that stage
  IF _session_id IS NOT NULL THEN
    UPDATE public.sessions 
    SET status = 'tenue', updated_at = now() 
    WHERE id = _session_id 
      AND status IN ('brouillon', 'validee');
  END IF;

  RETURN true;
END;
$function$;
