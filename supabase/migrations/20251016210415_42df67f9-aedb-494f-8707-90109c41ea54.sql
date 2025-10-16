-- Add Telegram user info columns to chat_messages table
ALTER TABLE public.chat_messages
ADD COLUMN telegram_user_id text,
ADD COLUMN telegram_username text;