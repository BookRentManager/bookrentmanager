-- Fix RLS policy to only show own bookings (remove NULL check)
DROP POLICY IF EXISTS "Admin and staff can view bookings" ON public.bookings;
CREATE POLICY "Admin and staff can view bookings"
  ON public.bookings FOR SELECT
  USING (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff')) AND (
      (SELECT view_scope FROM public.profiles WHERE id = auth.uid()) = 'all'
      OR created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admin and staff can view fines" ON public.fines;
CREATE POLICY "Admin and staff can view fines"
  ON public.fines FOR SELECT
  USING (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff')) AND (
      (SELECT view_scope FROM public.profiles WHERE id = auth.uid()) = 'all'
      OR created_by = auth.uid()
    ) AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "Admin and staff can view invoices" ON public.supplier_invoices;
CREATE POLICY "Admin and staff can view invoices"
  ON public.supplier_invoices FOR SELECT
  USING (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff')) AND (
      (SELECT view_scope FROM public.profiles WHERE id = auth.uid()) = 'all'
      OR created_by = auth.uid()
    ) AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "Admin and staff can view client invoices" ON public.client_invoices;
CREATE POLICY "Admin and staff can view client invoices"
  ON public.client_invoices FOR SELECT
  USING (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff')) AND (
      (SELECT view_scope FROM public.profiles WHERE id = auth.uid()) = 'all'
      OR created_by = auth.uid()
    ) AND deleted_at IS NULL
  );