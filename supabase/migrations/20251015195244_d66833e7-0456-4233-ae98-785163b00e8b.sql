-- Update the RLS policy to allow viewing bookings imported from email
DROP POLICY IF EXISTS "Admin and staff can view bookings" ON public.bookings;

CREATE POLICY "Admin and staff can view bookings"
ON public.bookings
FOR SELECT
TO public
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
  AND (
    (SELECT view_scope FROM profiles WHERE id = auth.uid()) = 'all'
    OR created_by = auth.uid()
    OR (created_by IS NULL AND imported_from_email = true)
  )
);