-- Allow public read access to minimal booking info for payment checkout
-- This enables the PostFinanceCheckout page (public) to display booking details
-- when users are completing their payment via payment link
CREATE POLICY "Public can view minimal booking info for payments"
ON public.bookings FOR SELECT
TO anon, authenticated
USING (
  id IN (
    SELECT booking_id 
    FROM public.payments 
    WHERE payment_link_status = 'pending'::payment_link_status
    AND payment_link_expires_at > NOW()
  )
);