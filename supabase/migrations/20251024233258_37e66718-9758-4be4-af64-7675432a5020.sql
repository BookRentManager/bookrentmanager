-- Add original_client_name column to track admin's initial client name entry
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS original_client_name text;

-- Backfill existing records - set original_client_name to current client_name for existing bookings
UPDATE bookings 
SET original_client_name = client_name 
WHERE original_client_name IS NULL;