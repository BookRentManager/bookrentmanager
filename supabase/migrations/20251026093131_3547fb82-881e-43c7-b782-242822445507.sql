-- Clear the HTML content for bank_transfer_instructions template
-- This will make it fall back to the hardcoded King Rent branded HTML
-- Using empty string since column has NOT NULL constraint
UPDATE email_templates 
SET html_content = '',
    updated_at = now()
WHERE template_type = 'bank_transfer_instructions' 
  AND id = 'e54189f3-4f44-46f3-8962-aac191857b51';