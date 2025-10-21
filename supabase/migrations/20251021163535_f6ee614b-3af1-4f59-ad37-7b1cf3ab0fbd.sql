-- Add new document types for contract and extras
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'rental_contract';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'car_condition_photo';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'car_condition_video';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'extra_km_invoice';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'fuel_balance_invoice';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'damage_invoice';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'fine_document';

-- Add optional columns to booking_documents for extras tracking
ALTER TABLE booking_documents 
ADD COLUMN IF NOT EXISTS extra_cost_amount numeric,
ADD COLUMN IF NOT EXISTS extra_cost_notes text,
ADD COLUMN IF NOT EXISTS extra_cost_paid_at timestamptz;