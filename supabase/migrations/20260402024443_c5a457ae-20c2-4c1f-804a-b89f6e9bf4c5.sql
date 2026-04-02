-- Fix signatures SELECT RLS: allow all company users to read signatures (not just signer_pv/valider_pv)
DROP POLICY IF EXISTS "Company users can read signatures" ON public.signatures;
CREATE POLICY "Company users can read signatures"
  ON public.signatures FOR SELECT
  TO authenticated
  USING (company_id = my_company_id());

-- Create notification triggers on minutes table
CREATE TRIGGER trg_notify_pv_ready_to_sign
  AFTER UPDATE ON public.minutes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_pv_ready_to_sign();

CREATE TRIGGER trg_notify_pv_signed
  AFTER UPDATE ON public.minutes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_pv_signed();

-- Block modifications to signed minutes via trigger
CREATE OR REPLACE FUNCTION public.block_signed_minute_edit()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = 'public'
AS $$
BEGIN
  IF OLD.pv_status = 'signe' AND (
    NEW.content IS DISTINCT FROM OLD.content OR
    NEW.pv_status IS DISTINCT FROM OLD.pv_status
  ) THEN
    -- Allow only if unsigning (future feature), otherwise block
    IF NEW.pv_status != OLD.pv_status AND NEW.pv_status = 'signe' THEN
      -- This is the signing action itself, allow
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Ce document est signé et ne peut plus être modifié';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_block_signed_minute_edit
  BEFORE UPDATE ON public.minutes
  FOR EACH ROW
  EXECUTE FUNCTION public.block_signed_minute_edit();