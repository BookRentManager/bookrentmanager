-- Create enum for document types
CREATE TYPE document_type AS ENUM (
  'id_card',
  'drivers_license', 
  'passport',
  'other'
);

-- Create documents table
CREATE TABLE public.booking_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  document_type document_type NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Create index for better query performance
CREATE INDEX idx_booking_documents_booking_id ON public.booking_documents(booking_id);
CREATE INDEX idx_booking_documents_deleted_at ON public.booking_documents(deleted_at) WHERE deleted_at IS NULL;

-- Enable RLS
ALTER TABLE public.booking_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Staff can view documents"
  ON public.booking_documents FOR SELECT
  TO authenticated
  USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
    AND deleted_at IS NULL
  );

CREATE POLICY "Staff can upload documents"
  ON public.booking_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)
  );

CREATE POLICY "Staff can delete documents"
  ON public.booking_documents FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)
  );

-- Create storage bucket for client documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-documents', 'client-documents', false);

-- Storage RLS policies
CREATE POLICY "Staff can view client documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'client-documents' 
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
  );

CREATE POLICY "Staff can upload client documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'client-documents'
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
  );

CREATE POLICY "Staff can delete client documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
  );