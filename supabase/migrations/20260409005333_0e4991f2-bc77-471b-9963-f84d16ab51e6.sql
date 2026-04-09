
CREATE OR REPLACE FUNCTION public.validate_member_quality()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  max_allowed integer;
  current_count integer;
  quality_label text;
BEGIN
  IF NEW.quality NOT IN ('pca', 'president_comite_audit', 'secretariat_juridique') THEN
    RETURN NEW;
  END IF;

  IF NEW.is_active = false THEN
    RETURN NEW;
  END IF;

  IF NEW.quality IN ('pca', 'president_comite_audit') THEN
    max_allowed := 1;
  ELSIF NEW.quality = 'secretariat_juridique' THEN
    max_allowed := 2;
  END IF;

  CASE NEW.quality
    WHEN 'pca' THEN quality_label := 'Président du Conseil d''Administration (PCA)';
    WHEN 'president_comite_audit' THEN quality_label := 'Président du Comité d''Audit';
    WHEN 'secretariat_juridique' THEN quality_label := 'Secrétariat juridique';
  END CASE;

  SELECT COUNT(*) INTO current_count
  FROM public.members m
  WHERE m.organ_id = NEW.organ_id
    AND m.quality = NEW.quality
    AND m.is_active = true
    AND m.id IS DISTINCT FROM NEW.id
    AND (m.mandate_end IS NULL OR m.mandate_end >= COALESCE(NEW.mandate_start, CURRENT_DATE))
    AND (NEW.mandate_end IS NULL OR NEW.mandate_end >= COALESCE(m.mandate_start, CURRENT_DATE));

  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Limite atteinte : il ne peut y avoir que % %(s) actif(s) par organe pendant une même période de mandat. La fonction "%" est déjà occupée.', max_allowed, quality_label, quality_label;
  END IF;

  RETURN NEW;
END;
$function$;
