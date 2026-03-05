
-- Fix notifications INSERT policy - only service role (triggers) should insert
-- The existing "Service can insert notifications" with WITH CHECK (true) is needed
-- because notifications are inserted by SECURITY DEFINER trigger functions.
-- This is correct behavior - triggers run as definer, not as the user.

-- Fix the 3 functions with mutable search_path
CREATE OR REPLACE FUNCTION public.generate_decision_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  seq_num integer;
BEGIN
  SELECT COALESCE(COUNT(*), 0) + 1 INTO seq_num FROM public.decisions WHERE session_id = NEW.session_id AND id != NEW.id;
  NEW.numero_decision := 'DEC-' || LPAD(seq_num::text, 3, '0');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_session_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  organ_prefix text;
  year_str text;
  seq_num integer;
BEGIN
  SELECT CASE WHEN o.type = 'ca' THEN 'CA' WHEN o.type = 'comite_audit' THEN 'CAUD' ELSE UPPER(SUBSTRING(o.name FROM 1 FOR 4)) END 
  INTO organ_prefix FROM public.organs o WHERE o.id = NEW.organ_id;
  year_str := EXTRACT(YEAR FROM NEW.session_date)::text;
  SELECT COALESCE(COUNT(*), 0) + 1 INTO seq_num 
  FROM public.sessions 
  WHERE organ_id = NEW.organ_id AND EXTRACT(YEAR FROM session_date) = EXTRACT(YEAR FROM NEW.session_date) AND id != NEW.id;
  NEW.numero_session := organ_prefix || '-' || year_str || '-' || LPAD(seq_num::text, 2, '0');
  RETURN NEW;
END;
$$;
