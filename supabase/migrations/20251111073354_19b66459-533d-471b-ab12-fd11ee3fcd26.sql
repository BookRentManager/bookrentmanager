-- Create tax_invoices table
CREATE TABLE tax_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Invoice identification
  invoice_number text UNIQUE NOT NULL,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  
  -- Relationships
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,
  
  -- Client information
  client_name text NOT NULL,
  client_email text,
  billing_address text,
  
  -- Line items (flexible JSONB structure)
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Financial calculations
  subtotal numeric NOT NULL,
  vat_rate numeric NOT NULL DEFAULT 0,
  vat_amount numeric NOT NULL,
  total_amount numeric NOT NULL,
  
  -- Currency
  currency text NOT NULL DEFAULT 'EUR',
  
  -- PDF storage
  pdf_url text,
  
  -- Status tracking
  status text NOT NULL DEFAULT 'draft',
  
  -- Notes
  notes text,
  
  -- Audit fields
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Create indexes
CREATE INDEX idx_tax_invoices_booking_id ON tax_invoices(booking_id);
CREATE INDEX idx_tax_invoices_payment_id ON tax_invoices(payment_id);
CREATE INDEX idx_tax_invoices_invoice_date ON tax_invoices(invoice_date);
CREATE INDEX idx_tax_invoices_status ON tax_invoices(status);
CREATE INDEX idx_tax_invoices_deleted_at ON tax_invoices(deleted_at);

-- Enable RLS
ALTER TABLE tax_invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Accountants and admins can view tax invoices"
  ON tax_invoices FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'accountant') OR 
    has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Accountants and admins can create tax invoices"
  ON tax_invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'accountant') OR 
    has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Accountants and admins can update tax invoices"
  ON tax_invoices FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'accountant') OR 
    has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Accountants and admins can delete tax invoices"
  ON tax_invoices FOR DELETE
  TO authenticated
  USING (
    has_role(auth.uid(), 'accountant') OR 
    has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Staff can view tax invoices"
  ON tax_invoices FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'staff')
  );

-- Function to generate next invoice number
CREATE OR REPLACE FUNCTION get_next_tax_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today_prefix text;
  daily_count integer;
  next_number text;
BEGIN
  -- Format: YYYYMMDD (e.g., 20251112 for November 12, 2025)
  today_prefix := to_char(CURRENT_DATE, 'YYYYMMDD');
  
  -- Count how many invoices exist today
  SELECT COUNT(*) INTO daily_count
  FROM tax_invoices
  WHERE invoice_number LIKE today_prefix || '%'
    AND deleted_at IS NULL;
  
  -- Generate next number: YYYYMMDD + (count + 1)
  next_number := today_prefix || (daily_count + 1)::text;
  
  RETURN next_number;
END;
$$;

-- Trigger for auto-update updated_at
CREATE TRIGGER update_tax_invoices_updated_at
  BEFORE UPDATE ON tax_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create storage bucket for tax invoice PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('tax-invoice-pdfs', 'tax-invoice-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Accountants can upload tax invoice PDFs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'tax-invoice-pdfs' AND
    (has_role(auth.uid(), 'accountant') OR has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Accountants and staff can view tax invoice PDFs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'tax-invoice-pdfs' AND
    (has_role(auth.uid(), 'accountant') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'))
  );