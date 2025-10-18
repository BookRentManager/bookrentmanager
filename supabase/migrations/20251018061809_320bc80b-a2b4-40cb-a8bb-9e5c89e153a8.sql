-- Fix audit log action in update_booking_on_payment trigger to use valid enum value
CREATE OR REPLACE FUNCTION public.update_booking_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_booking RECORD;
  v_total_paid NUMERIC;
  v_required_down_payment NUMERIC;
BEGIN
  -- Only process if payment is marked as paid
  IF NEW.payment_link_status = 'paid'::payment_link_status OR (NEW.paid_at IS NOT NULL AND (OLD.paid_at IS NULL OR OLD IS NULL)) THEN
    
    -- Get booking details
    SELECT * INTO v_booking
    FROM bookings
    WHERE id = NEW.booking_id;
    
    -- Calculate total amount paid for this booking
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM payments
    WHERE booking_id = NEW.booking_id
      AND (payment_link_status = 'paid'::payment_link_status OR paid_at IS NOT NULL);
    
    -- Update booking amount_paid
    UPDATE bookings
    SET amount_paid = v_total_paid,
        updated_at = NOW()
    WHERE id = NEW.booking_id;
    
    -- Calculate required down payment
    IF v_booking.payment_amount_percent IS NOT NULL AND v_booking.payment_amount_percent > 0 THEN
      v_required_down_payment := (v_booking.amount_total * v_booking.payment_amount_percent) / 100;
    ELSE
      -- If no percentage specified, consider any payment as sufficient
      v_required_down_payment := 0.01;
    END IF;
    
    -- Auto-confirm booking if:
    -- 1. Currently in draft status
    -- 2. Down payment requirement is met
    IF v_booking.status = 'draft'::booking_status AND v_total_paid >= v_required_down_payment THEN
      UPDATE bookings
      SET status = 'confirmed'::booking_status,
          updated_at = NOW()
      WHERE id = NEW.booking_id;
      
      -- Update client invoice payment status to partial or paid
      UPDATE client_invoices
      SET payment_status = CASE 
        WHEN v_total_paid >= v_booking.amount_total THEN 'paid'
        ELSE 'partial'
      END,
      updated_at = NOW()
      WHERE booking_id = NEW.booking_id;
      
      -- Log the auto-confirmation with valid enum value
      INSERT INTO audit_logs (entity, entity_id, action, payload_snapshot)
      VALUES (
        'booking',
        NEW.booking_id,
        'status_change',
        jsonb_build_object(
          'status_change_type', 'auto_confirmed',
          'triggered_by', 'payment',
          'payment_id', NEW.id,
          'amount_paid', v_total_paid,
          'required_down_payment', v_required_down_payment,
          'old_status', 'draft',
          'new_status', 'confirmed'
        )
      );

      -- Check if delivery is within 48 hours - if so, trigger immediate reminders
      IF v_booking.delivery_datetime <= (NOW() + INTERVAL '48 hours') THEN
        PERFORM net.http_post(
          url := 'https://lbvaghmqwhsawvxyiemw.supabase.co/functions/v1/trigger-immediate-reminders',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('request.jwt.claims', true)::json->>'token'
          ),
          body := jsonb_build_object('booking_id', NEW.booking_id)
        );
      END IF;
    ELSIF v_booking.status = 'confirmed'::booking_status THEN
      -- Update client invoice payment status if already confirmed
      UPDATE client_invoices
      SET payment_status = CASE 
        WHEN v_total_paid >= v_booking.amount_total THEN 'paid'
        ELSE 'partial'
      END,
      updated_at = NOW()
      WHERE booking_id = NEW.booking_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;