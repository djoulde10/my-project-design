
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS platform_name text DEFAULT NULL;

-- Create company-logos bucket for logo uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their company folder
CREATE POLICY "Company users can upload logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'company-logos' AND (storage.foldername(name))[1] = my_company_id()::text);

-- Allow anyone to read logos (public bucket)
CREATE POLICY "Public can read company logos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'company-logos');

-- Allow company users to update/delete their logos
CREATE POLICY "Company users can manage own logos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'company-logos' AND (storage.foldername(name))[1] = my_company_id()::text);

CREATE POLICY "Company users can update own logos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'company-logos' AND (storage.foldername(name))[1] = my_company_id()::text);
