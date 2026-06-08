CREATE OR REPLACE FUNCTION public.role_name_to_member_quality(_role_name text)
 RETURNS member_quality
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
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
$function$;