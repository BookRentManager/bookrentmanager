-- Add calendar_token to profiles table for iCal feed authentication
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS calendar_token uuid DEFAULT gen_random_uuid() UNIQUE;

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_profiles_calendar_token ON public.profiles(calendar_token);

-- Backfill existing profiles with tokens
UPDATE public.profiles 
SET calendar_token = gen_random_uuid() 
WHERE calendar_token IS NULL;