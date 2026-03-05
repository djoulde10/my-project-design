
-- Table meetings pour stocker les réunions et leurs résultats IA
CREATE TABLE public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES public.companies(id),
  session_id UUID REFERENCES public.sessions(id),
  title TEXT NOT NULL,
  meeting_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  audio_file_path TEXT,
  audio_duration_seconds INTEGER,
  transcription TEXT,
  generated_pv TEXT,
  pv_status TEXT DEFAULT 'brouillon',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read meetings" ON public.meetings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage meetings" ON public.meetings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table pour les modèles de PV importés
CREATE TABLE public.meeting_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES public.companies(id),
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  extracted_content TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.meeting_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read meeting_templates" ON public.meeting_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage meeting_templates" ON public.meeting_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage bucket pour les fichiers audio
INSERT INTO storage.buckets (id, name, public) VALUES ('meeting-audio', 'meeting-audio', false);

CREATE POLICY "Auth users can upload meeting audio" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'meeting-audio');
CREATE POLICY "Auth users can read meeting audio" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'meeting-audio');
CREATE POLICY "Auth users can delete meeting audio" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'meeting-audio');

-- Storage bucket pour les templates PV
INSERT INTO storage.buckets (id, name, public) VALUES ('pv-templates', 'pv-templates', false);

CREATE POLICY "Auth users can upload pv templates" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'pv-templates');
CREATE POLICY "Auth users can read pv templates" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'pv-templates');
CREATE POLICY "Auth users can delete pv templates" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'pv-templates');

-- Trigger updated_at
CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
