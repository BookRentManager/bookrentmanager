-- Fix telegram_config created_by field
UPDATE telegram_config
SET created_by = 'ab58e00f-9d0b-4a4c-a818-0908ae1c15b8',
    updated_at = now()
WHERE telegram_chat_id = '-4910989571';

-- Drop the old sync_to_telegram trigger and function with CASCADE
DROP TRIGGER IF EXISTS on_chat_message_insert ON chat_messages;
DROP FUNCTION IF EXISTS sync_to_telegram() CASCADE;