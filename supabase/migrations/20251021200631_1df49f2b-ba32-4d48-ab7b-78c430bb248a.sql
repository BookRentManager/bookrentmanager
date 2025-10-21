-- Fix KR009320 test data: Only down payment should be paid
-- Balance payment and security deposit should be pending/active

UPDATE payments
SET 
  paid_at = NULL,
  payment_link_status = 'active'
WHERE booking_id = (SELECT id FROM bookings WHERE reference_code = 'KR009320')
  AND payment_intent IN ('balance_payment', 'security_deposit')
  AND postfinance_transaction_id IS NULL; -- Safety: only fix test data without real transactions

-- Recalculate amount_paid for this booking
UPDATE bookings
SET amount_paid = (
  SELECT COALESCE(SUM(p.amount), 0)
  FROM payments p
  WHERE p.booking_id = bookings.id
    AND p.payment_link_status = 'paid'
    AND p.paid_at IS NOT NULL
    AND p.payment_intent IS DISTINCT FROM 'security_deposit'
)
WHERE reference_code = 'KR009320';