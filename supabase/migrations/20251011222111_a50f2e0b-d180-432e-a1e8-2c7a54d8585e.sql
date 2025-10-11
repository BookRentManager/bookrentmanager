-- Add supplier_name to bookings table
ALTER TABLE public.bookings 
ADD COLUMN supplier_name TEXT;