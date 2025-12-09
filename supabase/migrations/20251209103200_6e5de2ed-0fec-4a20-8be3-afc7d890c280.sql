-- Add balance_due_date column to bookings table
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS balance_due_date timestamp with time zone;

-- Add comment explaining the column
COMMENT ON COLUMN public.bookings.balance_due_date IS 'The date/time when the remaining balance is due. Used for sending reminder emails when down payment option is selected.';