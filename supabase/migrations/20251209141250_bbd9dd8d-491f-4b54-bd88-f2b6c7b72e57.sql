-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Public can view minimal booking info for payments" ON public.bookings;

-- Create updated policy that includes 'paid' status so confirmation page works
CREATE POLICY "Public can view minimal booking info for payments"
ON public.bookings
FOR SELECT
USING (id IN (
  SELECT payments.booking_id
  FROM payments
  WHERE (
    payments.payment_link_status = ANY (ARRAY['pending'::payment_link_status, 'active'::payment_link_status, 'paid'::payment_link_status])
  ) AND (
    payments.payment_link_expires_at IS NULL OR payments.payment_link_expires_at > (now() - interval '24 hours')
  )
));