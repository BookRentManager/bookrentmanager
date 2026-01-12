-- Add SELECT policy for read_only users on client_invoices
CREATE POLICY "Read-only users can view all client invoices"
ON public.client_invoices
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'read_only') 
  AND get_user_view_scope(auth.uid()) = 'all'
  AND deleted_at IS NULL
);

-- Add SELECT policy for read_only users on payments
CREATE POLICY "Read-only users can view all payments"
ON public.payments
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'read_only') 
  AND get_user_view_scope(auth.uid()) = 'all'
);