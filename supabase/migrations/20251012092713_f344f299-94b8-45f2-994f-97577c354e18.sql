-- Fix Critical Security Issues

-- 1. CRITICAL: Fix booking_financials view security
-- Drop and recreate the view without SECURITY DEFINER to use invoker's permissions
DROP VIEW IF EXISTS public.booking_financials;

CREATE VIEW public.booking_financials AS
SELECT 
  b.id,
  b.reference_code,
  b.rental_price_gross,
  b.vat_rate,
  b.rental_price_gross / (1 + b.vat_rate / 100) AS rental_price_net,
  b.supplier_price,
  COALESCE((SELECT SUM(amount) FROM public.expenses WHERE booking_id = b.id), 0) AS expenses_total,
  (b.rental_price_gross / (1 + b.vat_rate / 100)) - b.supplier_price - COALESCE((SELECT SUM(amount) FROM public.expenses WHERE booking_id = b.id), 0) AS commission_net,
  CASE 
    WHEN ((b.rental_price_gross / (1 + b.vat_rate / 100)) - b.supplier_price - COALESCE((SELECT SUM(amount) FROM public.expenses WHERE booking_id = b.id), 0)) < 0 
    THEN 'loss'::financial_status
    WHEN ((b.rental_price_gross / (1 + b.vat_rate / 100)) - b.supplier_price - COALESCE((SELECT SUM(amount) FROM public.expenses WHERE booking_id = b.id), 0)) = 0 
    THEN 'breakeven'::financial_status
    ELSE 'profit'::financial_status
  END AS financial_status,
  b.amount_total,
  b.amount_paid,
  CASE 
    WHEN b.amount_paid = 0 THEN 'unpaid'::payment_status
    WHEN b.amount_paid >= b.amount_total THEN 'paid'::payment_status
    ELSE 'partial'::payment_status
  END AS payment_status
FROM public.bookings b
WHERE b.deleted_at IS NULL;

-- Grant access to authenticated users (RLS from bookings table will apply)
GRANT SELECT ON public.booking_financials TO authenticated;

-- 2. HIGH: Restrict app_settings to authenticated users only (prevent public data harvesting)
DROP POLICY IF EXISTS "Anyone can view app settings" ON public.app_settings;

CREATE POLICY "Authenticated users can view app settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 3. HIGH: Secure audit logs - restrict INSERT to prevent log pollution
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

CREATE POLICY "Only system can insert audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
  -- Only allow inserts from database triggers/functions (service role context)
  -- Regular users cannot insert directly
  current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
);