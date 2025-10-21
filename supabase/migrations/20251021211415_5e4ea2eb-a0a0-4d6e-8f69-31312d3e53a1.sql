-- Fix security deposits incorrectly marked as 'paid'
-- Security deposits should NEVER have payment_link_status = 'paid'
UPDATE payments
SET payment_link_status = 'active',
    paid_at = NULL,
    updated_at = now()
WHERE payment_intent = 'security_deposit'
  AND payment_link_status = 'paid';

-- Recalculate amount_paid for all bookings to exclude security deposits
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