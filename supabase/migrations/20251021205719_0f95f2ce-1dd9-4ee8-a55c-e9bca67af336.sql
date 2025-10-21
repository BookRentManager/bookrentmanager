-- Create trigger function to send payment confirmation email via Zapier
CREATE OR REPLACE FUNCTION trigger_payment_confirmation_email()
RETURNS TRIGGER AS $$
DECLARE
  v_booking_update_type text;
  v_is_first_payment boolean;
  v_request_id bigint;
BEGIN
  -- Only proceed if status changed to 'paid' and it's not a security deposit
  IF NEW.payment_link_status = 'paid' 
     AND OLD.payment_link_status != 'paid'
     AND NEW.payment_intent IS DISTINCT FROM 'security_deposit'
     AND NEW.paid_at IS NOT NULL
  THEN
    -- Determine if this is the first payment for the booking
    SELECT COUNT(*) = 0 INTO v_is_first_payment
    FROM payments
    WHERE booking_id = NEW.booking_id
      AND id != NEW.id
      AND payment_link_status = 'paid'
      AND payment_intent IS DISTINCT FROM 'security_deposit';
    
    -- Set booking update type
    v_booking_update_type := CASE 
      WHEN v_is_first_payment THEN 'initial_confirmation'
      ELSE 'additional_payment'
    END;
    
    -- Call edge function using hardcoded URL
    SELECT net.http_post(
      url := 'https://lbvaghmqwhsawvxyiemw.supabase.co/functions/v1/trigger-payment-confirmation',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
      ),
      body := jsonb_build_object(
        'payment_id', NEW.id::text,
        'booking_update_type', v_booking_update_type
      )
    ) INTO v_request_id;
    
    RAISE LOG 'Triggered payment confirmation email for payment % (request_id: %, type: %)', NEW.id, v_request_id, v_booking_update_type;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on payments table
CREATE TRIGGER send_payment_confirmation_email
  AFTER UPDATE ON payments
  FOR EACH ROW
  WHEN (NEW.payment_link_status = 'paid' AND OLD.payment_link_status IS DISTINCT FROM 'paid')
  EXECUTE FUNCTION trigger_payment_confirmation_email();