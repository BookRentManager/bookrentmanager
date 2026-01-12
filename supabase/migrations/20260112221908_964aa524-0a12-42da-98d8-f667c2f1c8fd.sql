-- Add SELECT policy for read_only users on fines
CREATE POLICY "Read-only users can view all fines"
ON public.fines
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'read_only') 
  AND get_user_view_scope(auth.uid()) = 'all'
  AND deleted_at IS NULL
);

-- Add SELECT policy for read_only users on supplier_invoices
CREATE POLICY "Read-only users can view all supplier invoices"
ON public.supplier_invoices
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'read_only') 
  AND get_user_view_scope(auth.uid()) = 'all'
  AND deleted_at IS NULL
);