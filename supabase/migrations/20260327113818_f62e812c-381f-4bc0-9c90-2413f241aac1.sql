
-- ============================================
-- 1. AUDIT TRIGGERS MANQUANTS
-- ============================================

-- api_keys
CREATE TRIGGER audit_api_keys
  AFTER INSERT OR UPDATE OR DELETE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- comments
CREATE TRIGGER audit_comments
  AFTER INSERT OR UPDATE OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- companies
CREATE TRIGGER audit_companies
  AFTER INSERT OR UPDATE OR DELETE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- conflict_of_interests
CREATE TRIGGER audit_conflict_of_interests
  AFTER INSERT OR UPDATE OR DELETE ON public.conflict_of_interests
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- entity_permissions
CREATE TRIGGER audit_entity_permissions
  AFTER INSERT OR UPDATE OR DELETE ON public.entity_permissions
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- feature_flags
CREATE TRIGGER audit_feature_flags
  AFTER INSERT OR UPDATE OR DELETE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- role_permissions
CREATE TRIGGER audit_role_permissions
  AFTER INSERT OR UPDATE OR DELETE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- roles
CREATE TRIGGER audit_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- support_tickets
CREATE TRIGGER audit_support_tickets
  AFTER INSERT OR UPDATE OR DELETE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- ============================================
-- 2. PERMISSIONS MANQUANTES
-- ============================================

INSERT INTO public.permissions (nom, description) VALUES
  ('gerer_conflits', 'Gérer les conflits d''intérêts (déclaration, résolution)')
ON CONFLICT DO NOTHING;

INSERT INTO public.permissions (nom, description) VALUES
  ('gerer_approbations', 'Valider ou rejeter les demandes d''approbation')
ON CONFLICT DO NOTHING;

INSERT INTO public.permissions (nom, description) VALUES
  ('gerer_api', 'Gérer les clés API et accès à la documentation API')
ON CONFLICT DO NOTHING;

INSERT INTO public.permissions (nom, description) VALUES
  ('gerer_support', 'Créer et gérer les tickets de support')
ON CONFLICT DO NOTHING;

INSERT INTO public.permissions (nom, description) VALUES
  ('consulter_analytics', 'Consulter les statistiques et analytics')
ON CONFLICT DO NOTHING;
