-- Drop existing update policy
DROP POLICY IF EXISTS "Authenticated users can update agency invoices" ON public.agency_invoices;

-- Recreate with proper WITH CHECK clause
CREATE POLICY "Authenticated users can update agency invoices"
  ON public.agency_invoices
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);