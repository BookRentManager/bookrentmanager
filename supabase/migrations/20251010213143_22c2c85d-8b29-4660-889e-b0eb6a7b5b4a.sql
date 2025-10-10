-- Fix Critical Security Issues

-- 1. Update bookings RLS policy to be role-based instead of allowing all authenticated users
DROP POLICY IF EXISTS "Authenticated users can view bookings" ON public.bookings;

CREATE POLICY "Admin and staff can view bookings"
ON public.bookings FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'staff'::app_role)
);

-- 2. Add file size limits to storage buckets (10MB)
UPDATE storage.buckets 
SET file_size_limit = 10485760
WHERE id IN ('fines', 'invoices');