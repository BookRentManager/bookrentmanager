-- Add payment_proof_url column to fines table if not exists
ALTER TABLE public.fines 
ADD COLUMN IF NOT EXISTS payment_proof_url TEXT;

-- Add display_name column for custom file names
ALTER TABLE public.fines 
ADD COLUMN IF NOT EXISTS display_name TEXT;