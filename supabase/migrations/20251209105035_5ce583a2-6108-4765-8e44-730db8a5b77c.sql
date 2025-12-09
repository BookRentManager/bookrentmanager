-- Fix RLS policy for payments to allow NULL expiry dates
DROP POLICY IF EXISTS "Public can view payment by active payment link" ON public.payments;

CREATE POLICY "Public can view payment by active payment link" 
ON public.payments 
FOR SELECT 
USING (
  payment_link_id IS NOT NULL 
  AND payment_link_status IN ('pending', 'active', 'paid')
  AND (payment_link_expires_at IS NULL OR payment_link_expires_at > now())
);