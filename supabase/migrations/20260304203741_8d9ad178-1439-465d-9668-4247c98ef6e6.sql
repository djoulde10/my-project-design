
-- Enums
CREATE TYPE public.organ_type AS ENUM ('ca', 'comite_audit');
CREATE TYPE public.member_quality AS ENUM ('pca', 'administrateur', 'president_comite', 'secretariat_juridique', 'autre');
CREATE TYPE public.session_type AS ENUM ('ordinaire', 'extraordinaire');
CREATE TYPE public.session_status AS ENUM ('brouillon', 'validee', 'tenue', 'cloturee', 'archivee');
CREATE TYPE public.agenda_nature AS ENUM ('information', 'decision');
CREATE TYPE public.solution_status AS ENUM ('adoptee', 'rejetee', 'ajournee');
CREATE TYPE public.action_status AS ENUM ('en_cours', 'terminee', 'en_retard', 'annulee');
CREATE TYPE public.pv_status AS ENUM ('brouillon', 'valide', 'signe');
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Organs
CREATE TABLE public.organs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type organ_type NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read organs" ON public.organs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage organs" ON public.organs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Members
CREATE TABLE public.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organ_id UUID REFERENCES public.organs(id) ON DELETE CASCADE NOT NULL,
  full_name TEXT NOT NULL,
  quality member_quality NOT NULL DEFAULT 'administrateur',
  email TEXT,
  phone TEXT,
  mandate_start DATE,
  mandate_end DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read members" ON public.members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage members" ON public.members FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Sessions
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organ_id UUID REFERENCES public.organs(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  session_type session_type NOT NULL DEFAULT 'ordinaire',
  session_date TIMESTAMPTZ NOT NULL,
  location TEXT,
  is_virtual BOOLEAN NOT NULL DEFAULT false,
  status session_status NOT NULL DEFAULT 'brouillon',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read sessions" ON public.sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage sessions" ON public.sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Agenda Items
CREATE TABLE public.agenda_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  nature agenda_nature NOT NULL DEFAULT 'information',
  order_index INTEGER NOT NULL DEFAULT 0,
  presenter_member_id UUID REFERENCES public.members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.agenda_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read agenda_items" ON public.agenda_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage agenda_items" ON public.agenda_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Documents
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  agenda_item_id UUID REFERENCES public.agenda_items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read documents" ON public.documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage documents" ON public.documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Session Attendees
CREATE TABLE public.session_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
  is_present BOOLEAN DEFAULT false,
  proxy_member_id UUID REFERENCES public.members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.session_attendees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read session_attendees" ON public.session_attendees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage session_attendees" ON public.session_attendees FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Minutes (PV)
CREATE TABLE public.minutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL UNIQUE,
  content TEXT,
  pv_status pv_status NOT NULL DEFAULT 'brouillon',
  validated_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.minutes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read minutes" ON public.minutes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage minutes" ON public.minutes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Solutions (Decisions)
CREATE TABLE public.solutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agenda_item_id UUID REFERENCES public.agenda_items(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status solution_status NOT NULL DEFAULT 'adoptee',
  vote_pour INTEGER DEFAULT 0,
  vote_contre INTEGER DEFAULT 0,
  vote_abstention INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.solutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read solutions" ON public.solutions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage solutions" ON public.solutions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Actions
CREATE TABLE public.actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solution_id UUID REFERENCES public.solutions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  responsible_member_id UUID REFERENCES public.members(id),
  due_date DATE,
  status action_status NOT NULL DEFAULT 'en_cours',
  completion_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read actions" ON public.actions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage actions" ON public.actions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Audit Log
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read audit_log" ON public.audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert audit_log" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- User Roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read user_roles" ON public.user_roles FOR SELECT TO authenticated USING (true);

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Trigger for auto-creating profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at triggers
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_organs_updated_at BEFORE UPDATE ON public.organs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON public.members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_agenda_items_updated_at BEFORE UPDATE ON public.agenda_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_minutes_updated_at BEFORE UPDATE ON public.minutes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_actions_updated_at BEFORE UPDATE ON public.actions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Storage bucket for session documents
INSERT INTO storage.buckets (id, name, public) VALUES ('session-documents', 'session-documents', false);
CREATE POLICY "Authenticated users can upload session docs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'session-documents');
CREATE POLICY "Authenticated users can read session docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'session-documents');

-- Seed default organs
INSERT INTO public.organs (name, type, description) VALUES
  ('Conseil d''Administration', 'ca', 'Organe principal de gouvernance'),
  ('Comité d''Audit', 'comite_audit', 'Comité spécialisé en audit et contrôle');
