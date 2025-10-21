-- Fix security deposit exclusion from amount_paid calculation

-- 1. Update the trigger to explicitly exclude security deposits by intent
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
  -- EXCLUDE security deposits by intent (belt-and-suspenders approach)
  -- Only count actual client payments (initial and balance)
  SELECT COALESCE(SUM(p.amount), 0) INTO v_total_paid
  FROM payments p
  WHERE p.booking_id = NEW.booking_id
    AND p.payment_link_status = 'paid'
    AND p.paid_at IS NOT NULL
    AND p.payment_intent IS DISTINCT FROM 'security_deposit';

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

-- 2. Recalculate amount_paid for all bookings to fix existing data
UPDATE bookings b
SET amount_paid = (
  SELECT COALESCE(SUM(p.amount), 0)
  FROM payments p
  WHERE p.booking_id = b.id
    AND p.payment_link_status = 'paid'
    AND p.paid_at IS NOT NULL
    AND p.payment_intent IS DISTINCT FROM 'security_deposit'
)
WHERE EXISTS (
  SELECT 1 FROM payments p
  WHERE p.booking_id = b.id
);