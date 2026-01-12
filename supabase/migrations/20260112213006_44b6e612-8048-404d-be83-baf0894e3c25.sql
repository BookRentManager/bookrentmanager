-- Create helper function for view_scope with SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION public.get_user_view_scope(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(view_scope, 'own') FROM profiles WHERE id = _user_id
$$;

-- Drop existing bookings SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view bookings based on role and scope" ON bookings;

-- Create simplified policy using security definer functions for both role and scope checks
CREATE POLICY "Authenticated users can view bookings based on role and scope"
ON bookings FOR SELECT TO authenticated
USING (
  (has_role(auth.uid(), 'admin') AND (get_user_view_scope(auth.uid()) = 'all' OR created_by = auth.uid()))
  OR (has_role(auth.uid(), 'staff') AND (get_user_view_scope(auth.uid()) = 'all' OR created_by = auth.uid()))
  OR (has_role(auth.uid(), 'accountant') AND get_user_view_scope(auth.uid()) = 'all')
  OR (has_role(auth.uid(), 'read_only') AND get_user_view_scope(auth.uid()) = 'all')
);