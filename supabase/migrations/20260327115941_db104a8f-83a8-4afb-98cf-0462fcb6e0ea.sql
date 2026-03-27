
-- 1. Create admin_audit_log table for Super Admin actions
CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  user_id uuid,
  target_company_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- 3. Only super admins can read
CREATE POLICY "Super admins can read admin_audit_log"
  ON public.admin_audit_log FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- 4. Only super admins can insert
CREATE POLICY "Super admins can insert admin_audit_log"
  ON public.admin_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

-- 5. Service role can insert (for triggers)
CREATE POLICY "Service role can insert admin_audit_log"
  ON public.admin_audit_log FOR INSERT TO service_role
  WITH CHECK (true);

-- 6. Modify audit_trigger_func to route based on super_admin status
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _company_id uuid;
  _details jsonb;
  _entity_id uuid;
  _action text;
  _is_super_admin boolean;
BEGIN
  _user_id := auth.uid();
  _action := TG_OP;

  -- Check if the current user is a super admin
  _is_super_admin := false;
  IF _user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin'
    ) INTO _is_super_admin;
  END IF;

  -- Get entity_id and details based on operation
  IF TG_OP = 'DELETE' THEN
    _entity_id := OLD.id;
    _details := to_jsonb(OLD);
    IF to_jsonb(OLD) ? 'company_id' THEN
      _company_id := (to_jsonb(OLD)->>'company_id')::uuid;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    _entity_id := NEW.id;
    _details := to_jsonb(NEW);
    IF to_jsonb(NEW) ? 'company_id' THEN
      _company_id := (to_jsonb(NEW)->>'company_id')::uuid;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    _entity_id := NEW.id;
    _details := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
    IF to_jsonb(NEW) ? 'company_id' THEN
      _company_id := (to_jsonb(NEW)->>'company_id')::uuid;
    END IF;
  END IF;

  -- Fallback company_id from user profile
  IF _company_id IS NULL AND _user_id IS NOT NULL AND NOT _is_super_admin THEN
    SELECT company_id INTO _company_id FROM public.profiles WHERE id = _user_id;
  END IF;

  -- Remove sensitive fields
  _details := _details - 'password' - 'password_hash';

  -- Route to admin_audit_log for super admins, audit_log for regular users
  IF _is_super_admin THEN
    INSERT INTO public.admin_audit_log (action, entity_type, entity_id, user_id, target_company_id, details)
    VALUES (_action, TG_TABLE_NAME, _entity_id, _user_id, _company_id, _details);
  ELSE
    INSERT INTO public.audit_log (action, entity_type, entity_id, user_id, company_id, details)
    VALUES (_action, TG_TABLE_NAME, _entity_id, _user_id, _company_id, _details);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;
