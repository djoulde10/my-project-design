-- Signatures table for electronic signatures on documents
CREATE TABLE public.signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL, -- 'minute' or 'decision'
  entity_id uuid NOT NULL,
  signed_by uuid NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  company_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES public.companies(id)
);

ALTER TABLE public.signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can read signatures" ON public.signatures
  FOR SELECT TO authenticated
  USING (company_id = my_company_id());

CREATE POLICY "Company users can insert signatures" ON public.signatures
  FOR INSERT TO authenticated
  WITH CHECK (company_id = my_company_id() AND user_has_permission(auth.uid(), 'signer_pv'));

-- Add profile fields for standard profile forms
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS titre_poste text;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS organisation text;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS linkedin_url text;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS adresse text;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS date_naissance date;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS nationalite text;