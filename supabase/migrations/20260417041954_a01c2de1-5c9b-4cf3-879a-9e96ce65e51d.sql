-- Limite stricte : conserver uniquement les 15 dernières notifications par utilisateur
CREATE OR REPLACE FUNCTION public.enforce_notification_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Après insertion, supprime tout ce qui dépasse les 15 plus récentes
  DELETE FROM public.notifications
  WHERE user_id = NEW.user_id
    AND id NOT IN (
      SELECT id FROM public.notifications
      WHERE user_id = NEW.user_id
      ORDER BY created_at DESC
      LIMIT 15
    );
  RETURN NEW;
END;
$function$;

-- S'assurer que le trigger est en AFTER INSERT (sinon NEW ne serait pas encore comptée)
DROP TRIGGER IF EXISTS trg_enforce_notification_quota ON public.notifications;
CREATE TRIGGER trg_enforce_notification_quota
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.enforce_notification_quota();

-- Nettoyage immédiat : ramener tous les utilisateurs existants à max 15 notifications
DELETE FROM public.notifications n
WHERE n.id NOT IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) AS rn
    FROM public.notifications
  ) t
  WHERE t.rn <= 15
);