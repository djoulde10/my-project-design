
ALTER TABLE public.signatures ADD COLUMN IF NOT EXISTS signature_image text;
ALTER TABLE public.signatures ADD COLUMN IF NOT EXISTS signature_type text DEFAULT 'drawn' CHECK (signature_type IN ('drawn', 'uploaded'));
