-- Fix the update_booking_on_payment trigger that was incorrectly trying to set booking.status = 'paid'
-- The booking_status enum does NOT include 'paid' (valid: draft, confirmed, ongoing, completed, cancelled)
-- This was causing the PostFinance webhook to fail when updating payment status

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
  SELECT COALESCE(SUM(p.amount), 0) INTO v_total_paid
  FROM payments p
  WHERE p.booking_id = NEW.booking_id
    AND p.payment_link_status = 'paid'
    AND p.paid_at IS NOT NULL
    AND (
      p.payment_intent IN ('down_payment', 'balance_payment', 'full_payment', 'client_payment')
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

  -- Auto-confirm booking from draft when down payment is met
  IF v_booking_status = 'draft' THEN
    IF v_payment_amount_percent IS NOT NULL AND v_payment_amount_percent > 0 THEN
      v_required_amount := (v_amount_total * v_payment_amount_percent / 100);
    ELSE
      v_required_amount := 0.01; -- Any payment confirms if no percentage set
    END IF;

    IF v_total_paid >= v_required_amount THEN
      UPDATE bookings 
      SET status = 'confirmed',
          updated_at = now()
      WHERE id = NEW.booking_id;
    END IF;
  END IF;
  
  -- NOTE: Removed invalid 'paid' status logic that was breaking the trigger
  -- The booking_status enum does not include 'paid'
  -- Valid values: draft, confirmed, ongoing, completed, cancelled

  RETURN NEW;
END;
$function$;