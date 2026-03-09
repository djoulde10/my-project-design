
-- Table to store AI analysis results for meetings/minutes
CREATE TABLE public.meeting_ai_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  minute_id uuid REFERENCES public.minutes(id) ON DELETE CASCADE NOT NULL,
  company_id uuid REFERENCES public.companies(id) DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  summary text,
  suggested_decisions jsonb DEFAULT '[]'::jsonb,
  suggested_actions jsonb DEFAULT '[]'::jsonb,
  suggested_agenda jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE(minute_id)
);

-- Enable RLS
ALTER TABLE public.meeting_ai_analysis ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Company users can read meeting_ai_analysis"
  ON public.meeting_ai_analysis FOR SELECT
  TO authenticated
  USING (company_id = my_company_id());

CREATE POLICY "Company users can insert meeting_ai_analysis"
  ON public.meeting_ai_analysis FOR INSERT
  TO authenticated
  WITH CHECK (company_id = my_company_id() AND user_has_permission(auth.uid(), 'modifier_session'));

CREATE POLICY "Company users can update meeting_ai_analysis"
  ON public.meeting_ai_analysis FOR UPDATE
  TO authenticated
  USING (company_id = my_company_id() AND user_has_permission(auth.uid(), 'modifier_session'))
  WITH CHECK (company_id = my_company_id());

CREATE POLICY "Company users can delete meeting_ai_analysis"
  ON public.meeting_ai_analysis FOR DELETE
  TO authenticated
  USING (company_id = my_company_id() AND user_has_permission(auth.uid(), 'modifier_session'));

-- Audit trigger
CREATE TRIGGER audit_meeting_ai_analysis
  AFTER INSERT OR UPDATE OR DELETE ON public.meeting_ai_analysis
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
