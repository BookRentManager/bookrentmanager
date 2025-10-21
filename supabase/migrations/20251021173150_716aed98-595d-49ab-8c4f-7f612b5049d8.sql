-- Fix the update_booking_on_payment trigger to correctly handle payment types
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
  -- Include only actual payments (type = 'deposit' or type = 'payment')
  -- Exclude security deposits (payment_intent = 'security_deposit')
  -- Exclude authorizations (type = 'authorization')
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM payments
  WHERE booking_id = NEW.booking_id
    AND payment_link_status = 'paid'
    AND paid_at IS NOT NULL
    AND payment_intent != 'security_deposit'
    AND type != 'authorization';

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