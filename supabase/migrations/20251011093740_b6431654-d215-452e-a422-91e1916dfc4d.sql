-- Fix financial data exposure by restricting access to admin and staff only

-- Drop existing permissive policies on financial tables
DROP POLICY IF EXISTS "Authenticated users can view expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated users can view payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated users can view fines" ON public.fines;
DROP POLICY IF EXISTS "Authenticated users can view invoices" ON public.supplier_invoices;

-- Create restrictive role-based SELECT policies
CREATE POLICY "Admin and staff can view expenses"
  ON public.expenses
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Admin and staff can view payments"
  ON public.payments
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Admin and staff can view fines"
  ON public.fines
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) AND deleted_at IS NULL);

CREATE POLICY "Admin and staff can view invoices"
  ON public.supplier_invoices
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) AND deleted_at IS NULL);