-- Add due_date column to supplier_invoices table
ALTER TABLE supplier_invoices 
ADD COLUMN due_date date;

COMMENT ON COLUMN supplier_invoices.due_date IS 'Payment due date for the invoice';