CREATE OR REPLACE FUNCTION public.get_next_booking_reference(is_test BOOLEAN DEFAULT FALSE)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_number integer;
  next_ref text;
BEGIN
  IF is_test THEN
    -- Test mode: find max from test references (with 'test' suffix), minimum 9699
    SELECT GREATEST(
      COALESCE(
        MAX(
          CASE 
            WHEN reference_code ~ '^KR[0-9]+test$' 
            THEN CAST(REGEXP_REPLACE(reference_code, '[^0-9]', '', 'g') AS integer)
            ELSE 0
          END
        ), 0
      ),
      9699
    ) INTO next_number
    FROM public.bookings;
    
    next_ref := 'KR' || LPAD((next_number + 1)::text, 6, '0') || 'test';
  ELSE
    -- Production mode: find max from production references (no 'test' suffix), minimum 9499
    SELECT GREATEST(
      COALESCE(
        MAX(
          CASE 
            WHEN reference_code ~ '^KR[0-9]+$' AND reference_code !~ 'test'
            THEN CAST(REGEXP_REPLACE(reference_code, '[^0-9]', '', 'g') AS integer)
            ELSE 0
          END
        ), 0
      ),
      9499
    ) INTO next_number
    FROM public.bookings;
    
    next_ref := 'KR' || LPAD((next_number + 1)::text, 6, '0');
  END IF;
  
  RETURN next_ref;
END;
$$;