-- Add bank account configuration to app_settings
ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS bank_account_holder TEXT DEFAULT 'KingRent Sàrl',
ADD COLUMN IF NOT EXISTS bank_account_iban TEXT DEFAULT 'CH00 0000 0000 0000 0000 0',
ADD COLUMN IF NOT EXISTS bank_account_bic TEXT DEFAULT 'XXXXCHZZXXX',
ADD COLUMN IF NOT EXISTS bank_account_bank_name TEXT DEFAULT 'PostFinance',
ADD COLUMN IF NOT EXISTS bank_transfer_instructions TEXT DEFAULT 'Please include the booking reference number in your transfer description. Payment processing may take 2-5 business days.';