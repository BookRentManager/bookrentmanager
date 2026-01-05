-- Add fine_id column to payments table to link payments to specific fines
ALTER TABLE payments ADD COLUMN fine_id UUID REFERENCES fines(id);

-- Add index for faster lookups
CREATE INDEX idx_payments_fine_id ON payments(fine_id) WHERE fine_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN payments.fine_id IS 'Links this payment to a specific fine when payment_intent is fines';