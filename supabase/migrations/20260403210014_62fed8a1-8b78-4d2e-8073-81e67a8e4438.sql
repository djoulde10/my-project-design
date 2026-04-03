
-- Allow admins to delete signatures (to cancel a signature)
CREATE POLICY "Admins can delete signatures"
  ON public.signatures FOR DELETE
  TO authenticated
  USING (company_id = my_company_id() AND user_has_permission(auth.uid(), 'gerer_utilisateurs'));

-- Update the block_signed_minute_edit trigger to allow admin unsigning (reset to valide)
CREATE OR REPLACE FUNCTION public.block_signed_minute_edit()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = 'public'
AS $$
BEGIN
  IF OLD.pv_status = 'signe' THEN
    -- Allow resetting to 'valide' by admin (cancel signature)
    IF NEW.pv_status = 'valide' AND user_has_permission(auth.uid(), 'gerer_utilisateurs') THEN
      RETURN NEW;
    END IF;
    -- Block all other changes on signed documents
    IF NEW.content IS DISTINCT FROM OLD.content OR NEW.pv_status IS DISTINCT FROM OLD.pv_status THEN
      RAISE EXCEPTION 'Ce document est signé et ne peut plus être modifié';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
