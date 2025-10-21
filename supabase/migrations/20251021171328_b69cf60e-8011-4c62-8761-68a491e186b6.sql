-- Fix security deposit payment counting issue
-- Security deposits are AUTHORIZATIONS, not payments
-- They should NOT be counted in amount_paid calculations

-- Step 1: Make paid_at nullable (security deposits shouldn't have paid_at)
ALTER TABLE payments ALTER COLUMN paid_at DROP NOT NULL;

-- Step 2: Clean up existing security deposit payment records
-- Security deposits should not have paid_at set as they are authorizations
UPDATE payments 
SET paid_at = NULL, 
    payment_link_status = 'active'
WHERE payment_intent = 'security_deposit' 
  AND payment_link_status = 'paid';

-- Step 3: Recalculate amount_paid for all bookings to fix corrupted values
-- This excludes security deposits from the calculation
UPDATE bookings 
SET amount_paid = (
  SELECT COALESCE(SUM(p.amount), 0)
  FROM payments p
  WHERE p.booking_id = bookings.id
    AND p.paid_at IS NOT NULL
    AND p.payment_link_status = 'paid'
    AND p.payment_intent IS DISTINCT FROM 'security_deposit'
)
WHERE EXISTS (
  SELECT 1 
  FROM payments p 
  WHERE p.booking_id = bookings.id
);

-- Step 4: Update the trigger to be more robust
-- Add an extra check to ensure authorizations are never counted as payments
CREATE OR REPLACE FUNCTION public.update_booking_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_paid numeric;
  v_booking_status text;
  v_payment_amount_percent integer;
  v_amount_total numeric;
  v_required_amount numeric;
BEGIN
  -- CRITICAL FIX: Calculate total amount paid for this booking
  -- EXCLUDING security deposits (they are authorizations, NOT payments)
  -- Also exclude any payment record that has type = 'authorization'
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM payments
  WHERE booking_id = NEW.booking_id
    AND payment_link_status = 'paid'
    AND paid_at IS NOT NULL
    AND payment_intent IS DISTINCT FROM 'security_deposit'
    AND (type IS NULL OR type != 'authorization');

  -- Get booking details
  SELECT status, payment_amount_percent, amount_total
  INTO v_booking_status, v_payment_amount_percent, v_amount_total
  FROM bookings
  WHERE id = NEW.booking_id;

  -- Update booking amount_paid
  UPDATE bookings
  SET amount_paid = v_total_paid
  WHERE id = NEW.booking_id;

  -- Auto-confirm booking if payment requirement is met
  IF v_booking_status = 'draft' AND v_payment_amount_percent IS NOT NULL THEN
    v_required_amount := (v_amount_total * v_payment_amount_percent) / 100;
    
    IF v_total_paid >= v_required_amount THEN
      UPDATE bookings
      SET status = 'confirmed'
      WHERE id = NEW.booking_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;