-- Change default status from 'draft' to 'issued'
ALTER TABLE tax_invoices 
ALTER COLUMN status SET DEFAULT 'issued';

-- Update existing 'draft' invoices to 'issued'
UPDATE tax_invoices 
SET status = 'issued' 
WHERE status = 'draft';