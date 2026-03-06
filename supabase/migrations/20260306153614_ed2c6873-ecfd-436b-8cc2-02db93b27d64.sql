
-- Table to store PV version history
CREATE TABLE public.minute_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  minute_id UUID NOT NULL REFERENCES public.minutes(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  content TEXT,
  summary TEXT,
  modified_by UUID REFERENCES auth.users(id),
  company_id UUID REFERENCES public.companies(id) DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.minute_versions ENABLE ROW LEVEL SECURITY;

-- RLS policies: same company isolation as minutes
CREATE POLICY "Company users can read minute_versions"
  ON public.minute_versions FOR SELECT TO authenticated
  USING (company_id = my_company_id());

CREATE POLICY "Company users can insert minute_versions"
  ON public.minute_versions FOR INSERT TO authenticated
  WITH CHECK (company_id = my_company_id() AND user_has_permission(auth.uid(), 'valider_pv'));

CREATE POLICY "Company users can delete minute_versions"
  ON public.minute_versions FOR DELETE TO authenticated
  USING (company_id = my_company_id() AND user_has_permission(auth.uid(), 'valider_pv'));
