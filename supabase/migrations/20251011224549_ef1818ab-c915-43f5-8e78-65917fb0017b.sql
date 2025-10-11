-- Add description field to client_invoices table
ALTER TABLE public.client_invoices 
ADD COLUMN description TEXT;