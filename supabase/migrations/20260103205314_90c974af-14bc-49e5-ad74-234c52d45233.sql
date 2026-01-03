-- Create function to trigger immediate reminders for short-notice bookings
CREATE OR REPLACE FUNCTION public.trigger_immediate_reminders_on_confirm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_hours_until_delivery numeric;
  v_request_id bigint;
BEGIN
  -- Only trigger when status changes TO 'confirmed' (not from 'confirmed')
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    -- Skip agency bookings
    IF NEW.booking_type = 'agency' THEN
      RETURN NEW;
    END IF;
    
    -- Calculate hours until delivery
    v_hours_until_delivery := EXTRACT(EPOCH FROM (NEW.delivery_datetime - now())) / 3600;
    
    -- Only trigger for short-notice bookings (less than 48 hours)
    IF v_hours_until_delivery <= 48 AND v_hours_until_delivery > 0 THEN
      -- Call the trigger-immediate-reminders edge function
      SELECT net.http_post(
        url := 'https://lbvaghmqwhsawvxyiemw.supabase.co/functions/v1/trigger-immediate-reminders',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
        ),
        body := jsonb_build_object('booking_id', NEW.id::text)
      ) INTO v_request_id;
      
      RAISE LOG 'Triggered immediate reminders for short-notice booking % (hours: %, request_id: %)', 
        NEW.reference_code, v_hours_until_delivery, v_request_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger on bookings table
DROP TRIGGER IF EXISTS trigger_immediate_reminders_on_booking_confirm ON bookings;
CREATE TRIGGER trigger_immediate_reminders_on_booking_confirm
  AFTER INSERT OR UPDATE OF status ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_immediate_reminders_on_confirm();