
-- API Keys table for public API access
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  key_hash text NOT NULL,
  key_prefix text NOT NULL,
  name text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{read}',
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamp with time zone,
  expires_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  revoked_at timestamp with time zone
);

-- Index for fast lookup by key_hash
CREATE INDEX idx_api_keys_key_hash ON public.api_keys(key_hash);
CREATE INDEX idx_api_keys_company_id ON public.api_keys(company_id);

-- Enable RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Company admins can manage their own API keys
CREATE POLICY "Company admins can manage api_keys" ON public.api_keys
  FOR ALL TO authenticated
  USING (company_id = my_company_id() AND user_has_permission(auth.uid(), 'gerer_utilisateurs'))
  WITH CHECK (company_id = my_company_id() AND user_has_permission(auth.uid(), 'gerer_utilisateurs'));

-- Company users can read api_keys (to see list)
CREATE POLICY "Company users can read api_keys" ON public.api_keys
  FOR SELECT TO authenticated
  USING (company_id = my_company_id());

-- Function to validate API key (used by edge function)
CREATE OR REPLACE FUNCTION public.validate_api_key(_key_hash text)
RETURNS TABLE(company_id uuid, scopes text[], key_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT ak.company_id, ak.scopes, ak.id
  FROM public.api_keys ak
  WHERE ak.key_hash = _key_hash
    AND ak.is_active = true
    AND ak.revoked_at IS NULL
    AND (ak.expires_at IS NULL OR ak.expires_at > now())
$$;
