
-- Remove all permissions from "Membre de la Direction" except consulter_documents
DELETE FROM public.role_permissions
WHERE role_id = (SELECT id FROM public.roles WHERE nom = 'Membre de la Direction')
  AND permission_id != (SELECT id FROM public.permissions WHERE nom = 'consulter_documents');
