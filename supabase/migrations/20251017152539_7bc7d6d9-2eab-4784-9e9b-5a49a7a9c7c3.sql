-- Add tracking fields to bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS balance_payment_reminder_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS security_deposit_reminder_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS balance_payment_link_id TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS security_deposit_link_id TEXT;

-- Create security_deposit_authorizations table
CREATE TABLE IF NOT EXISTS security_deposit_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  authorization_id TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  status TEXT NOT NULL CHECK (status IN ('pending', 'authorized', 'captured', 'released', 'expired')),
  authorized_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  released_at TIMESTAMP WITH TIME ZONE,
  captured_at TIMESTAMP WITH TIME ZONE,
  captured_amount NUMERIC DEFAULT 0,
  capture_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies for security_deposit_authorizations
ALTER TABLE security_deposit_authorizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view deposit authorizations"
  ON security_deposit_authorizations FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Staff can manage deposit authorizations"
  ON security_deposit_authorizations FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_security_deposit_authorizations_updated_at
  BEFORE UPDATE ON security_deposit_authorizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update update_booking_on_payment trigger to call immediate reminders for last-minute bookings
CREATE OR REPLACE FUNCTION public.update_booking_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_booking RECORD;
  v_total_paid NUMERIC;
  v_required_down_payment NUMERIC;
BEGIN
  -- Only process if payment is marked as paid
  IF NEW.payment_link_status = 'paid'::payment_link_status OR (NEW.paid_at IS NOT NULL AND (OLD.paid_at IS NULL OR OLD IS NULL)) THEN
    
    -- Get booking details
    SELECT * INTO v_booking
    FROM bookings
    WHERE id = NEW.booking_id;
    
    -- Calculate total amount paid for this booking
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM payments
    WHERE booking_id = NEW.booking_id
      AND (payment_link_status = 'paid'::payment_link_status OR paid_at IS NOT NULL);
    
    -- Update booking amount_paid
    UPDATE bookings
    SET amount_paid = v_total_paid,
        updated_at = NOW()
    WHERE id = NEW.booking_id;
    
    -- Calculate required down payment
    IF v_booking.payment_amount_percent IS NOT NULL AND v_booking.payment_amount_percent > 0 THEN
      v_required_down_payment := (v_booking.amount_total * v_booking.payment_amount_percent) / 100;
    ELSE
      -- If no percentage specified, consider any payment as sufficient
      v_required_down_payment := 0.01;
    END IF;
    
    -- Auto-confirm booking if:
    -- 1. Currently in draft status
    -- 2. Down payment requirement is met
    IF v_booking.status = 'draft'::booking_status AND v_total_paid >= v_required_down_payment THEN
      UPDATE bookings
      SET status = 'confirmed'::booking_status,
          updated_at = NOW()
      WHERE id = NEW.booking_id;
      
      -- Update client invoice payment status to partial or paid
      UPDATE client_invoices
      SET payment_status = CASE 
        WHEN v_total_paid >= v_booking.amount_total THEN 'paid'
        ELSE 'partial'
      END,
      updated_at = NOW()
      WHERE booking_id = NEW.booking_id;
      
      -- Log the auto-confirmation
      INSERT INTO audit_logs (entity, entity_id, action, payload_snapshot)
      VALUES (
        'booking',
        NEW.booking_id,
        'auto_confirmed',
        jsonb_build_object(
          'triggered_by', 'payment',
          'payment_id', NEW.id,
          'amount_paid', v_total_paid,
          'required_down_payment', v_required_down_payment
        )
      );

      -- Check if delivery is within 48 hours - if so, trigger immediate reminders
      IF v_booking.delivery_datetime <= (NOW() + INTERVAL '48 hours') THEN
        PERFORM net.http_post(
          url := 'https://lbvaghmqwhsawvxyiemw.supabase.co/functions/v1/trigger-immediate-reminders',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('request.jwt.claims', true)::json->>'token'
          ),
          body := jsonb_build_object('booking_id', NEW.booking_id)
        );
      END IF;
    ELSIF v_booking.status = 'confirmed'::booking_status THEN
      -- Update client invoice payment status if already confirmed
      UPDATE client_invoices
      SET payment_status = CASE 
        WHEN v_total_paid >= v_booking.amount_total THEN 'paid'
        ELSE 'partial'
      END,
      updated_at = NOW()
      WHERE booking_id = NEW.booking_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule daily reminder check at 9:00 AM UTC
SELECT cron.schedule(
  'send-payment-reminders-daily',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://lbvaghmqwhsawvxyiemw.supabase.co/functions/v1/send-payment-reminders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxidmFnaG1xd2hzYXd2eHlpZW13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwNjE2OTQsImV4cCI6MjA3NTYzNzY5NH0.CegoWervPvc_AfO81cmP5cY0vdDPfIDGd0q2BWBy4Yk"}'::jsonb,
    body := '{"trigger": "cron"}'::jsonb
  ) as request_id;
  $$
);