-- Add logo_url to app_settings
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS logo_url text;

-- Create storage bucket for company logos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow admins to upload logos
CREATE POLICY "Admins can upload logos"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'company-logos' AND 
    has_role(auth.uid(), 'admin')
  );

-- Allow admins to update logos
CREATE POLICY "Admins can update logos"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'company-logos' AND 
    has_role(auth.uid(), 'admin')
  );

-- Allow admins to delete logos
CREATE POLICY "Admins can delete logos"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'company-logos' AND 
    has_role(auth.uid(), 'admin')
  );

-- Allow everyone to view logos (public bucket)
CREATE POLICY "Anyone can view logos"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'company-logos');