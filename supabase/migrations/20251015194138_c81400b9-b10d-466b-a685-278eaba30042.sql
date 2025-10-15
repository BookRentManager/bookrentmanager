-- Drop triggers first, then the function with CASCADE
DROP TRIGGER IF EXISTS on_booking_insert ON public.bookings;
DROP TRIGGER IF EXISTS on_booking_status_update ON public.bookings;
DROP TRIGGER IF EXISTS auto_manage_client_invoice_trigger ON public.bookings;
DROP FUNCTION IF EXISTS public.auto_manage_client_invoice() CASCADE;

-- Create a new, simpler trigger that only creates invoice on INSERT
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
      CASE 
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

-- Update existing payment status for confirmed bookings
CREATE OR REPLACE FUNCTION public.update_invoice_payment_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if status changed to confirmed
  IF OLD.status != 'confirmed' AND NEW.status = 'confirmed' THEN
    UPDATE public.client_invoices
    SET payment_status = 'paid',
        updated_at = now()
    WHERE booking_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for status updates
CREATE TRIGGER update_invoice_payment_status_trigger
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.update_invoice_payment_status();