-- Add new document types to support front/back uploads and selfie with ID
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'id_card_front';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'id_card_back';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'drivers_license_front';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'drivers_license_back';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'selfie_with_id';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'proof_of_address';