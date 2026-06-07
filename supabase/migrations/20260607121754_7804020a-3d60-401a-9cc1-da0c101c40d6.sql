
-- 1. Relax privilege escalation trigger: allow admins with gerer_utilisateurs to change role_id / statut.
--    Company change still restricted to super admins.
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _is_super boolean := public.is_super_admin();
  _can_manage_users boolean := public.user_has_permission(auth.uid(), 'gerer_utilisateurs');
BEGIN
  -- company_id change: super admin only
  IF NEW.company_id IS DISTINCT FROM OLD.company_id AND NOT _is_super THEN
    RAISE EXCEPTION 'Modification de l''organisation interdite. Contactez un super administrateur.';
  END IF;

  -- role_id / statut change: super admin or manage-users permission
  IF (NEW.role_id IS DISTINCT FROM OLD.role_id OR NEW.statut IS DISTINCT FROM OLD.statut)
     AND NOT _is_super
     AND NOT _can_manage_users THEN
    RAISE EXCEPTION 'Modification du rôle ou du statut interdite. Permission « gerer_utilisateurs » requise.';
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Map role name -> member_quality enum
CREATE OR REPLACE FUNCTION public.role_name_to_member_quality(_role_name text)
RETURNS public.member_quality
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _role_name = 'PCA' THEN 'pca'::public.member_quality
    WHEN _role_name = 'Président du Comité d''Audit' THEN 'president_comite_audit'::public.member_quality
    WHEN _role_name = 'Secrétariat juridique' THEN 'secretariat_juridique'::public.member_quality
    WHEN _role_name = 'administrateur' THEN 'administrateur'::public.member_quality
    WHEN _role_name = 'Membre' THEN 'membre'::public.member_quality
    WHEN _role_name = 'Membre de la Direction' THEN 'membre_direction'::public.member_quality
    WHEN _role_name = 'Autre' THEN 'autre'::public.member_quality
    ELSE NULL
  END
$$;

-- 3. Sync trigger: when a profile's role_id changes, update all linked member rows' quality
CREATE OR REPLACE FUNCTION public.sync_member_quality_from_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _role_name text;
  _new_quality public.member_quality;
BEGIN
  IF NEW.role_id IS NULL OR NEW.role_id IS NOT DISTINCT FROM OLD.role_id THEN
    RETURN NEW;
  END IF;

  SELECT nom INTO _role_name FROM public.roles WHERE id = NEW.role_id;
  IF _role_name IS NULL THEN RETURN NEW; END IF;

  _new_quality := public.role_name_to_member_quality(_role_name);
  IF _new_quality IS NULL THEN RETURN NEW; END IF;

  -- Update all active member rows linked to this user. validate_member_quality_trigger
  -- will enforce single-PCA / single-Président du Comité d'Audit / max-2 Secrétariat juridique rules,
  -- raising a clear exception that rolls back the whole role change if violated.
  UPDATE public.members
  SET quality = _new_quality,
      updated_at = now()
  WHERE user_id = NEW.id
    AND is_active = true
    AND quality IS DISTINCT FROM _new_quality;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_member_quality_from_role_trg ON public.profiles;
CREATE TRIGGER sync_member_quality_from_role_trg
AFTER UPDATE OF role_id ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_member_quality_from_role();
