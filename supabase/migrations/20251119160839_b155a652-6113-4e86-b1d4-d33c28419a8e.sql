-- Add webhook_listener_id column to track which listener sent each webhook
ALTER TABLE public.webhook_logs 
ADD COLUMN webhook_listener_id text;