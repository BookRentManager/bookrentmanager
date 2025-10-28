-- Create rental_policies table
CREATE TABLE rental_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_type TEXT NOT NULL CHECK (policy_type IN ('cancellation', 'insurance', 'faq')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE rental_policies ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view active rental policies"
  ON rental_policies FOR SELECT
  USING (is_active = true);

CREATE POLICY "Authenticated users can manage rental policies"
  ON rental_policies FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Insert default content
INSERT INTO rental_policies (policy_type, title, content, sort_order) VALUES
('cancellation', 'Cancellation Policy', 'Free cancellation up to 24 hours before pickup. Cancellations within 24 hours will incur a 50% charge of the total booking amount.', 1),
('insurance', 'Insurance Terms', 'Full coverage insurance included with €500 deductible. Coverage includes collision damage waiver, theft protection, and third-party liability. Driver must be 21+ years old.', 1),
('faq', 'What if I return the car late?', 'Late returns incur hourly charges. Please contact us immediately if you anticipate a delay. Charges: 1-2 hours late: €25/hour, 3+ hours late: Full daily rate applies.', 1),
('faq', 'What documents do I need at pickup?', 'Valid driver''s license, credit card in driver''s name, proof of identity (passport or ID card), and booking confirmation.', 2),
('faq', 'Can I add an additional driver?', 'Yes, additional drivers can be added for €15/day. They must meet the same age and license requirements and be present at pickup with their documents.', 3);

-- Create delivery_process_steps table
CREATE TABLE delivery_process_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_type TEXT NOT NULL CHECK (step_type IN ('what_to_bring', 'delivery_checklist')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon_name TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE delivery_process_steps ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view active delivery steps"
  ON delivery_process_steps FOR SELECT
  USING (is_active = true);

CREATE POLICY "Authenticated users can manage delivery steps"
  ON delivery_process_steps FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Insert default steps
INSERT INTO delivery_process_steps (step_type, title, description, icon_name, sort_order) VALUES
('what_to_bring', 'Valid Driver''s License', 'Original driver''s license (held for at least 1 year)', 'CreditCard', 1),
('what_to_bring', 'Credit Card', 'Credit card in the main driver''s name for security deposit', 'CreditCard', 2),
('what_to_bring', 'Proof of Identity', 'Passport or national ID card', 'IdCard', 3),
('what_to_bring', 'Booking Confirmation', 'This booking confirmation (digital or printed)', 'FileCheck', 4),
('delivery_checklist', 'Check-in & Document Verification', 'Present your documents for verification', 'ClipboardCheck', 1),
('delivery_checklist', 'Sign Rental Contract', 'Review and sign the rental agreement', 'FileSignature', 2),
('delivery_checklist', 'Car Condition Inspection', 'Walk-around inspection with delivery driver - photos will be taken', 'Camera', 3),
('delivery_checklist', 'Security Deposit Authorization', 'Credit card pre-authorization for security deposit', 'Shield', 4),
('delivery_checklist', 'Key Handover & Departure', 'Receive keys and enjoy your rental!', 'Key', 5);

-- Create extra_cost_approvals table
CREATE TABLE extra_cost_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_document_id UUID REFERENCES booking_documents(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_via_ip INET,
  approved_via_token TEXT,
  is_locked BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE extra_cost_approvals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can insert approvals with valid token"
  ON extra_cost_approvals FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view approvals"
  ON extra_cost_approvals FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Extend booking_access_tokens
ALTER TABLE booking_access_tokens 
ADD COLUMN IF NOT EXISTS permission_level TEXT DEFAULT 'client_view_only',
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add constraint for permission_level
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_access_tokens_permission_level_check'
  ) THEN
    ALTER TABLE booking_access_tokens 
    ADD CONSTRAINT booking_access_tokens_permission_level_check 
    CHECK (permission_level IN ('client_view_only', 'delivery_driver_edit', 'admin_full_access'));
  END IF;
END $$;

-- Add new document types (using DO block to handle if they already exist)
DO $$
BEGIN
  BEGIN
    ALTER TYPE document_type ADD VALUE 'rental_contract_delivery';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TYPE document_type ADD VALUE 'rental_contract_collection';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TYPE document_type ADD VALUE 'car_condition_delivery_photo';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TYPE document_type ADD VALUE 'car_condition_delivery_video';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TYPE document_type ADD VALUE 'car_condition_collection_photo';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TYPE document_type ADD VALUE 'car_condition_collection_video';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TYPE document_type ADD VALUE 'extra_cost_invoice';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TYPE document_type ADD VALUE 'damage_quote';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

-- Add booking timeline fields
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS delivery_contract_signed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS delivery_inspection_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rental_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS collection_contract_signed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS collection_inspection_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rental_completed_at TIMESTAMPTZ;

-- Create timeline auto-update trigger function
CREATE OR REPLACE FUNCTION update_booking_timeline()
RETURNS TRIGGER AS $$
BEGIN
  -- Delivery contract signed
  IF NEW.document_type = 'rental_contract_delivery' THEN
    UPDATE bookings 
    SET delivery_contract_signed_at = COALESCE(delivery_contract_signed_at, now()),
        rental_started_at = COALESCE(rental_started_at, now())
    WHERE id = NEW.booking_id;
  END IF;
  
  -- Delivery inspection completed (first delivery photo)
  IF NEW.document_type = 'car_condition_delivery_photo' THEN
    UPDATE bookings 
    SET delivery_inspection_completed_at = COALESCE(delivery_inspection_completed_at, now())
    WHERE id = NEW.booking_id;
  END IF;
  
  -- Collection contract signed
  IF NEW.document_type = 'rental_contract_collection' THEN
    UPDATE bookings 
    SET collection_contract_signed_at = COALESCE(collection_contract_signed_at, now())
    WHERE id = NEW.booking_id;
  END IF;
  
  -- Collection inspection completed
  IF NEW.document_type = 'car_condition_collection_photo' THEN
    UPDATE bookings 
    SET collection_inspection_completed_at = COALESCE(collection_inspection_completed_at, now()),
        rental_completed_at = COALESCE(rental_completed_at, now())
    WHERE id = NEW.booking_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_rental_document_upload ON booking_documents;
CREATE TRIGGER on_rental_document_upload
  AFTER INSERT ON booking_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_booking_timeline();