ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS couleur_secondaire text DEFAULT NULL;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS couleur_accent text DEFAULT NULL;