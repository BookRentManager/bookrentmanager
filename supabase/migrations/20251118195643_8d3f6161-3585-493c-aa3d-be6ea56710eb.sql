CREATE OR REPLACE FUNCTION public.get_next_booking_reference()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  next_number integer;
  next_ref text;
BEGIN
  -- Get the highest number from existing references starting with 'KR'
  -- Extracts only the numeric portion from references like 'KR009335' or 'KR009335test'
  SELECT GREATEST(
    COALESCE(
      MAX(
        CASE 
          WHEN reference_code ~ '^KR[0-9]+' 
          THEN CAST(REGEXP_REPLACE(reference_code, '[^0-9]', '', 'g') AS integer)
          ELSE 0
        END
      ), 
      0
    ),
    9699  -- Ensure minimum is 9699, so next booking will be at least KR009700test
  ) INTO next_number
  FROM public.bookings;
  
  -- Increment and format with leading zeros (6 digits) + "test" suffix
  next_ref := 'KR' || LPAD((next_number + 1)::text, 6, '0') || 'test';
  
  RETURN next_ref;
END;
$function$;