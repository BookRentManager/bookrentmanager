-- Drop the existing trigger
DROP TRIGGER IF EXISTS auto_generate_client_invoice_trigger ON public.bookings;

-- Update the function to generate invoice on confirmed status
CREATE OR REPLACE FUNCTION public.auto_generate_client_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if booking is confirmed and doesn't have a client invoice yet
  IF NEW.status = 'confirmed' AND NOT EXISTS (
    SELECT 1 FROM public.client_invoices WHERE booking_id = NEW.id
  ) THEN
    -- Generate invoice number based on booking reference
    INSERT INTO public.client_invoices (
      booking_id,
      invoice_number,
      client_name,
      billing_address,
      description,
      subtotal,
      vat_rate,
      vat_amount,
      total_amount,
      issue_date
    ) VALUES (
      NEW.id,
      'INV-' || NEW.reference_code,
      NEW.client_name,
      NEW.billing_address,
      'Car Rental Service - ' || NEW.car_model,
      NEW.amount_total,
      0, -- No VAT by default as requested
      0,
      NEW.amount_total,
      CURRENT_DATE
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Recreate the trigger
CREATE TRIGGER auto_generate_client_invoice_trigger
AFTER INSERT OR UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.auto_generate_client_invoice();