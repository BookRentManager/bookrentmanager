-- Update the client invoice creation trigger to handle imported vs manual bookings correctly
DROP TRIGGER IF EXISTS auto_create_client_invoice_trigger ON public.bookings;
DROP FUNCTION IF EXISTS public.auto_create_client_invoice();

CREATE OR REPLACE FUNCTION public.auto_create_client_invoice()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create invoice if it doesn't exist yet
  IF NOT EXISTS (
    SELECT 1 FROM public.client_invoices WHERE booking_id = NEW.id
  ) THEN
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
      issue_date,
      payment_status
    ) VALUES (
      NEW.id,
      'INV-' || NEW.reference_code,
      NEW.client_name,
      NEW.billing_address,
      'Car Rental Service - ' || NEW.car_model,
      NEW.amount_total,
      0,
      0,
      NEW.amount_total,
      CURRENT_DATE,
      -- If imported from email, always set to paid (since imports are always confirmed)
      -- Otherwise, set based on booking status
      CASE 
        WHEN NEW.imported_from_email = true THEN 'paid'
        WHEN NEW.status = 'confirmed' THEN 'paid'
        ELSE 'to_pay'
      END
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new bookings
CREATE TRIGGER auto_create_client_invoice_trigger
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_client_invoice();