-- Phase 1: Delete all bookings (cascades to payments, client_invoices, expenses, booking_documents, booking_access_tokens, security_deposit_authorizations)
DELETE FROM public.bookings;

-- Phase 2: Clean up orphaned records
DELETE FROM public.supplier_invoices WHERE booking_id IS NULL;
DELETE FROM public.fines WHERE booking_id IS NULL;
DELETE FROM public.chat_messages 
WHERE entity_type = 'booking' 
  AND entity_id NOT IN (SELECT id FROM public.bookings);

-- Phase 3: Update reference generator to add "test" suffix
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
  SELECT COALESCE(
    MAX(
      CASE 
        WHEN reference_code ~ '^KR[0-9]+' 
        THEN CAST(REGEXP_REPLACE(reference_code, '[^0-9]', '', 'g') AS integer)
        ELSE 0
      END
    ), 
    9335  -- Continue from last known reference (ensures KR009336test is next)
  ) INTO next_number
  FROM public.bookings;
  
  -- Increment and format with leading zeros (6 digits) + "test" suffix
  next_ref := 'KR' || LPAD((next_number + 1)::text, 6, '0') || 'test';
  
  RETURN next_ref;
END;
$function$;