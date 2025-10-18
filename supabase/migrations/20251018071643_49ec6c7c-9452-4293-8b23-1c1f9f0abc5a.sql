-- Fix RLS policy to match actual payment_link_status values created by edge function
DROP POLICY IF EXISTS "Public can view minimal booking info for payments" ON public.bookings;

CREATE POLICY "Public can view minimal booking info for payments"
ON public.bookings FOR SELECT
TO anon, authenticated
USING (
  id IN (
    SELECT booking_id 
    FROM public.payments 
    WHERE payment_link_status IN ('pending', 'active')
    AND payment_link_expires_at > NOW()
  )
);