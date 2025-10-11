-- Add country field to bookings table
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS country text;

-- Create function to auto-generate client invoice when booking is fully paid
CREATE OR REPLACE FUNCTION public.auto_generate_client_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if booking is fully paid and doesn't have a client invoice yet
  IF NEW.amount_paid >= NEW.amount_total AND NOT EXISTS (
    SELECT 1 FROM public.client_invoices WHERE booking_id = NEW.id
  ) THEN
    -- Generate invoice number based on booking reference
    INSERT INTO public.client_invoices (
      booking_id,
      invoice_number,
      client_name,
      billing_address,
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
      NEW.amount_total,
      0, -- No VAT by default as requested
      0,
      NEW.amount_total,
      CURRENT_DATE
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-generate client invoice
DROP TRIGGER IF EXISTS trigger_auto_generate_client_invoice ON public.bookings;
CREATE TRIGGER trigger_auto_generate_client_invoice
AFTER UPDATE OF amount_paid ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.auto_generate_client_invoice();