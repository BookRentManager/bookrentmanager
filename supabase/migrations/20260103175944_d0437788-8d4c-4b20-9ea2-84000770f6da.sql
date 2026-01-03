-- Create booking_type enum
CREATE TYPE booking_type AS ENUM ('direct', 'agency');

-- Add agency-specific fields to bookings table
ALTER TABLE bookings ADD COLUMN booking_type booking_type NOT NULL DEFAULT 'direct';
ALTER TABLE bookings ADD COLUMN agency_name TEXT;
ALTER TABLE bookings ADD COLUMN agency_email TEXT;
ALTER TABLE bookings ADD COLUMN agency_phone TEXT;

-- Add index for filtering by booking type
CREATE INDEX idx_bookings_booking_type ON bookings(booking_type);

-- Add comment for clarity
COMMENT ON COLUMN bookings.booking_type IS 'Type of booking: direct (client books with us) or agency (external agency booking)';
COMMENT ON COLUMN bookings.agency_name IS 'Name of the agency for agency bookings';
COMMENT ON COLUMN bookings.agency_email IS 'Contact email for the agency';
COMMENT ON COLUMN bookings.agency_phone IS 'Contact phone for the agency';