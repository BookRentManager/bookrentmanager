-- CRITICAL FIX: Remove default value from paid_at column
-- This was causing all payments to be created as "paid" automatically

ALTER TABLE payments 
ALTER COLUMN paid_at DROP DEFAULT;

-- Verify payment_link_status default is correct
ALTER TABLE payments 
ALTER COLUMN payment_link_status SET DEFAULT 'pending'::payment_link_status;

-- Universal cleanup: Reset all test payments (no real PostFinance transaction)
-- This will fix ALL bookings that were created with the broken default
UPDATE payments
SET 
  paid_at = NULL,
  payment_link_status = 'active'
WHERE postfinance_transaction_id IS NULL  -- No real transaction
  AND paid_at IS NOT NULL                 -- But marked as paid
  AND payment_intent IN (
    'down_payment', 
    'balance_payment', 
    'final_payment', 
    'security_deposit',
    'client_payment'
  );

-- Recalculate amount_paid for ALL bookings (excluding security deposits)
UPDATE bookings b
SET amount_paid = (
  SELECT COALESCE(SUM(p.amount), 0)
  FROM payments p
  WHERE p.booking_id = b.id
    AND p.payment_link_status = 'paid'
    AND p.paid_at IS NOT NULL
    AND p.postfinance_transaction_id IS NOT NULL  -- MUST have real transaction
    AND p.payment_intent IS DISTINCT FROM 'security_deposit'
)
WHERE b.deleted_at IS NULL;

-- Fix booking statuses: Keep confirmed if they have real payments
-- Reset to draft if no real payments
UPDATE bookings b
SET status = CASE
  WHEN b.amount_paid >= (
    CASE 
      WHEN b.payment_amount_percent IS NOT NULL AND b.payment_amount_percent > 0 
      THEN (b.amount_total * b.payment_amount_percent) / 100
      ELSE 0.01
    END
  ) THEN 'confirmed'::booking_status
  ELSE 'draft'::booking_status
END
WHERE b.status = 'confirmed'
  AND b.deleted_at IS NULL;

-- Create validation function to prevent marking payments as paid without transaction ID
CREATE OR REPLACE FUNCTION validate_payment_before_paid()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent setting paid_at without a transaction ID (except for manual payments)
  IF NEW.paid_at IS NOT NULL 
     AND NEW.postfinance_transaction_id IS NULL 
     AND NEW.method != 'other' THEN  -- Allow manual payments
    RAISE EXCEPTION 'Cannot mark payment as paid without a PostFinance transaction ID';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to payments table
DROP TRIGGER IF EXISTS validate_payment_status ON payments;
CREATE TRIGGER validate_payment_status
  BEFORE INSERT OR UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION validate_payment_before_paid();