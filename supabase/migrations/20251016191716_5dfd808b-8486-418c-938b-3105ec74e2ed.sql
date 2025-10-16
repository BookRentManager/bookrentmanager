-- Create trigger function to sync webapp messages to Telegram
CREATE OR REPLACE FUNCTION sync_to_telegram()
RETURNS TRIGGER AS $$
DECLARE
  v_function_url text;
  v_service_role_key text;
BEGIN
  -- Only sync webapp messages to Telegram (prevent loops)
  IF NEW.source = 'webapp' THEN
    -- Get the Supabase URL and service role key from environment
    v_function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/telegram-send';
    v_service_role_key := current_setting('app.settings.service_role_key', true);
    
    -- Call the telegram-send edge function asynchronously
    -- Using pg_net extension if available, otherwise use http extension
    PERFORM net.http_post(
      url := v_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
      ),
      body := jsonb_build_object(
        'message_id', NEW.id
      )
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert
    RAISE WARNING 'Error syncing to Telegram: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on chat_messages
DROP TRIGGER IF EXISTS on_chat_message_insert ON chat_messages;

CREATE TRIGGER on_chat_message_insert
AFTER INSERT ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION sync_to_telegram();