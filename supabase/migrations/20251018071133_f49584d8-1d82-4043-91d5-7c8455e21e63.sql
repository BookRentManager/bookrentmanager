-- Allow public (anonymous) read access to payment details when accessing via payment link
-- This enables the PostFinanceCheckout page to display payment info to users who click payment links
CREATE POLICY "Public can view payment by active payment link"
ON public.payments FOR SELECT
TO anon, authenticated
USING (
  payment_link_id IS NOT NULL
  AND payment_link_status IN ('pending', 'active')
  AND payment_link_expires_at > NOW()
);