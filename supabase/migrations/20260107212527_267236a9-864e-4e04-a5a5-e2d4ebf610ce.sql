-- Create agency_invoices table for tracking agency commission invoices
CREATE TABLE public.agency_invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID REFERENCES public.agencies(id) NOT NULL,
  booking_id UUID REFERENCES public.bookings(id),
  issue_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  payment_status public.invoice_payment_status NOT NULL DEFAULT 'to_pay',
  invoice_url TEXT,
  payment_proof_url TEXT,
  amount_paid NUMERIC DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.agency_invoices ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (same pattern as supplier_invoices)
CREATE POLICY "Authenticated users can view agency invoices"
  ON public.agency_invoices
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "Authenticated users can insert agency invoices"
  ON public.agency_invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update agency invoices"
  ON public.agency_invoices
  FOR UPDATE
  TO authenticated
  USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_agency_invoices_updated_at
  BEFORE UPDATE ON public.agency_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for common queries
CREATE INDEX idx_agency_invoices_agency_id ON public.agency_invoices(agency_id);
CREATE INDEX idx_agency_invoices_booking_id ON public.agency_invoices(booking_id);
CREATE INDEX idx_agency_invoices_payment_status ON public.agency_invoices(payment_status);