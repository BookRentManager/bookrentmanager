-- Add payment_amount_option column to bookings table
ALTER TABLE bookings 
ADD COLUMN payment_amount_option TEXT 
CHECK (payment_amount_option IN ('down_payment_only', 'full_payment_only', 'client_choice'));