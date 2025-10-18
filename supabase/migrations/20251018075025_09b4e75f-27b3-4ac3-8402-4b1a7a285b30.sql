-- Create booking-confirmations storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('booking-confirmations', 'booking-confirmations', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policy for authenticated users to view their own booking confirmations
CREATE POLICY "Users can view booking confirmations"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'booking-confirmations' 
  AND auth.uid() IS NOT NULL
);

-- RLS policy for service role to insert booking confirmations
CREATE POLICY "Service role can insert booking confirmations"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'booking-confirmations'
);

-- Add confirmation PDF URL to bookings table
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS confirmation_pdf_url TEXT;

-- Add timestamp for when confirmation PDF email was sent
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS booking_confirmation_pdf_sent_at TIMESTAMPTZ;

-- Add timestamp for confirmation email to payments table
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS confirmation_email_sent_at TIMESTAMPTZ;