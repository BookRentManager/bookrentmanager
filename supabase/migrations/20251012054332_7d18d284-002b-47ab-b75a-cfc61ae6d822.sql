-- Create function to get next booking reference number
CREATE OR REPLACE FUNCTION public.get_next_booking_reference()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number integer;
  next_ref text;
BEGIN
  -- Get the highest number from existing references starting with 'KR'
  SELECT COALESCE(
    MAX(
      CASE 
        WHEN reference_code ~ '^KR[0-9]+$' 
        THEN CAST(SUBSTRING(reference_code FROM 3) AS integer)
        ELSE 0
      END
    ), 
    8905  -- Start from 8905 so next will be 8906
  ) INTO next_number
  FROM public.bookings;
  
  -- Increment and format with leading zeros (6 digits)
  next_ref := 'KR' || LPAD((next_number + 1)::text, 6, '0');
  
  RETURN next_ref;
END;
$$;