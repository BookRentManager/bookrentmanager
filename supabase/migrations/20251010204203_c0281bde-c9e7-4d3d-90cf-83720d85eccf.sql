-- Create storage bucket for fine documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('fines', 'fines', false)
ON CONFLICT (id) DO NOTHING;

-- Add document_url column to fines table
ALTER TABLE public.fines 
ADD COLUMN IF NOT EXISTS document_url TEXT;

-- Storage policies for fines bucket
CREATE POLICY "Users can view their own fine documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'fines' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload their own fine documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'fines' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own fine documents"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'fines' AND
  auth.uid()::text = (storage.foldername(name))[1]
);