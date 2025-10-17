-- Update generate_booking_token function to include extensions schema in search path
CREATE OR REPLACE FUNCTION public.generate_booking_token(p_booking_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_token text;
  v_exists boolean;
BEGIN
  LOOP
    -- Generate cryptographically secure random token (32 chars)
    v_token := encode(gen_random_bytes(24), 'base64');
    v_token := replace(replace(replace(v_token, '/', '_'), '+', '-'), '=', '');
    
    -- Check if token already exists
    SELECT EXISTS(SELECT 1 FROM booking_access_tokens WHERE token = v_token) INTO v_exists;
    
    EXIT WHEN NOT v_exists;
  END LOOP;
  
  -- Insert token with 30-day expiry
  INSERT INTO booking_access_tokens (booking_id, token, expires_at)
  VALUES (p_booking_id, v_token, now() + interval '30 days')
  RETURNING token INTO v_token;
  
  RETURN v_token;
END;
$function$;