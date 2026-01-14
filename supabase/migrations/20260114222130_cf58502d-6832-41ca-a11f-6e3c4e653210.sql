-- Create enum for adjustment types
CREATE TYPE public.adjustment_type AS ENUM ('refund', 'voucher');

-- Create booking_adjustments table for tracking refunds and vouchers
CREATE TABLE public.booking_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  adjustment_type public.adjustment_type NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Enable Row Level Security
ALTER TABLE public.booking_adjustments ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view all adjustments"
ON public.booking_adjustments
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert adjustments"
ON public.booking_adjustments
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update adjustments"
ON public.booking_adjustments
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete adjustments"
ON public.booking_adjustments
FOR DELETE
TO authenticated
USING (true);

-- Add index for faster lookups by booking
CREATE INDEX idx_booking_adjustments_booking_id ON public.booking_adjustments(booking_id);

-- Add index for filtering by type
CREATE INDEX idx_booking_adjustments_type ON public.booking_adjustments(adjustment_type);

-- Add comment for documentation
COMMENT ON TABLE public.booking_adjustments IS 'Tracks refunds and voucher credits issued for bookings';