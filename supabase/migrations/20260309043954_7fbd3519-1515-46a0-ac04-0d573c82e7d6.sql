
-- Table for conflict of interest declarations
CREATE TABLE public.conflict_of_interests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  company_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES public.companies(id),
  subject TEXT NOT NULL,
  description TEXT,
  related_decisions TEXT[],
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'waived')),
  declared_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.conflict_of_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can read conflict_of_interests"
  ON public.conflict_of_interests FOR SELECT
  USING (company_id = public.my_company_id());

CREATE POLICY "Company users can insert conflict_of_interests"
  ON public.conflict_of_interests FOR INSERT
  WITH CHECK (company_id = public.my_company_id());

CREATE POLICY "Company users can update conflict_of_interests"
  ON public.conflict_of_interests FOR UPDATE
  USING (company_id = public.my_company_id())
  WITH CHECK (company_id = public.my_company_id());

CREATE POLICY "Company users can delete conflict_of_interests"
  ON public.conflict_of_interests FOR DELETE
  USING (company_id = public.my_company_id() AND public.user_has_permission(auth.uid(), 'gerer_membres'));

-- Trigger for updated_at
CREATE TRIGGER update_conflict_of_interests_updated_at
  BEFORE UPDATE ON public.conflict_of_interests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
