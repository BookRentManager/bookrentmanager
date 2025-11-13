-- Enable pg_trgm extension for text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add index for currency filtering
CREATE INDEX IF NOT EXISTS idx_tax_invoices_currency ON tax_invoices(currency) WHERE deleted_at IS NULL;

-- Add index for client name searches (using gin for text search)
CREATE INDEX IF NOT EXISTS idx_tax_invoices_client_name_trgm ON tax_invoices USING gin (client_name gin_trgm_ops);

-- Add index for invoice number searches (using gin for text search)
CREATE INDEX IF NOT EXISTS idx_tax_invoices_invoice_number_trgm ON tax_invoices USING gin (invoice_number gin_trgm_ops);

-- Add composite index for status filtering
CREATE INDEX IF NOT EXISTS idx_tax_invoices_status ON tax_invoices(status) WHERE deleted_at IS NULL;

-- Add index for date range queries
CREATE INDEX IF NOT EXISTS idx_tax_invoices_invoice_date ON tax_invoices(invoice_date) WHERE deleted_at IS NULL;