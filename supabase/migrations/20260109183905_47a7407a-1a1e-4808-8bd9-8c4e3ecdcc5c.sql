-- Fix agency_invoices RLS policies - require staff/admin role for all operations

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Authenticated users can insert agency invoices" ON agency_invoices;
DROP POLICY IF EXISTS "Authenticated users can update agency invoices" ON agency_invoices;
DROP POLICY IF EXISTS "Authenticated users can view agency invoices" ON agency_invoices;

-- Create properly restricted SELECT policy (defense in depth)
CREATE POLICY "Staff can view agency invoices"
ON agency_invoices
FOR SELECT
TO authenticated
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
  AND deleted_at IS NULL
);

-- Create properly restricted INSERT policy
CREATE POLICY "Staff can insert agency invoices"
ON agency_invoices
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)
);

-- Create properly restricted UPDATE policy
CREATE POLICY "Staff can update agency invoices"
ON agency_invoices
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)
);