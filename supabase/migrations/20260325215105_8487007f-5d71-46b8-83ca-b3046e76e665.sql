
-- Drop existing FKs pointing to auth.users
ALTER TABLE public.entity_permissions DROP CONSTRAINT entity_permissions_user_id_fkey;
ALTER TABLE public.entity_permissions DROP CONSTRAINT entity_permissions_granted_by_fkey;

-- Re-create FKs pointing to profiles
ALTER TABLE public.entity_permissions
  ADD CONSTRAINT entity_permissions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.entity_permissions
  ADD CONSTRAINT entity_permissions_granted_by_fkey
  FOREIGN KEY (granted_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
