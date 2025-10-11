-- Update booking status enum to use 'draft' instead of 'to_be_confirmed'
ALTER TYPE booking_status RENAME TO booking_status_old;
CREATE TYPE booking_status AS ENUM ('draft', 'confirmed', 'ongoing', 'completed', 'cancelled');

-- Update existing bookings to use new status
ALTER TABLE bookings ALTER COLUMN status DROP DEFAULT;
ALTER TABLE bookings ALTER COLUMN status TYPE booking_status USING (
  CASE 
    WHEN status::text = 'to_be_confirmed' THEN 'draft'::booking_status
    ELSE status::text::booking_status
  END
);
ALTER TABLE bookings ALTER COLUMN status SET DEFAULT 'draft'::booking_status;

-- Drop old enum
DROP TYPE booking_status_old;

-- Create client_invoices table
CREATE TABLE public.client_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  client_name TEXT NOT NULL,
  billing_address TEXT,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  vat_rate NUMERIC NOT NULL DEFAULT 0,
  vat_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  issue_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on client_invoices
ALTER TABLE public.client_invoices ENABLE ROW LEVEL SECURITY;

-- RLS policies for client_invoices
CREATE POLICY "Admin and staff can view client invoices"
ON public.client_invoices
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR (has_role(auth.uid(), 'staff'::app_role) AND deleted_at IS NULL));

CREATE POLICY "Staff can manage client invoices"
ON public.client_invoices
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_client_invoices_updated_at
BEFORE UPDATE ON public.client_invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_client_invoices_booking_id ON public.client_invoices(booking_id) WHERE deleted_at IS NULL;