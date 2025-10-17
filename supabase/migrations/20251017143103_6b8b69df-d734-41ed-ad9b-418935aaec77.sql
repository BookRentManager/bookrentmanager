-- Add booking form and security deposit tracking columns
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS booking_confirmation_pdf_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS security_deposit_authorized_at timestamptz,
ADD COLUMN IF NOT EXISTS security_deposit_authorization_id text;

COMMENT ON COLUMN bookings.booking_confirmation_pdf_sent_at 
IS 'When the signed PDF confirmation with T&C acceptance was emailed to client';

COMMENT ON COLUMN bookings.security_deposit_authorized_at 
IS 'When the security deposit was authorized (pre-auth before rental start)';

COMMENT ON COLUMN bookings.security_deposit_authorization_id 
IS 'Payment gateway authorization/transaction ID for security deposit hold';