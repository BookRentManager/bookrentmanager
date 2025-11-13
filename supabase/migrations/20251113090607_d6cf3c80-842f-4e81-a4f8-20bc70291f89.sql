-- Add rental detail columns to tax_invoices table
ALTER TABLE tax_invoices
ADD COLUMN rental_description text,
ADD COLUMN delivery_location text,
ADD COLUMN collection_location text,
ADD COLUMN rental_start_date date,
ADD COLUMN rental_end_date date;