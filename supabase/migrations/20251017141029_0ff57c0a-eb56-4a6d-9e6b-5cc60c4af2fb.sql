-- =============================================
-- PHASE 2: DATABASE SCHEMA UPDATES
-- =============================================

-- STEP 1: Create New Tables
-- =============================================

-- 1.1 Payment Methods Configuration Table
CREATE TABLE payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  method_type text NOT NULL CHECK (method_type IN ('visa_mastercard', 'amex', 'bank_transfer', 'manual')),
  display_name text NOT NULL,
  description text,
  fee_percentage numeric NOT NULL DEFAULT 0 CHECK (fee_percentage >= 0 AND fee_percentage <= 100),
  currency text NOT NULL CHECK (currency IN ('EUR', 'CHF')),
  requires_conversion boolean NOT NULL DEFAULT false,
  is_enabled boolean NOT NULL DEFAULT true,
  admin_only boolean NOT NULL DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(method_type)
);

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view enabled payment methods"
  ON payment_methods FOR SELECT
  USING (is_enabled = true);

CREATE POLICY "Staff can manage payment methods"
  ON payment_methods FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE TRIGGER update_payment_methods_updated_at
  BEFORE UPDATE ON payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE payment_methods IS 'Configuration for available payment methods with fee structures';

-- 1.2 Booking Access Tokens Table
CREATE TABLE booking_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  accessed_at timestamptz,
  access_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT token_length CHECK (length(token) >= 32)
);

CREATE INDEX idx_booking_tokens_token ON booking_access_tokens(token);
CREATE INDEX idx_booking_tokens_booking_id ON booking_access_tokens(booking_id);
CREATE INDEX idx_booking_tokens_expires_at ON booking_access_tokens(expires_at);

ALTER TABLE booking_access_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can access by valid token"
  ON booking_access_tokens FOR SELECT
  USING (expires_at > now());

CREATE POLICY "Staff can manage booking tokens"
  ON booking_access_tokens FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

COMMENT ON TABLE booking_access_tokens IS 'Secure tokens for public booking form access without authentication';

-- 1.3 Currency Conversion Rates Table
CREATE TABLE currency_conversion_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency text NOT NULL CHECK (from_currency IN ('EUR', 'CHF', 'USD', 'GBP')),
  to_currency text NOT NULL CHECK (to_currency IN ('EUR', 'CHF', 'USD', 'GBP')),
  rate numeric NOT NULL CHECK (rate > 0),
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  source text DEFAULT 'manual' CHECK (source IN ('manual', 'api', 'system')),
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT different_currencies CHECK (from_currency != to_currency),
  CONSTRAINT unique_rate_per_date UNIQUE(from_currency, to_currency, effective_date)
);

CREATE INDEX idx_conversion_rates_currencies ON currency_conversion_rates(from_currency, to_currency);
CREATE INDEX idx_conversion_rates_date ON currency_conversion_rates(effective_date DESC);

ALTER TABLE currency_conversion_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view conversion rates"
  ON currency_conversion_rates FOR SELECT
  USING (true);

CREATE POLICY "Staff can manage conversion rates"
  ON currency_conversion_rates FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Staff can update conversion rates"
  ON currency_conversion_rates FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

COMMENT ON TABLE currency_conversion_rates IS 'Historical conversion rates. Latest rate for each currency pair should be used for new payments.';

-- 1.4 Terms and Conditions Versions Table
CREATE TABLE terms_and_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  content text NOT NULL,
  effective_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tc_active ON terms_and_conditions(is_active) WHERE is_active = true;
CREATE INDEX idx_tc_effective_date ON terms_and_conditions(effective_date DESC);

ALTER TABLE terms_and_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active terms"
  ON terms_and_conditions FOR SELECT
  USING (is_active = true);

CREATE POLICY "Staff can manage terms and conditions"
  ON terms_and_conditions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE TRIGGER update_tc_updated_at
  BEFORE UPDATE ON terms_and_conditions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE terms_and_conditions IS 'Versioned terms and conditions. Only one version can be active at a time.';

-- Ensure only one active T&C at a time
CREATE FUNCTION ensure_single_active_tc() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE terms_and_conditions SET is_active = false WHERE id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER ensure_single_active_tc_trigger
  AFTER INSERT OR UPDATE ON terms_and_conditions
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION ensure_single_active_tc();

-- STEP 2: Alter Existing Tables (ONLY ADD COLUMNS)
-- =============================================

-- 2.1 Update Bookings Table
ALTER TABLE bookings ADD COLUMN available_payment_methods jsonb DEFAULT '["visa_mastercard","amex","bank_transfer"]'::jsonb;
ALTER TABLE bookings ADD COLUMN manual_payment_instructions text;
ALTER TABLE bookings ADD COLUMN tc_accepted_at timestamptz;
ALTER TABLE bookings ADD COLUMN tc_signature_data text;
ALTER TABLE bookings ADD COLUMN tc_accepted_ip inet;
ALTER TABLE bookings ADD COLUMN tc_version_id uuid REFERENCES terms_and_conditions(id);
ALTER TABLE bookings ADD COLUMN booking_form_sent_at timestamptz;
ALTER TABLE bookings ADD COLUMN booking_form_last_accessed_at timestamptz;

COMMENT ON COLUMN bookings.available_payment_methods IS 'Array of payment method types enabled for this booking';
COMMENT ON COLUMN bookings.manual_payment_instructions IS 'Custom instructions when manual payment method is enabled (cash/crypto)';
COMMENT ON COLUMN bookings.tc_signature_data IS 'Base64 encoded PNG of digital signature';
COMMENT ON COLUMN bookings.tc_accepted_ip IS 'IP address from which T&C was accepted';

-- 2.2 Update Payments Table
ALTER TABLE payments ADD COLUMN payment_method_type text CHECK (payment_method_type IN ('visa_mastercard', 'amex', 'bank_transfer', 'manual'));
ALTER TABLE payments ADD COLUMN original_amount numeric CHECK (original_amount >= 0);
ALTER TABLE payments ADD COLUMN fee_amount numeric DEFAULT 0 CHECK (fee_amount >= 0);
ALTER TABLE payments ADD COLUMN fee_percentage numeric CHECK (fee_percentage >= 0 AND fee_percentage <= 100);
ALTER TABLE payments ADD COLUMN total_amount numeric CHECK (total_amount >= 0);
ALTER TABLE payments ADD COLUMN original_currency text DEFAULT 'EUR' CHECK (original_currency IN ('EUR', 'CHF', 'USD', 'GBP'));
ALTER TABLE payments ADD COLUMN converted_amount numeric CHECK (converted_amount >= 0);
ALTER TABLE payments ADD COLUMN conversion_rate_used numeric CHECK (conversion_rate_used > 0);
ALTER TABLE payments ADD COLUMN receipt_url text;
ALTER TABLE payments ADD COLUMN receipt_sent_at timestamptz;
ALTER TABLE payments ADD COLUMN confirmation_email_sent_at timestamptz;

COMMENT ON COLUMN payments.original_amount IS 'Amount before fees';
COMMENT ON COLUMN payments.fee_amount IS 'Calculated fee based on payment method';
COMMENT ON COLUMN payments.total_amount IS 'Final amount charged (original + fee)';
COMMENT ON COLUMN payments.converted_amount IS 'Amount in target currency after conversion (e.g., EUR to CHF for AMEX)';
COMMENT ON COLUMN payments.conversion_rate_used IS 'Exchange rate applied at time of payment';

-- STEP 3: Insert Default Data
-- =============================================

-- 3.1 Default Payment Methods
INSERT INTO payment_methods (method_type, display_name, description, fee_percentage, currency, requires_conversion, sort_order, is_enabled, admin_only) VALUES
('visa_mastercard', 'Visa / Mastercard', 'Credit or debit card payment processed in EUR', 2.0, 'EUR', false, 1, true, false),
('amex', 'American Express', 'Credit card payment processed in CHF (converted from EUR)', 3.5, 'CHF', true, 2, true, false),
('bank_transfer', 'Bank Transfer', 'Direct bank transfer - no additional fees', 0, 'EUR', false, 3, true, false),
('manual', 'Cash / Crypto', 'Other payment methods (cash, cryptocurrency, etc.)', 0, 'EUR', false, 4, false, true);

-- 3.2 Initial EUR to CHF Conversion Rate
INSERT INTO currency_conversion_rates (from_currency, to_currency, rate, effective_date, source) VALUES
('EUR', 'CHF', 0.95, CURRENT_DATE, 'manual');

-- 3.3 Default Terms & Conditions
INSERT INTO terms_and_conditions (version, content, effective_date, is_active) VALUES
('1.0', 
'# Terms and Conditions

## Rental Agreement

Car rental terms and conditions.

### 1. Rental Period
The vehicle must be returned at the agreed date and time.

### 2. Payment Terms
- Down payment: As specified in booking confirmation
- Full payment: Due before vehicle collection
- Security deposit: Refundable upon vehicle return

### 3. Cancellation Policy
Cancellation terms apply as per the rental agreement.

### 4. Insurance and Liability
The renter is responsible for the vehicle during the rental period.

### 5. Vehicle Condition
The renter accepts responsibility for the vehicle condition.

---

**By signing below, you confirm that you have read, understood, and agree to these terms and conditions.**',
CURRENT_DATE,
true);

-- STEP 4: Create Helper Functions
-- =============================================

-- 4.1 Get Latest Conversion Rate Function
CREATE OR REPLACE FUNCTION get_latest_conversion_rate(
  p_from_currency text,
  p_to_currency text
) RETURNS numeric AS $$
DECLARE
  v_rate numeric;
BEGIN
  SELECT rate INTO v_rate
  FROM currency_conversion_rates
  WHERE from_currency = p_from_currency
    AND to_currency = p_to_currency
  ORDER BY effective_date DESC, created_at DESC
  LIMIT 1;
  
  IF v_rate IS NULL THEN
    RAISE EXCEPTION 'No conversion rate found for % to %', p_from_currency, p_to_currency;
  END IF;
  
  RETURN v_rate;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- 4.2 Generate Secure Token Function
CREATE OR REPLACE FUNCTION generate_booking_token(p_booking_id uuid) 
RETURNS text AS $$
DECLARE
  v_token text;
  v_exists boolean;
BEGIN
  LOOP
    -- Generate cryptographically secure random token (32 chars)
    v_token := encode(gen_random_bytes(24), 'base64');
    v_token := replace(replace(replace(v_token, '/', '_'), '+', '-'), '=', '');
    
    -- Check if token already exists
    SELECT EXISTS(SELECT 1 FROM booking_access_tokens WHERE token = v_token) INTO v_exists;
    
    EXIT WHEN NOT v_exists;
  END LOOP;
  
  -- Insert token with 30-day expiry
  INSERT INTO booking_access_tokens (booking_id, token, expires_at)
  VALUES (p_booking_id, v_token, now() + interval '30 days')
  RETURNING token INTO v_token;
  
  RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4.3 Track Token Access Function
CREATE OR REPLACE FUNCTION track_token_access(p_token text)
RETURNS void AS $$
BEGIN
  UPDATE booking_access_tokens
  SET accessed_at = now(),
      access_count = access_count + 1
  WHERE token = p_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- STEP 5: Create Indexes for Performance
-- =============================================

CREATE INDEX idx_bookings_tc_accepted ON bookings(tc_accepted_at) WHERE tc_accepted_at IS NOT NULL;
CREATE INDEX idx_bookings_form_sent ON bookings(booking_form_sent_at) WHERE booking_form_sent_at IS NOT NULL;
CREATE INDEX idx_payments_method_type ON payments(payment_method_type) WHERE payment_method_type IS NOT NULL;
CREATE INDEX idx_payments_receipt ON payments(receipt_url) WHERE receipt_url IS NOT NULL;
CREATE INDEX idx_payments_total_amount ON payments(total_amount);

-- STEP 6: Data Migration for Existing Records
-- =============================================

UPDATE bookings 
SET available_payment_methods = '["visa_mastercard","amex","bank_transfer"]'::jsonb
WHERE available_payment_methods IS NULL;

UPDATE payments
SET 
  original_amount = amount,
  total_amount = amount,
  fee_amount = 0,
  fee_percentage = 0,
  original_currency = currency
WHERE original_amount IS NULL;