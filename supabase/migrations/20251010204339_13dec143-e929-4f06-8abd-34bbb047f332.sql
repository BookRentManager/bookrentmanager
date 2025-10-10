-- Make fine_number and amount nullable to allow document-only uploads
ALTER TABLE public.fines 
ALTER COLUMN fine_number DROP NOT NULL,
ALTER COLUMN car_plate DROP NOT NULL,
ALTER COLUMN amount DROP NOT NULL;