
-- Subscription plans table
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  price_monthly numeric(10,2) NOT NULL DEFAULT 0,
  price_yearly numeric(10,2) NOT NULL DEFAULT 0,
  max_users integer NOT NULL DEFAULT 5,
  max_sessions integer NOT NULL DEFAULT 10,
  max_storage_mb integer NOT NULL DEFAULT 500,
  max_documents integer NOT NULL DEFAULT 100,
  features jsonb DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active plans" ON public.subscription_plans
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admins can manage plans" ON public.subscription_plans
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Add subscription fields to companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.subscription_plans(id),
  ADD COLUMN IF NOT EXISTS billing_cycle text DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS subscription_start timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_end timestamptz,
  ADD COLUMN IF NOT EXISTS auto_renew boolean DEFAULT true;

-- Invoices table
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.subscription_plans(id),
  invoice_number text NOT NULL,
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'pending',
  billing_period_start date,
  billing_period_end date,
  paid_at timestamptz,
  due_date date,
  pdf_url text,
  stripe_invoice_id text,
  stripe_payment_intent_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can read own invoices" ON public.invoices
  FOR SELECT TO authenticated USING (company_id = my_company_id());

CREATE POLICY "Super admins can manage invoices" ON public.invoices
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Organization usage tracking
CREATE TABLE public.organization_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE UNIQUE,
  current_users integer NOT NULL DEFAULT 0,
  current_sessions integer NOT NULL DEFAULT 0,
  current_documents integer NOT NULL DEFAULT 0,
  current_storage_mb numeric(10,2) NOT NULL DEFAULT 0,
  last_calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organization_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can read own usage" ON public.organization_usage
  FOR SELECT TO authenticated USING (company_id = my_company_id());

CREATE POLICY "Super admins can manage usage" ON public.organization_usage
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- System logs table for super admin
CREATE TABLE public.system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL DEFAULT 'info',
  category text NOT NULL DEFAULT 'system',
  message text NOT NULL,
  details jsonb,
  company_id uuid REFERENCES public.companies(id),
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can read system logs" ON public.system_logs
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can insert system logs" ON public.system_logs
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
$$;
