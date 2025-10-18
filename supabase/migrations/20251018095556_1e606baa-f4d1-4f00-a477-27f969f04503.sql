-- Add guest information columns to bookings table
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS guest_name TEXT,
ADD COLUMN IF NOT EXISTS guest_phone TEXT,
ADD COLUMN IF NOT EXISTS guest_billing_address TEXT,
ADD COLUMN IF NOT EXISTS guest_country TEXT,
ADD COLUMN IF NOT EXISTS guest_company_name TEXT;

-- Add comments for documentation
COMMENT ON COLUMN bookings.guest_name IS 'Full name of guest (if booking on behalf of someone else)';
COMMENT ON COLUMN bookings.guest_phone IS 'Phone number of guest (optional)';
COMMENT ON COLUMN bookings.guest_billing_address IS 'Billing address of guest for fine redirection (optional)';
COMMENT ON COLUMN bookings.guest_country IS 'Country of residence of guest';
COMMENT ON COLUMN bookings.guest_company_name IS 'Company name of guest (optional)';