-- Create enum for payment link status first
DO $$ BEGIN
  CREATE TYPE payment_link_status AS ENUM ('pending', 'active', 'expired', 'paid', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add payment link columns to payments table
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS payment_link_id TEXT,
ADD COLUMN IF NOT EXISTS payment_link_url TEXT,
ADD COLUMN IF NOT EXISTS payment_link_status payment_link_status DEFAULT 'pending'::payment_link_status,
ADD COLUMN IF NOT EXISTS payment_link_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS postfinance_transaction_id TEXT,
ADD COLUMN IF NOT EXISTS postfinance_session_id TEXT,
ADD COLUMN IF NOT EXISTS payment_intent TEXT DEFAULT 'client_payment';

-- Create trigger function to update booking on payment
CREATE OR REPLACE FUNCTION update_booking_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Create trigger on payments table
DROP TRIGGER IF EXISTS trigger_update_booking_on_payment ON payments;
CREATE TRIGGER trigger_update_booking_on_payment
AFTER INSERT OR UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION update_booking_on_payment();