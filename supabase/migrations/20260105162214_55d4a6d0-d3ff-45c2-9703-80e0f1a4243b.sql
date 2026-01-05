-- Add per-transaction manual payment configuration columns
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS manual_payment_for_downpayment boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS manual_payment_for_balance boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS manual_payment_for_security_deposit boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS manual_instructions_downpayment text,
ADD COLUMN IF NOT EXISTS manual_instructions_balance text,
ADD COLUMN IF NOT EXISTS manual_instructions_security_deposit text;