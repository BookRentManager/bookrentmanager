-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create cron job to run Gmail booking import every 5 minutes
SELECT cron.schedule(
  'gmail-booking-import-every-5-min',
  '*/5 * * * *',  -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://lbvaghmqwhsawvxyiemw.supabase.co/functions/v1/gmail-booking-import',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxidmFnaG1xd2hzYXd2eHlpZW13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwNjE2OTQsImV4cCI6MjA3NTYzNzY5NH0.CegoWervPvc_AfO81cmP5cY0vdDPfIDGd0q2BWBy4Yk'
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);