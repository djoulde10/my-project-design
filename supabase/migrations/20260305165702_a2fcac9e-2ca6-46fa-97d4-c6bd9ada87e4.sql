
-- =============================================
-- 1. Table ROLES (remplace l'enum app_role)
-- =============================================
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read roles" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage roles" ON public.roles FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed default roles
INSERT INTO public.roles (nom, description) VALUES
  ('Administrateur', 'Accès complet à toutes les fonctionnalités'),
  ('Président', 'Présidence des sessions et validation des PV'),
  ('Secrétaire', 'Rédaction des PV et gestion documentaire'),
  ('Membre', 'Participation aux sessions et consultation'),
  ('Auditeur', 'Consultation et audit des activités');

-- =============================================
-- 2. Table PERMISSIONS
-- =============================================
CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read permissions" ON public.permissions FOR SELECT TO authenticated USING (true);

-- Seed permissions
INSERT INTO public.permissions (nom, description) VALUES
  ('gerer_utilisateurs', 'Créer, modifier et supprimer des utilisateurs'),
  ('creer_session', 'Créer une nouvelle session'),
  ('modifier_session', 'Modifier une session existante'),
  ('valider_pv', 'Valider un procès-verbal'),
  ('signer_pv', 'Signer un procès-verbal'),
  ('consulter_documents', 'Consulter les documents'),
  ('gerer_documents', 'Ajouter et modifier des documents'),
  ('gerer_membres', 'Gérer les membres des organes'),
  ('creer_decisions', 'Créer des décisions'),
  ('suivre_actions', 'Suivre et gérer les actions'),
  ('consulter_audit', 'Consulter le journal d''audit'),
  ('gerer_organes', 'Gérer les organes de gouvernance');

-- =============================================
-- 3. Table ROLE_PERMISSIONS (junction)
-- =============================================
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  UNIQUE(role_id, permission_id)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read role_permissions" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage role_permissions" ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed role_permissions: Administrateur gets ALL permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p WHERE r.nom = 'Administrateur';

-- Président: sessions, PV, decisions, documents, actions, audit
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p 
WHERE r.nom = 'Président' AND p.nom IN ('creer_session', 'modifier_session', 'valider_pv', 'signer_pv', 'consulter_documents', 'gerer_documents', 'creer_decisions', 'suivre_actions', 'consulter_audit');

-- Secrétaire: sessions, PV, documents, membres, actions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p 
WHERE r.nom = 'Secrétaire' AND p.nom IN ('creer_session', 'modifier_session', 'valider_pv', 'consulter_documents', 'gerer_documents', 'gerer_membres', 'suivre_actions');

-- Membre: consultation et participation
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p 
WHERE r.nom = 'Membre' AND p.nom IN ('consulter_documents', 'suivre_actions');

-- Auditeur: consultation et audit
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p 
WHERE r.nom = 'Auditeur' AND p.nom IN ('consulter_documents', 'consulter_audit', 'suivre_actions');

-- =============================================
-- 4. Add role_id and statut to profiles
-- =============================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.roles(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS statut TEXT NOT NULL DEFAULT 'actif';

-- Set default role_id to 'Membre' for existing profiles
UPDATE public.profiles SET role_id = (SELECT id FROM public.roles WHERE nom = 'Membre') WHERE role_id IS NULL;

-- =============================================
-- 5. Add user_id to members table
-- =============================================
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- =============================================
-- 6. Security definer function for permission checking
-- =============================================
CREATE OR REPLACE FUNCTION public.user_has_permission(_user_id UUID, _permission_nom TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles pr
    JOIN public.role_permissions rp ON rp.role_id = pr.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE pr.id = _user_id
      AND p.nom = _permission_nom
      AND pr.statut = 'actif'
  )
$$;

-- =============================================
-- 7. Function to get user permissions
-- =============================================
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id UUID)
RETURNS TABLE(permission_nom TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.nom
  FROM public.profiles pr
  JOIN public.role_permissions rp ON rp.role_id = pr.role_id
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE pr.id = _user_id
    AND pr.statut = 'actif'
$$;

-- =============================================
-- 8. Update handle_new_user to assign default role
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_role_id UUID;
BEGIN
  SELECT id INTO default_role_id FROM public.roles WHERE nom = 'Membre' LIMIT 1;
  
  INSERT INTO public.profiles (id, full_name, role_id, statut)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), default_role_id, 'actif');
  
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;
