-- Part 1: Rename payment_method enum from 'stripe' to 'card'
-- This requires recreating the enum type completely

-- Step 1: Create a temporary column with the new enum type
CREATE TYPE payment_method_new AS ENUM ('card', 'wire', 'pos', 'other');

-- Step 2: Add temporary column
ALTER TABLE payments ADD COLUMN method_new payment_method_new;

-- Step 3: Migrate data - map 'stripe' to 'card', keep others as-is
UPDATE payments 
SET method_new = CASE 
  WHEN method = 'stripe' THEN 'card'::payment_method_new
  ELSE method::text::payment_method_new
END;

-- Step 4: Drop old column and rename new one
ALTER TABLE payments DROP COLUMN method;
ALTER TABLE payments RENAME COLUMN method_new TO method;

-- Step 5: Make the column NOT NULL again
ALTER TABLE payments ALTER COLUMN method SET NOT NULL;

-- Step 6: Drop old enum type and rename new one
DROP TYPE payment_method;
ALTER TYPE payment_method_new RENAME TO payment_method;