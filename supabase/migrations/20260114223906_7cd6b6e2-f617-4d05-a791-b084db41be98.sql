-- Add 'notified' value to fine_payment_status enum
ALTER TYPE fine_payment_status ADD VALUE 'notified';

-- Add notification tracking columns to fines table
ALTER TABLE public.fines 
ADD COLUMN notified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN notification_notes TEXT;