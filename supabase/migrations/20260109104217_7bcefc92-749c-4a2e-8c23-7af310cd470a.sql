-- Fix: Remove the public token enumeration vulnerability
-- Edge functions (get-booking-by-token, get-client-portal-data, etc.) use service role
-- credentials which bypass RLS, so they don't need this policy

-- Drop the vulnerable policy that allows public enumeration of all tokens
DROP POLICY IF EXISTS "Public can access by valid token" ON booking_access_tokens;

-- The existing "Staff can manage booking tokens" policy remains for admin/staff access
-- All client-facing token validation happens in edge functions with service role credentials