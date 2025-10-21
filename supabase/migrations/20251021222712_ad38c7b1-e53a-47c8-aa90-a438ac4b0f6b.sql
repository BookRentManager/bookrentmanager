-- Comprehensive fix: Recalculate amount_paid for ALL bookings
-- This excludes security deposits and only counts actual client payments
UPDATE bookings b
SET 
  amount_paid = (
    SELECT COALESCE(SUM(p.amount), 0)
    FROM payments p
    WHERE p.booking_id = b.id
      AND p.payment_link_status = 'paid'
      AND p.paid_at IS NOT NULL
      AND p.payment_intent IS DISTINCT FROM 'security_deposit'
  ),
  updated_at = now()
WHERE b.deleted_at IS NULL;