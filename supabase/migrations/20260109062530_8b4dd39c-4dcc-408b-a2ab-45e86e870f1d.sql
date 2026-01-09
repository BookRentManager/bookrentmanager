-- Drop the existing policy that applies to everyone
DROP POLICY IF EXISTS "Public can view minimal booking info for payments" ON bookings;

-- Recreate it to ONLY apply to anonymous/unauthenticated users
CREATE POLICY "Anonymous can view minimal booking info for payments"
ON bookings
FOR SELECT
TO anon
USING (
  id IN (
    SELECT payments.booking_id
    FROM payments
    WHERE (
      payments.payment_link_status = ANY (ARRAY['pending'::payment_link_status, 'active'::payment_link_status, 'paid'::payment_link_status])
    )
    AND (
      payments.payment_link_expires_at IS NULL
      OR payments.payment_link_expires_at > (now() - '24:00:00'::interval)
    )
  )
);