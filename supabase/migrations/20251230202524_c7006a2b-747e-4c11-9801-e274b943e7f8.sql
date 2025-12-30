-- Add amount_paid column for tracking partial payments
ALTER TABLE supplier_invoices 
ADD COLUMN IF NOT EXISTS amount_paid numeric DEFAULT 0;

-- Add invoice_type column to categorize invoices
ALTER TABLE supplier_invoices 
ADD COLUMN IF NOT EXISTS invoice_type text DEFAULT 'rental';

-- Add comment for clarity
COMMENT ON COLUMN supplier_invoices.invoice_type IS 'rental = normal supplier cost, security_deposit_extra = damage/fuel/etc charges';
COMMENT ON COLUMN supplier_invoices.amount_paid IS 'Amount already paid towards this invoice (for partial payments)';