-- Recalculate amount_paid for all bookings to exclude security deposits
-- This fixes any stale data from when the trigger had incorrect logic

UPDATE bookings b
SET amount_paid = (
  SELECT COALESCE(SUM(p.amount), 0)
  FROM payments p
  WHERE p.booking_id = b.id
    AND p.payment_link_status = 'paid'
    AND p.paid_at IS NOT NULL
    AND p.payment_intent IS DISTINCT FROM 'security_deposit'
)
WHERE b.deleted_at IS NULL;