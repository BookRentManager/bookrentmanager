-- Drop the old, incorrect trigger that includes security deposits in amount_paid
DROP TRIGGER IF EXISTS update_booking_amount_paid_trigger ON public.payments;

-- Drop the old, incorrect function
DROP FUNCTION IF EXISTS public.update_booking_amount_paid();

-- Recalculate amount_paid for all bookings, excluding security deposits
UPDATE public.bookings
SET amount_paid = (
  SELECT COALESCE(SUM(p.amount), 0)
  FROM public.payments p
  WHERE p.booking_id = bookings.id
    AND p.payment_link_status = 'paid'
    AND p.paid_at IS NOT NULL
    AND p.payment_intent IS DISTINCT FROM 'security_deposit'
);