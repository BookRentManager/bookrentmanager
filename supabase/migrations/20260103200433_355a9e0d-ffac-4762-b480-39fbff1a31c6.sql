-- Drop the existing constraint
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_method_type_check;

-- Add updated constraint with cash and crypto options
ALTER TABLE payments ADD CONSTRAINT payments_payment_method_type_check 
  CHECK (payment_method_type = ANY (ARRAY['visa_mastercard', 'amex', 'bank_transfer', 'manual', 'cash', 'crypto']::text[]));