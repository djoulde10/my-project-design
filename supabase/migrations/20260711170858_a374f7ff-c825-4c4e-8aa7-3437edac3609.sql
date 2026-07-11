
-- 1. Extend app_role enum with SA sub-roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin_readonly';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_support';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_billing';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_security';
