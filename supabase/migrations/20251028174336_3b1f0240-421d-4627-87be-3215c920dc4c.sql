-- Add document_requirements JSONB column to store flexible document configuration
ALTER TABLE bookings 
ADD COLUMN document_requirements jsonb DEFAULT '{
  "drivers_license": {"enabled": true, "front_back": true},
  "id_passport": {"enabled": true, "front_back": true},
  "proof_of_address": {"enabled": false, "front_back": false},
  "selfie_with_id": {"enabled": false, "front_back": false},
  "upload_timing": "optional"
}'::jsonb;

COMMENT ON COLUMN bookings.document_requirements IS 'Configures which documents are available for upload and whether they are mandatory before submission. Structure: {document_type: {enabled: boolean, front_back: boolean}, upload_timing: "optional"|"mandatory"}';