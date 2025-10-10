-- Create storage buckets for fines and invoices
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('fines', 'fines', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp']),
  ('invoices', 'invoices', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp']);

-- Create RLS policies for fines bucket
CREATE POLICY "Authenticated users can view fine documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'fines');

CREATE POLICY "Staff can upload fine documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'fines' AND
  (SELECT has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);

CREATE POLICY "Staff can update fine documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'fines' AND
  (SELECT has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);

CREATE POLICY "Staff can delete fine documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'fines' AND
  (SELECT has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);

-- Create RLS policies for invoices bucket
CREATE POLICY "Authenticated users can view invoice documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'invoices');

CREATE POLICY "Staff can upload invoice documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'invoices' AND
  (SELECT has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);

CREATE POLICY "Staff can update invoice documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'invoices' AND
  (SELECT has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);

CREATE POLICY "Staff can delete invoice documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'invoices' AND
  (SELECT has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);