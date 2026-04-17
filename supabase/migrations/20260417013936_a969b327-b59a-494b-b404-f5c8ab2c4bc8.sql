
-- Table de suivi des convocations envoyées et lues
CREATE TABLE public.convocation_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  company_id uuid NOT NULL,
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  sent_at timestamptz,
  viewed_at timestamptz,
  email_status text NOT NULL DEFAULT 'pending', -- pending|sent|failed
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id)
);

CREATE INDEX idx_convocation_views_session ON public.convocation_views(session_id);
CREATE INDEX idx_convocation_views_user ON public.convocation_views(user_id);
CREATE INDEX idx_convocation_views_token ON public.convocation_views(token);
CREATE INDEX idx_convocation_views_status ON public.convocation_views(email_status, sent_at);

ALTER TABLE public.convocation_views ENABLE ROW LEVEL SECURITY;

-- Read: l'utilisateur concerné voit son propre enregistrement, et les rôles de gestion voient tout pour leur company
CREATE POLICY "Users can read own convocation views"
ON public.convocation_views FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Managers can read company convocation views"
ON public.convocation_views FOR SELECT TO authenticated
USING (
  company_id = my_company_id()
  AND (
    user_has_permission(auth.uid(), 'creer_session')
    OR user_has_permission(auth.uid(), 'modifier_session')
    OR user_has_permission(auth.uid(), 'gerer_utilisateurs')
    OR has_role(auth.uid(), 'admin')
  )
);

CREATE POLICY "Super admins can read all convocation views"
ON public.convocation_views FOR SELECT TO authenticated
USING (is_super_admin());

-- Insert/Update: service role uniquement (via edge functions)
CREATE POLICY "Service role can manage convocation views"
ON public.convocation_views FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Trigger updated_at
CREATE TRIGGER trg_convocation_views_updated_at
BEFORE UPDATE ON public.convocation_views
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Audit
CREATE TRIGGER trg_convocation_views_audit
AFTER INSERT OR UPDATE OR DELETE ON public.convocation_views
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- Fonction RPC pour marquer une convocation comme vue par token
CREATE OR REPLACE FUNCTION public.mark_convocation_viewed(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.convocation_views;
  _session record;
BEGIN
  SELECT * INTO _row FROM public.convocation_views WHERE token = _token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Token invalide');
  END IF;

  -- Vérification stricte : seul l'utilisateur propriétaire du token peut marquer
  IF auth.uid() IS NULL OR auth.uid() <> _row.user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès refusé');
  END IF;

  IF _row.viewed_at IS NULL THEN
    UPDATE public.convocation_views
    SET viewed_at = now(), updated_at = now()
    WHERE id = _row.id;
  END IF;

  SELECT id, title, session_date, location, meeting_link, convocation_letter, organ_id
  INTO _session FROM public.sessions WHERE id = _row.session_id;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', _row.session_id,
    'session', to_jsonb(_session),
    'already_viewed', _row.viewed_at IS NOT NULL
  );
END;
$$;

-- Fonction pour enfiler les convocations à envoyer pour une session publiée
CREATE OR REPLACE FUNCTION public.queue_session_convocations(_session_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
  _count integer := 0;
  _att record;
BEGIN
  SELECT company_id INTO _company_id FROM public.sessions WHERE id = _session_id;
  IF _company_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Permission: secrétariat / création-modification de session
  IF NOT (
    user_has_permission(auth.uid(), 'creer_session')
    OR user_has_permission(auth.uid(), 'modifier_session')
    OR has_role(auth.uid(), 'admin')
  ) THEN
    RAISE EXCEPTION 'Permission insuffisante';
  END IF;

  FOR _att IN
    SELECT DISTINCT m.user_id, m.id AS member_id, COALESCE(m.email, p_email.email) AS email
    FROM public.session_attendees sa
    JOIN public.members m ON m.id = sa.member_id
    LEFT JOIN auth.users p_email ON p_email.id = m.user_id
    WHERE sa.session_id = _session_id
      AND m.user_id IS NOT NULL
      AND COALESCE(m.email, p_email.email) IS NOT NULL
  LOOP
    INSERT INTO public.convocation_views (session_id, user_id, member_id, company_id, email, token, email_status)
    VALUES (
      _session_id, _att.user_id, _att.member_id, _company_id, _att.email,
      encode(gen_random_bytes(24), 'hex'), 'pending'
    )
    ON CONFLICT (session_id, user_id) DO UPDATE
      SET email_status = CASE WHEN convocation_views.email_status = 'failed' THEN 'pending' ELSE convocation_views.email_status END,
          updated_at = now();
    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$$;

-- Trigger automatique : quand une session passe à is_published = true, enfiler les convocations
CREATE OR REPLACE FUNCTION public.auto_queue_convocations_on_publish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
  _att record;
BEGIN
  IF NEW.is_published = true AND (OLD.is_published IS DISTINCT FROM true) THEN
    _company_id := NEW.company_id;
    FOR _att IN
      SELECT DISTINCT m.user_id, m.id AS member_id, COALESCE(m.email, u.email) AS email
      FROM public.session_attendees sa
      JOIN public.members m ON m.id = sa.member_id
      LEFT JOIN auth.users u ON u.id = m.user_id
      WHERE sa.session_id = NEW.id
        AND m.user_id IS NOT NULL
        AND COALESCE(m.email, u.email) IS NOT NULL
    LOOP
      INSERT INTO public.convocation_views (session_id, user_id, member_id, company_id, email, token, email_status)
      VALUES (NEW.id, _att.user_id, _att.member_id, _company_id, _att.email,
              encode(gen_random_bytes(24), 'hex'), 'pending')
      ON CONFLICT (session_id, user_id) DO NOTHING;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_queue_convocations
AFTER UPDATE OF is_published ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.auto_queue_convocations_on_publish();
