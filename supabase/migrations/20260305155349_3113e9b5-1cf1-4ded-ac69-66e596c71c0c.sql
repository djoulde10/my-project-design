
-- 1. Companies table
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  secteur text,
  pays text,
  logo_url text,
  couleur_principale text DEFAULT '#1e40af',
  plan_abonnement text DEFAULT 'standard',
  date_expiration timestamptz,
  statut text DEFAULT 'actif',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read companies" ON public.companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage companies" ON public.companies FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Insert default company
INSERT INTO public.companies (id, nom, secteur, pays) VALUES ('00000000-0000-0000-0000-000000000001', 'Entreprise par défaut', 'Général', 'Maroc');

-- 2. Add company_id to existing tables
ALTER TABLE public.organs ADD COLUMN company_id uuid REFERENCES public.companies(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.members ADD COLUMN company_id uuid REFERENCES public.companies(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.sessions ADD COLUMN company_id uuid REFERENCES public.companies(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.sessions ADD COLUMN numero_session text;
ALTER TABLE public.agenda_items ADD COLUMN company_id uuid REFERENCES public.companies(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.documents ADD COLUMN company_id uuid REFERENCES public.companies(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.documents ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE public.minutes ADD COLUMN company_id uuid REFERENCES public.companies(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.actions ADD COLUMN company_id uuid REFERENCES public.companies(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.audit_log ADD COLUMN company_id uuid REFERENCES public.companies(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.profiles ADD COLUMN company_id uuid REFERENCES public.companies(id) DEFAULT '00000000-0000-0000-0000-000000000001';

-- 3. Add session_type 'speciale'
ALTER TYPE public.session_type ADD VALUE IF NOT EXISTS 'speciale';

-- 4. Decisions table
CREATE TABLE public.decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  session_id uuid REFERENCES public.sessions(id) NOT NULL,
  agenda_item_id uuid REFERENCES public.agenda_items(id),
  numero_decision text,
  texte text NOT NULL,
  type_vote text DEFAULT 'unanimite',
  responsable_execution uuid REFERENCES public.members(id),
  date_effet date,
  statut text DEFAULT 'adoptee',
  vote_pour integer DEFAULT 0,
  vote_contre integer DEFAULT 0,
  vote_abstention integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read decisions" ON public.decisions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage decisions" ON public.decisions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_decisions_updated_at BEFORE UPDATE ON public.decisions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5. Add decision_id to actions
ALTER TABLE public.actions ADD COLUMN decision_id uuid REFERENCES public.decisions(id);

-- 6. Indexes
CREATE INDEX idx_organs_company ON public.organs(company_id);
CREATE INDEX idx_members_company ON public.members(company_id);
CREATE INDEX idx_sessions_company ON public.sessions(company_id);
CREATE INDEX idx_sessions_date ON public.sessions(session_date);
CREATE INDEX idx_agenda_items_company ON public.agenda_items(company_id);
CREATE INDEX idx_documents_company ON public.documents(company_id);
CREATE INDEX idx_minutes_company ON public.minutes(company_id);
CREATE INDEX idx_actions_company ON public.actions(company_id);
CREATE INDEX idx_actions_status ON public.actions(status);
CREATE INDEX idx_audit_log_company ON public.audit_log(company_id);
CREATE INDEX idx_decisions_company ON public.decisions(company_id);
CREATE INDEX idx_decisions_session ON public.decisions(session_id);

-- 7. Auto-generate session number
CREATE OR REPLACE FUNCTION public.generate_session_number()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  organ_prefix text;
  year_str text;
  seq_num integer;
BEGIN
  SELECT CASE WHEN o.type = 'ca' THEN 'CA' WHEN o.type = 'comite_audit' THEN 'CAUD' ELSE UPPER(SUBSTRING(o.name FROM 1 FOR 4)) END 
  INTO organ_prefix FROM public.organs o WHERE o.id = NEW.organ_id;
  year_str := EXTRACT(YEAR FROM NEW.session_date)::text;
  SELECT COALESCE(COUNT(*), 0) + 1 INTO seq_num 
  FROM public.sessions 
  WHERE organ_id = NEW.organ_id AND EXTRACT(YEAR FROM session_date) = EXTRACT(YEAR FROM NEW.session_date) AND id != NEW.id;
  NEW.numero_session := organ_prefix || '-' || year_str || '-' || LPAD(seq_num::text, 2, '0');
  RETURN NEW;
END;
$function$;

CREATE TRIGGER generate_session_number_trigger BEFORE INSERT ON public.sessions FOR EACH ROW EXECUTE FUNCTION generate_session_number();

-- 8. Auto-generate decision number
CREATE OR REPLACE FUNCTION public.generate_decision_number()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  seq_num integer;
BEGIN
  SELECT COALESCE(COUNT(*), 0) + 1 INTO seq_num FROM public.decisions WHERE session_id = NEW.session_id AND id != NEW.id;
  NEW.numero_decision := 'DEC-' || LPAD(seq_num::text, 3, '0');
  RETURN NEW;
END;
$function$;

CREATE TRIGGER generate_decision_number_trigger BEFORE INSERT ON public.decisions FOR EACH ROW EXECUTE FUNCTION generate_decision_number();
