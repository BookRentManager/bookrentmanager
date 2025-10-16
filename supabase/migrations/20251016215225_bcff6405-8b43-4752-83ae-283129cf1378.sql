-- Add extra_deduction column to bookings table
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS extra_deduction numeric DEFAULT 0;

COMMENT ON COLUMN public.bookings.extra_deduction IS 'Additional deduction amount to be subtracted from profit calculations';