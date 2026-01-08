-- Add counts_towards_revenue column to payments table
ALTER TABLE payments 
ADD COLUMN counts_towards_revenue boolean DEFAULT false;

-- Set counts_towards_revenue = true for existing rental payment intents
UPDATE payments 
SET counts_towards_revenue = true 
WHERE payment_intent IN ('down_payment', 'balance_payment', 'full_payment', 'client_payment');

-- Update the trigger to only count rental payments towards amount_paid
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
  -- Calculate total amount paid for this booking
  -- ONLY count rental payments (exclude security_deposit, fines, extras)
  -- For 'other' intent, respect the counts_towards_revenue flag
  SELECT COALESCE(SUM(p.amount), 0) INTO v_total_paid
  FROM payments p
  WHERE p.booking_id = NEW.booking_id
    AND p.payment_link_status = 'paid'
    AND p.paid_at IS NOT NULL
    AND (
      -- Rental payment intents that always count
      p.payment_intent IN ('down_payment', 'balance_payment', 'full_payment', 'client_payment')
      -- OR 'other' payments where user explicitly marked it to count
      OR (p.payment_intent = 'other' AND p.counts_towards_revenue = true)
    );

  -- Get booking info
  SELECT status, payment_amount_percent, amount_total 
  INTO v_booking_status, v_payment_amount_percent, v_amount_total
  FROM bookings 
  WHERE id = NEW.booking_id;

  -- Update amount_paid on booking
  UPDATE bookings 
  SET amount_paid = v_total_paid,
      updated_at = now()
  WHERE id = NEW.booking_id;

  -- Auto-update booking status based on payment completion
  IF v_booking_status = 'confirmed' THEN
    -- Calculate required amount based on payment_amount_percent
    IF v_payment_amount_percent IS NOT NULL AND v_payment_amount_percent > 0 THEN
      v_required_amount := (v_amount_total * v_payment_amount_percent / 100);
    ELSE
      v_required_amount := v_amount_total;
    END IF;

    -- If payment meets or exceeds required amount, update to paid
    IF v_total_paid >= v_required_amount THEN
      UPDATE bookings 
      SET status = 'paid',
          updated_at = now()
      WHERE id = NEW.booking_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Recalculate amount_paid for all existing bookings based on correct logic
UPDATE bookings b
SET amount_paid = (
  SELECT COALESCE(SUM(p.amount), 0)
  FROM payments p
  WHERE p.booking_id = b.id
    AND p.payment_link_status = 'paid'
    AND p.paid_at IS NOT NULL
    AND (
      p.payment_intent IN ('down_payment', 'balance_payment', 'full_payment', 'client_payment')
      OR (p.payment_intent = 'other' AND p.counts_towards_revenue = true)
    )
),
updated_at = now()
WHERE EXISTS (
  SELECT 1 FROM payments p WHERE p.booking_id = b.id
);