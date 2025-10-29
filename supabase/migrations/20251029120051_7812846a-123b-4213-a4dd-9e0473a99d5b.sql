-- Update and consolidate "What to Bring" steps
-- First, let's update existing steps to be more consolidated

-- Update "Valid Driver's License" to become "Your Documents"
UPDATE delivery_process_steps
SET 
  title = 'Your Documents',
  description = 'Original driver''s license (held for at least 1 year)
Passport or national ID card',
  icon_name = 'FileText',
  sort_order = 1
WHERE step_type = 'what_to_bring' 
  AND title LIKE '%Driver%License%';

-- Update Credit Card step
UPDATE delivery_process_steps
SET 
  title = 'Credit Card',
  description = 'Credit card used for security deposit',
  icon_name = 'CreditCard',
  sort_order = 2
WHERE step_type = 'what_to_bring' 
  AND title LIKE '%Credit%Card%';

-- Delete other "what_to_bring" steps (Proof of Identity, Booking Confirmation)
DELETE FROM delivery_process_steps
WHERE step_type = 'what_to_bring' 
  AND title NOT LIKE '%Driver%License%'
  AND title NOT LIKE '%Credit%Card%'
  AND title NOT LIKE '%Documents%';

-- Update Delivery Checklist steps
-- Step 1: Check-in & Document Verification
UPDATE delivery_process_steps
SET 
  title = 'Check-in & Document Verification',
  description = 'Present your documents for verification',
  icon_name = 'ClipboardCheck',
  sort_order = 1
WHERE step_type = 'delivery_checklist' 
  AND (title LIKE '%Check-in%' OR title LIKE '%Document%Verification%');

-- Step 2: Car Condition Inspection
UPDATE delivery_process_steps
SET 
  title = 'Car Condition Inspection',
  description = 'Walk-around inspection with delivery driver',
  icon_name = 'Camera',
  sort_order = 2
WHERE step_type = 'delivery_checklist' 
  AND title LIKE '%Inspection%'
  AND title NOT LIKE '%Sign%';

-- Step 3: Insert NEW Vehicle Familiarization step
INSERT INTO delivery_process_steps (step_type, title, description, icon_name, sort_order, is_active)
SELECT 'delivery_checklist', 'Vehicle Familiarization', 'Learn about the vehicle controls, features, and safety equipment', 'Info', 3, true
WHERE NOT EXISTS (
  SELECT 1 FROM delivery_process_steps 
  WHERE step_type = 'delivery_checklist' AND title = 'Vehicle Familiarization'
);

-- Step 4: Sign Rental Contract
UPDATE delivery_process_steps
SET 
  title = 'Sign Rental Contract',
  description = 'Review and sign the rental agreement',
  icon_name = 'FileSignature',
  sort_order = 4
WHERE step_type = 'delivery_checklist' 
  AND title LIKE '%Sign%Contract%';

-- Step 5: Key Handover & Departure
UPDATE delivery_process_steps
SET 
  title = 'Key Handover & Departure',
  description = 'Receive keys and enjoy your rental!',
  icon_name = 'Key',
  sort_order = 5
WHERE step_type = 'delivery_checklist' 
  AND title LIKE '%Key%Handover%';

-- Delete Security Deposit Authorization step
DELETE FROM delivery_process_steps
WHERE step_type = 'delivery_checklist' 
  AND title LIKE '%Security%Deposit%';