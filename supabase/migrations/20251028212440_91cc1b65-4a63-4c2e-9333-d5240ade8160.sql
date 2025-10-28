-- Add new document types for additional drivers
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'driver2_license_front';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'driver2_license_back';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'driver3_license_front';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'driver3_license_back';