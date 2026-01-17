-- Add invoice_reference column to supplier_invoices for separating invoice number from supplier name
ALTER TABLE supplier_invoices 
ADD COLUMN invoice_reference text;

COMMENT ON COLUMN supplier_invoices.invoice_reference IS 'Invoice number or reference (e.g., "Fattura 255", "Rechnung 10122")';