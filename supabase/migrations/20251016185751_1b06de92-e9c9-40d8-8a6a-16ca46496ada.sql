-- Add 'general' to message_entity_type enum
ALTER TYPE message_entity_type ADD VALUE IF NOT EXISTS 'general';

-- Make entity_id nullable for general chat
ALTER TABLE chat_messages 
  ALTER COLUMN entity_id DROP NOT NULL;

-- Add Telegram integration fields to chat_messages
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS telegram_message_id text,
  ADD COLUMN IF NOT EXISTS telegram_chat_id text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'webapp' CHECK (source IN ('webapp', 'telegram'));

-- Create telegram_config table for admin configuration
CREATE TABLE IF NOT EXISTS telegram_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type message_entity_type NOT NULL,
  entity_id uuid,
  telegram_chat_id text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(entity_type, entity_id, telegram_chat_id)
);

-- Enable RLS on telegram_config
ALTER TABLE telegram_config ENABLE ROW LEVEL SECURITY;

-- Only admins can manage Telegram config
CREATE POLICY "Admins can manage telegram config"
  ON telegram_config
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_telegram_config_entity ON telegram_config(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_telegram ON chat_messages(telegram_chat_id, telegram_message_id) WHERE telegram_message_id IS NOT NULL;

-- Add trigger for telegram_config updated_at
CREATE TRIGGER update_telegram_config_updated_at
  BEFORE UPDATE ON telegram_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();