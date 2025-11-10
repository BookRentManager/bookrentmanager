-- Fix #1: Add search_path to security definer functions
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_booking_timeline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Delivery contract signed
  IF NEW.document_type = 'rental_contract_delivery' THEN
    UPDATE bookings 
    SET delivery_contract_signed_at = COALESCE(delivery_contract_signed_at, now()),
        rental_started_at = COALESCE(rental_started_at, now())
    WHERE id = NEW.booking_id;
  END IF;
  
  -- Delivery inspection completed (first delivery photo)
  IF NEW.document_type = 'car_condition_delivery_photo' THEN
    UPDATE bookings 
    SET delivery_inspection_completed_at = COALESCE(delivery_inspection_completed_at, now())
    WHERE id = NEW.booking_id;
  END IF;
  
  -- Collection contract signed
  IF NEW.document_type = 'rental_contract_collection' THEN
    UPDATE bookings 
    SET collection_contract_signed_at = COALESCE(collection_contract_signed_at, now())
    WHERE id = NEW.booking_id;
  END IF;
  
  -- Collection inspection completed
  IF NEW.document_type = 'car_condition_collection_photo' THEN
    UPDATE bookings 
    SET collection_inspection_completed_at = COALESCE(collection_inspection_completed_at, now()),
        rental_completed_at = COALESCE(rental_completed_at, now())
    WHERE id = NEW.booking_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_payment_before_paid()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  -- Prevent setting paid_at without a transaction ID (except for manual payments)
  IF NEW.paid_at IS NOT NULL 
     AND NEW.postfinance_transaction_id IS NULL 
     AND NEW.method != 'other' THEN
    RAISE EXCEPTION 'Cannot mark payment as paid without a PostFinance transaction ID';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Fix #5: Create whitelisted emails table for secure user registration
CREATE TABLE IF NOT EXISTS public.whitelisted_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  added_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  notes text
);

-- Enable RLS on whitelisted_emails
ALTER TABLE public.whitelisted_emails ENABLE ROW LEVEL SECURITY;

-- RLS Policies for whitelisted_emails
CREATE POLICY "Admins can manage whitelisted emails"
ON public.whitelisted_emails
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update handle_new_user function with email whitelist logic
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_role app_role;
  v_is_whitelisted boolean;
BEGIN
  -- Check if email is whitelisted (@kingrent.com domain OR in whitelist table)
  SELECT EXISTS (
    SELECT 1 FROM public.whitelisted_emails WHERE email = NEW.email
  ) OR (NEW.email LIKE '%@kingrent.com')
  INTO v_is_whitelisted;
  
  -- Assign role based on whitelist status
  IF v_is_whitelisted THEN
    v_role := 'staff';
  ELSE
    v_role := 'read_only';
  END IF;
  
  -- Insert user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role);
  
  RETURN NEW;
END;
$function$;