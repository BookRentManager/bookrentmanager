-- Fix RLS policy for bookings to exclude imported bookings for "own" scope
DROP POLICY IF EXISTS "Admin and staff can view bookings" ON bookings;

CREATE POLICY "Admin and staff can view bookings"
ON bookings
FOR SELECT
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
  AND (
    (
      SELECT view_scope FROM profiles WHERE id = auth.uid()
    ) = 'all'
    OR created_by = auth.uid()
  )
);

-- Add INSERT restriction for read_only role
CREATE POLICY "Read-only users cannot insert bookings"
ON bookings
FOR INSERT
WITH CHECK (NOT has_role(auth.uid(), 'read_only'::app_role));

-- Add UPDATE restriction for read_only role on bookings
DROP POLICY IF EXISTS "Staff can update bookings" ON bookings;

CREATE POLICY "Staff and admin can update bookings"
ON bookings
FOR UPDATE
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
  AND NOT has_role(auth.uid(), 'read_only'::app_role)
);

-- Add restrictions for supplier_invoices
CREATE POLICY "Read-only users cannot insert invoices"
ON supplier_invoices
FOR INSERT
WITH CHECK (NOT has_role(auth.uid(), 'read_only'::app_role));

CREATE POLICY "Read-only users cannot update invoices"
ON supplier_invoices
FOR UPDATE
USING (NOT has_role(auth.uid(), 'read_only'::app_role));

CREATE POLICY "Read-only users cannot delete invoices"
ON supplier_invoices
FOR DELETE
USING (NOT has_role(auth.uid(), 'read_only'::app_role));

-- Add restrictions for fines
CREATE POLICY "Read-only users cannot insert fines"
ON fines
FOR INSERT
WITH CHECK (NOT has_role(auth.uid(), 'read_only'::app_role));

CREATE POLICY "Read-only users cannot update fines"
ON fines
FOR UPDATE
USING (NOT has_role(auth.uid(), 'read_only'::app_role));

CREATE POLICY "Read-only users cannot delete fines"
ON fines
FOR DELETE
USING (NOT has_role(auth.uid(), 'read_only'::app_role));

-- Add restrictions for client_invoices
CREATE POLICY "Read-only users cannot insert client invoices"
ON client_invoices
FOR INSERT
WITH CHECK (NOT has_role(auth.uid(), 'read_only'::app_role));

CREATE POLICY "Read-only users cannot update client invoices"
ON client_invoices
FOR UPDATE
USING (NOT has_role(auth.uid(), 'read_only'::app_role));

CREATE POLICY "Read-only users cannot delete client invoices"
ON client_invoices
FOR DELETE
USING (NOT has_role(auth.uid(), 'read_only'::app_role));