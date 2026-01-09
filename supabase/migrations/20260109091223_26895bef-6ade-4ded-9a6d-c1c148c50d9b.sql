-- Fix fines RLS policies to respect view_scope for staff users
-- Staff with view_scope='own' should only see fines linked to their own bookings

-- Drop the overly permissive policy that bypasses view_scope
DROP POLICY IF EXISTS "Staff can manage fines" ON fines;

-- Drop the existing SELECT policy and recreate with proper booking ownership check
DROP POLICY IF EXISTS "Admin and staff can view fines" ON fines;

CREATE POLICY "Admin and staff can view fines"
ON fines
FOR SELECT
TO public
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
  AND (
    -- Admin or staff with view_scope='all' can see all fines
    (SELECT view_scope FROM profiles WHERE id = auth.uid()) = 'all'
    OR 
    -- Staff with view_scope='own' can only see fines linked to bookings they created
    booking_id IN (SELECT id FROM bookings WHERE created_by = auth.uid())
    OR
    -- Allow unlinked fines created by the user
    (booking_id IS NULL AND created_by = auth.uid())
  )
  AND deleted_at IS NULL
);

-- Create INSERT policy for staff (all staff can create fines)
CREATE POLICY "Staff can insert fines"
ON fines
FOR INSERT
TO public
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)
);

-- Create UPDATE policy for staff (with view_scope restriction)
CREATE POLICY "Staff can update fines"
ON fines
FOR UPDATE
TO public
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
  AND (
    (SELECT view_scope FROM profiles WHERE id = auth.uid()) = 'all'
    OR booking_id IN (SELECT id FROM bookings WHERE created_by = auth.uid())
    OR (booking_id IS NULL AND created_by = auth.uid())
  )
);

-- Create DELETE policy for staff (with view_scope restriction)
CREATE POLICY "Staff can delete fines"
ON fines
FOR DELETE
TO public
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
  AND (
    (SELECT view_scope FROM profiles WHERE id = auth.uid()) = 'all'
    OR booking_id IN (SELECT id FROM bookings WHERE created_by = auth.uid())
    OR (booking_id IS NULL AND created_by = auth.uid())
  )
);