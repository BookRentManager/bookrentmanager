-- Add document tracking columns to booking_documents
ALTER TABLE booking_documents
ADD COLUMN uploaded_by_type TEXT NOT NULL DEFAULT 'admin',
ADD COLUMN uploaded_by_client_name TEXT,
ADD CONSTRAINT check_uploaded_by_type CHECK (uploaded_by_type IN ('admin', 'client'));

-- Add documents requirement columns to bookings
ALTER TABLE bookings
ADD COLUMN documents_required BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN documents_required_note TEXT;

-- Update RLS policies for booking_documents to allow public view via valid token
DROP POLICY IF EXISTS "Staff can view documents" ON booking_documents;

CREATE POLICY "Staff can view documents"
ON booking_documents
FOR SELECT
USING (
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff')) 
  AND deleted_at IS NULL
);

CREATE POLICY "Public can view documents via valid token"
ON booking_documents
FOR SELECT
USING (
  deleted_at IS NULL
  AND booking_id IN (
    SELECT booking_id 
    FROM booking_access_tokens 
    WHERE expires_at > now()
  )
);

-- Allow public to insert documents via valid token
CREATE POLICY "Public can upload documents via valid token"
ON booking_documents
FOR INSERT
WITH CHECK (
  booking_id IN (
    SELECT booking_id 
    FROM booking_access_tokens 
    WHERE expires_at > now()
  )
);

-- Allow clients to delete only their own documents
CREATE POLICY "Clients can delete own documents via valid token"
ON booking_documents
FOR DELETE
USING (
  uploaded_by_type = 'client'
  AND booking_id IN (
    SELECT booking_id 
    FROM booking_access_tokens 
    WHERE expires_at > now()
  )
);