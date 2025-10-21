-- Update the database trigger to call the new trigger-payment-confirmation function
-- This replaces the call to send-payment-confirmation with trigger-payment-confirmation

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
  v_supabase_url TEXT;
  v_booking_update_type TEXT;
BEGIN
  -- CRITICAL FIX: Prevent infinite loop by checking if this is just an email confirmation update
  -- If only confirmation_email_sent_at is being updated, skip the entire function
  IF (TG_OP = 'UPDATE' AND 
      OLD.confirmation_email_sent_at IS DISTINCT FROM NEW.confirmation_email_sent_at AND
      OLD.payment_link_status IS NOT DISTINCT FROM NEW.payment_link_status AND
      OLD.paid_at IS NOT DISTINCT FROM NEW.paid_at) THEN
    RETURN NEW;
  END IF;

  -- Only process if payment is marked as paid
  IF NEW.payment_link_status = 'paid'::payment_link_status OR (NEW.paid_at IS NOT NULL AND (OLD.paid_at IS NULL OR OLD IS NULL)) THEN
    
    -- CRITICAL FIX: Check if confirmation email was already sent for this payment
    -- This prevents sending duplicate emails
    IF NEW.confirmation_email_sent_at IS NOT NULL THEN
      RETURN NEW;
    END IF;

    -- Get Supabase URL from environment
    v_supabase_url := 'https://lbvaghmqwhsawvxyiemw.supabase.co';
    
    -- Get booking details
    SELECT * INTO v_booking
    FROM bookings
    WHERE id = NEW.booking_id;
    
    -- CRITICAL FIX: Calculate total amount paid for this booking EXCLUDING security deposits
    -- Security deposits are authorizations, NOT payments
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM payments
    WHERE booking_id = NEW.booking_id
      AND (payment_link_status = 'paid'::payment_link_status OR paid_at IS NOT NULL)
      AND (payment_intent IS DISTINCT FROM 'security_deposit');
    
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
      -- Determine booking update type for email
      v_booking_update_type := 'initial_confirmation';
      
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
      
      -- Log the auto-confirmation
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

      -- Trigger email sending via edge function (async, non-blocking)
      -- UPDATED: Call trigger-payment-confirmation instead of send-payment-confirmation
      BEGIN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/trigger-payment-confirmation',
          headers := jsonb_build_object(
            'Content-Type', 'application/json'
          ),
          body := jsonb_build_object(
            'payment_id', NEW.id::text,
            'booking_update_type', v_booking_update_type
          )
        );
      EXCEPTION WHEN OTHERS THEN
        -- Log error but don't fail the transaction
        RAISE WARNING 'Failed to trigger email sending: %', SQLERRM;
      END;

      -- Check if delivery is within 48 hours - if so, trigger immediate reminders
      IF v_booking.delivery_datetime <= (NOW() + INTERVAL '48 hours') THEN
        BEGIN
          PERFORM net.http_post(
            url := v_supabase_url || '/functions/v1/trigger-immediate-reminders',
            headers := jsonb_build_object(
              'Content-Type', 'application/json'
            ),
            body := jsonb_build_object('booking_id', NEW.booking_id::text)
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'Failed to trigger immediate reminders: %', SQLERRM;
        END;
      END IF;
    ELSIF v_booking.status = 'confirmed'::booking_status THEN
      -- Booking already confirmed - this is an additional payment
      v_booking_update_type := 'additional_payment';
      
      -- Update client invoice payment status if already confirmed
      UPDATE client_invoices
      SET payment_status = CASE 
        WHEN v_total_paid >= v_booking.amount_total THEN 'paid'
        ELSE 'partial'
      END,
      updated_at = NOW()
      WHERE booking_id = NEW.booking_id;
      
      -- Trigger email sending for additional payments
      -- UPDATED: Call trigger-payment-confirmation instead of send-payment-confirmation
      BEGIN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/trigger-payment-confirmation',
          headers := jsonb_build_object(
            'Content-Type', 'application/json'
          ),
          body := jsonb_build_object(
            'payment_id', NEW.id::text,
            'booking_update_type', v_booking_update_type
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to trigger email sending: %', SQLERRM;
      END;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;