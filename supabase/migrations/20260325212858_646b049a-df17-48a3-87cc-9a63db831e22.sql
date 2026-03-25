
-- Table for granular entity-level permissions (ACL overrides)
CREATE TABLE public.entity_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('document', 'minute', 'session', 'decision', 'meeting')),
  entity_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  can_view boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  can_comment boolean NOT NULL DEFAULT false,
  granted_by uuid REFERENCES auth.users(id),
  company_id uuid REFERENCES public.companies(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, user_id)
);

-- Enable RLS
ALTER TABLE public.entity_permissions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Company users can read entity_permissions"
  ON public.entity_permissions FOR SELECT TO authenticated
  USING (company_id = my_company_id());

CREATE POLICY "Admins can manage entity_permissions"
  ON public.entity_permissions FOR ALL TO authenticated
  USING (company_id = my_company_id() AND (
    has_role(auth.uid(), 'admin') OR user_has_permission(auth.uid(), 'gerer_utilisateurs')
  ))
  WITH CHECK (company_id = my_company_id() AND (
    has_role(auth.uid(), 'admin') OR user_has_permission(auth.uid(), 'gerer_utilisateurs')
  ));

-- Grantor (document owner) can manage permissions on their entities
CREATE POLICY "Grantors can manage own entity_permissions"
  ON public.entity_permissions FOR ALL TO authenticated
  USING (granted_by = auth.uid() AND company_id = my_company_id())
  WITH CHECK (granted_by = auth.uid() AND company_id = my_company_id());

-- Updated_at trigger
CREATE TRIGGER update_entity_permissions_updated_at
  BEFORE UPDATE ON public.entity_permissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Security definer function: check entity permission with role fallback
CREATE OR REPLACE FUNCTION public.check_entity_permission(
  _user_id uuid,
  _entity_type text,
  _entity_id uuid,
  _action text -- 'view', 'edit', 'delete', 'comment'
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _has_entity_perm boolean;
  _role_perm text;
BEGIN
  -- 1. Check entity-level permission first (explicit ACL)
  SELECT
    CASE _action
      WHEN 'view' THEN ep.can_view
      WHEN 'edit' THEN ep.can_edit
      WHEN 'delete' THEN ep.can_delete
      WHEN 'comment' THEN ep.can_comment
      ELSE false
    END
  INTO _has_entity_perm
  FROM public.entity_permissions ep
  WHERE ep.entity_type = _entity_type
    AND ep.entity_id = _entity_id
    AND ep.user_id = _user_id;

  -- If explicit entity permission exists, use it
  IF _has_entity_perm IS NOT NULL THEN
    RETURN _has_entity_perm;
  END IF;

  -- 2. Fallback to role-based permissions
  _role_perm := CASE
    WHEN _entity_type IN ('document') AND _action = 'view' THEN 'consulter_documents'
    WHEN _entity_type IN ('document') AND _action IN ('edit', 'delete') THEN 'gerer_documents'
    WHEN _entity_type IN ('document') AND _action = 'comment' THEN 'consulter_documents'
    WHEN _entity_type IN ('minute') AND _action = 'view' THEN 'consulter_documents'
    WHEN _entity_type IN ('minute') AND _action IN ('edit', 'delete') THEN 'valider_pv'
    WHEN _entity_type IN ('minute') AND _action = 'comment' THEN 'consulter_documents'
    WHEN _entity_type IN ('session', 'meeting') AND _action = 'view' THEN 'consulter_documents'
    WHEN _entity_type IN ('session', 'meeting') AND _action IN ('edit', 'delete') THEN 'modifier_session'
    WHEN _entity_type IN ('session', 'meeting') AND _action = 'comment' THEN 'consulter_documents'
    WHEN _entity_type = 'decision' AND _action = 'view' THEN 'consulter_documents'
    WHEN _entity_type = 'decision' AND _action IN ('edit', 'delete') THEN 'creer_decisions'
    WHEN _entity_type = 'decision' AND _action = 'comment' THEN 'consulter_documents'
    ELSE NULL
  END;

  IF _role_perm IS NULL THEN
    RETURN false;
  END IF;

  RETURN user_has_permission(_user_id, _role_perm);
END;
$$;
