
CREATE OR REPLACE FUNCTION public.update_company_colors(
  _couleur_principale text DEFAULT NULL,
  _couleur_secondaire text DEFAULT NULL,
  _couleur_accent text DEFAULT NULL,
  _couleur_fond text DEFAULT NULL,
  _couleur_sidebar text DEFAULT NULL,
  _couleur_carte text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
BEGIN
  SELECT company_id INTO _company_id FROM profiles WHERE id = auth.uid();
  IF _company_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE companies SET
    couleur_principale = COALESCE(_couleur_principale, couleur_principale),
    couleur_secondaire = COALESCE(_couleur_secondaire, couleur_secondaire),
    couleur_accent = COALESCE(_couleur_accent, couleur_accent),
    couleur_fond = COALESCE(_couleur_fond, couleur_fond),
    couleur_sidebar = COALESCE(_couleur_sidebar, couleur_sidebar),
    couleur_carte = COALESCE(_couleur_carte, couleur_carte),
    updated_at = now()
  WHERE id = _company_id;

  RETURN true;
END;
$$;
