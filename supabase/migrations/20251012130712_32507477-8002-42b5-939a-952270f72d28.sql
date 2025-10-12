-- Add payment_status to client_invoices table
ALTER TABLE public.client_invoices 
ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'to_pay';

-- Drop existing trigger
DROP TRIGGER IF EXISTS on_booking_confirmed ON public.bookings;

-- Create improved function to handle invoice creation and updates
CREATE OR REPLACE FUNCTION public.auto_manage_client_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if this is an INSERT (new booking)
  IF TG_OP = 'INSERT' THEN
    -- Create invoice for any new booking
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

  -- Check if this is an UPDATE and status changed to confirmed
  IF TG_OP = 'UPDATE' AND OLD.status != 'confirmed' AND NEW.status = 'confirmed' THEN
    -- Update existing invoice to paid status
    UPDATE public.client_invoices
    SET payment_status = 'paid',
        updated_at = now()
    WHERE booking_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for INSERT operations
CREATE TRIGGER on_booking_insert
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_manage_client_invoice();

-- Create trigger for UPDATE operations
CREATE TRIGGER on_booking_status_update
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.auto_manage_client_invoice();