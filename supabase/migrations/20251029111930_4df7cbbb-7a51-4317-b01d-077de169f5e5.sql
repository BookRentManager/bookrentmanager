-- Update generate_booking_token to support optional expiry (null = no expiry)
CREATE OR REPLACE FUNCTION public.generate_booking_token(
  p_booking_id uuid,
  p_expires_in_days integer DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_token text;
  v_exists boolean;
  v_expires_at timestamp with time zone;
BEGIN
  LOOP
    -- Generate cryptographically secure random token (32 chars)
    v_token := encode(gen_random_bytes(24), 'base64');
    v_token := replace(replace(replace(v_token, '/', '_'), '+', '-'), '=', '');
    
    -- Check if token already exists
    SELECT EXISTS(SELECT 1 FROM booking_access_tokens WHERE token = v_token) INTO v_exists;
    
    EXIT WHEN NOT v_exists;
  END LOOP;
  
  -- Set expiry: null for no expiry, otherwise specified days from now
  IF p_expires_in_days IS NULL THEN
    v_expires_at := NULL;
  ELSE
    v_expires_at := now() + (p_expires_in_days || ' days')::interval;
  END IF;
  
  -- Insert token
  INSERT INTO booking_access_tokens (booking_id, token, expires_at)
  VALUES (p_booking_id, v_token, v_expires_at)
  RETURNING token INTO v_token;
  
  RETURN v_token;
END;
$function$;

-- Update booking_access_tokens table to allow null expires_at
ALTER TABLE booking_access_tokens 
ALTER COLUMN expires_at DROP NOT NULL;

-- Update RLS policy to handle null expiry (null = never expires)
DROP POLICY IF EXISTS "Public can access by valid token" ON booking_access_tokens;

CREATE POLICY "Public can access by valid token"
ON booking_access_tokens
FOR SELECT
USING (expires_at IS NULL OR expires_at > now());