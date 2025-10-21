-- Fix stale amount_paid in bookings table by recalculating from payments
-- This ensures amount_paid reflects only actual client payments (excluding security deposits)
UPDATE bookings b
SET amount_paid = (
  SELECT COALESCE(SUM(p.amount), 0)
  FROM payments p
  WHERE p.booking_id = b.id
    AND p.payment_link_status = 'paid'
    AND p.paid_at IS NOT NULL
    AND p.payment_intent IS DISTINCT FROM 'security_deposit'
),
updated_at = now()
WHERE EXISTS (
  SELECT 1 
  FROM payments p
  WHERE p.booking_id = b.id
);