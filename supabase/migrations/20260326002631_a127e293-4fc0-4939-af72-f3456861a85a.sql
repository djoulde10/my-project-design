
CREATE TABLE public.api_request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  api_key_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  method text NOT NULL,
  endpoint text NOT NULL,
  resource text,
  resource_id text,
  status_code integer NOT NULL DEFAULT 200,
  response_time_ms integer,
  error_message text,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_request_logs_company ON public.api_request_logs(company_id);
CREATE INDEX idx_api_request_logs_created ON public.api_request_logs(created_at DESC);
CREATE INDEX idx_api_request_logs_key ON public.api_request_logs(api_key_id);
CREATE INDEX idx_api_request_logs_endpoint ON public.api_request_logs(endpoint);

ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can read all api_request_logs"
ON public.api_request_logs FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can insert api_request_logs"
ON public.api_request_logs FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Service role can insert api_request_logs"
ON public.api_request_logs FOR INSERT TO service_role
WITH CHECK (true);

CREATE POLICY "Company admins can read own api_request_logs"
ON public.api_request_logs FOR SELECT TO authenticated
USING (company_id = my_company_id());
