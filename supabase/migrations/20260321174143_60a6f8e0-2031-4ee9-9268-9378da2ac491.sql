-- Fix permissive login_logs INSERT policy - restrict to own user_id
DROP POLICY "Anyone can insert login_logs" ON public.login_logs;
CREATE POLICY "Users can insert own login_logs"
  ON public.login_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);