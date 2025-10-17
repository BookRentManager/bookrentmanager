-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a cron job to update EUR/CHF conversion rate daily at 2 AM UTC
SELECT cron.schedule(
  'daily-currency-rate-update',
  '0 2 * * *', -- 2 AM every day
  $$
  SELECT
    net.http_post(
      url := 'https://lbvaghmqwhsawvxyiemw.supabase.co/functions/v1/update-conversion-rate',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'fetch_from_api', true
      )
    ) as request_id;
  $$
);

-- View scheduled jobs
-- SELECT * FROM cron.job;