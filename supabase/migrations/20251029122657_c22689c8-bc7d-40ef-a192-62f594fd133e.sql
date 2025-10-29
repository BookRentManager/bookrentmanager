-- Fix generate_booking_token function overloading conflict
-- Drop the old single-parameter version to resolve PGRST203 error

DROP FUNCTION IF EXISTS public.generate_booking_token(p_booking_id uuid);

-- Ensure the new version with optional expiry parameter exists
-- This is backward compatible since p_expires_in_days has a DEFAULT value
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