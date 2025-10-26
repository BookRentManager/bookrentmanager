-- Add PDF URL column to terms_and_conditions table
ALTER TABLE terms_and_conditions 
ADD COLUMN pdf_url text;

-- Create storage bucket for T&C PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'terms-and-conditions',
  'terms-and-conditions',
  true,
  10485760, -- 10MB
  ARRAY['application/pdf']
);

-- RLS Policies for storage bucket
CREATE POLICY "Public can view T&C PDFs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'terms-and-conditions');

CREATE POLICY "Admins can upload T&C PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'terms-and-conditions' 
  AND has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can update T&C PDFs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'terms-and-conditions' 
  AND has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can delete T&C PDFs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'terms-and-conditions' 
  AND has_role(auth.uid(), 'admin')
);