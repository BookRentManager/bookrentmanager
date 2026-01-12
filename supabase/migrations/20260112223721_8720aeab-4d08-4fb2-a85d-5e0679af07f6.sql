-- Add SELECT policy for read_only users on currency_conversion_rates
CREATE POLICY "Read-only users can view all conversion rates"
ON public.currency_conversion_rates
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'read_only') 
  AND get_user_view_scope(auth.uid()) = 'all'
);

-- Add SELECT policy for read_only users on payment_methods
CREATE POLICY "Read-only users can view all payment methods"
ON public.payment_methods
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'read_only') 
  AND get_user_view_scope(auth.uid()) = 'all'
);

-- Add SELECT policy for read_only users on expenses
CREATE POLICY "Read-only users can view all expenses"
ON public.expenses
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'read_only') 
  AND get_user_view_scope(auth.uid()) = 'all'
);