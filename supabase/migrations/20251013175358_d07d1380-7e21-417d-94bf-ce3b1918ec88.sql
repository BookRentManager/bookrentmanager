-- Add new columns to bookings table for complete email data capture
ALTER TABLE bookings 
  ADD COLUMN IF NOT EXISTS booking_date DATE,
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS additional_services JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS payment_amount_percent INTEGER,
  ADD COLUMN IF NOT EXISTS total_rental_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS imported_from_email BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_import_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_email_update TIMESTAMPTZ;

-- Create index for faster queries on imported bookings
CREATE INDEX IF NOT EXISTS idx_bookings_imported ON bookings(imported_from_email) WHERE imported_from_email = true;

-- Create import logs table for monitoring
CREATE TABLE IF NOT EXISTS email_import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id TEXT NOT NULL,
  email_subject TEXT,
  booking_reference TEXT,
  action TEXT NOT NULL,
  changes_detected TEXT[],
  error_message TEXT,
  raw_email_snippet TEXT,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for recent logs queries
CREATE INDEX IF NOT EXISTS idx_email_import_logs_recent ON email_import_logs(processed_at DESC);

-- Enable RLS on email_import_logs
ALTER TABLE email_import_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read import logs
CREATE POLICY "Users can view email import logs"
  ON email_import_logs
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Allow service role to insert logs
CREATE POLICY "Service role can insert email import logs"
  ON email_import_logs
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');