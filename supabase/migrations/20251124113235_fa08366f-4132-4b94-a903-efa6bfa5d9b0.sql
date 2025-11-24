-- Drop the restrictive policy that excludes read_only users
DROP POLICY IF EXISTS "Admin and staff can view bookings" ON public.bookings;

-- Create new inclusive policy that allows read_only users with view_scope 'all'
CREATE POLICY "Authenticated users can view bookings based on role and scope"
ON public.bookings
FOR SELECT
TO authenticated
USING (
  -- Admin and staff can see based on view_scope
  (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
    AND (
      (SELECT view_scope FROM profiles WHERE id = auth.uid()) = 'all'
      OR created_by = auth.uid()
    )
  )
  OR
  -- Read-only users can ONLY see if they have view_scope 'all'
  (
    has_role(auth.uid(), 'read_only'::app_role)
    AND (SELECT view_scope FROM profiles WHERE id = auth.uid()) = 'all'
  )
);