-- Create trigger to ensure payment status consistency
-- When paid_at is set, payment_link_status should be 'paid'
-- When paid_at is cleared, payment_link_status should revert

CREATE OR REPLACE FUNCTION public.sync_payment_link_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- If paid_at is set and payment_link_status is not 'paid', update it
  IF NEW.paid_at IS NOT NULL AND NEW.payment_link_status != 'paid' THEN
    NEW.payment_link_status := 'paid';
  END IF;
  
  -- If paid_at is cleared and status is 'paid', revert to active
  IF NEW.paid_at IS NULL AND OLD.paid_at IS NOT NULL AND NEW.payment_link_status = 'paid' THEN
    NEW.payment_link_status := 'active';
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE TRIGGER ensure_payment_status_consistency
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_payment_link_status();

-- Fix existing inconsistent data
-- Update all payments where paid_at exists but status is not 'paid'
UPDATE public.payments
SET payment_link_status = 'paid'
WHERE paid_at IS NOT NULL 
  AND payment_link_status != 'paid';