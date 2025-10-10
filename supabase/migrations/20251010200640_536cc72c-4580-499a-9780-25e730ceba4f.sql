-- Create custom types
CREATE TYPE public.booking_status AS ENUM ('confirmed', 'to_be_confirmed', 'cancelled');
CREATE TYPE public.financial_status AS ENUM ('loss', 'breakeven', 'profit');
CREATE TYPE public.payment_status AS ENUM ('unpaid', 'partial', 'paid');
CREATE TYPE public.payment_type AS ENUM ('deposit', 'balance', 'full');
CREATE TYPE public.payment_method AS ENUM ('stripe', 'wire', 'pos', 'other');
CREATE TYPE public.fine_payment_status AS ENUM ('unpaid', 'paid');
CREATE TYPE public.invoice_payment_status AS ENUM ('to_pay', 'paid');
CREATE TYPE public.expense_category AS ENUM ('transfer', 'fuel', 'cleaning', 'tyres', 'parking', 'other');
CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'read_only');
CREATE TYPE public.audit_action AS ENUM ('create', 'update', 'delete', 'status_change', 'pay', 'upload');
CREATE TYPE public.audit_entity AS ENUM ('booking', 'fine', 'supplier_invoice', 'payment', 'expense');

-- User roles table (security best practice)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Bookings table
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code TEXT NOT NULL UNIQUE,
  
  -- Client info
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  billing_address TEXT,
  
  -- Vehicle
  car_model TEXT NOT NULL,
  car_plate TEXT NOT NULL,
  
  -- Parameters
  km_included INTEGER,
  extra_km_cost NUMERIC(14,2),
  security_deposit_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  
  -- Delivery & Collection
  delivery_location TEXT NOT NULL,
  delivery_datetime TIMESTAMPTZ NOT NULL,
  delivery_info TEXT,
  collection_location TEXT NOT NULL,
  collection_datetime TIMESTAMPTZ NOT NULL,
  collection_info TEXT,
  
  -- Status
  status booking_status NOT NULL DEFAULT 'to_be_confirmed',
  
  -- Finance
  rental_price_gross NUMERIC(14,2) NOT NULL,
  supplier_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  other_costs_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  
  -- Payment tracking
  amount_total NUMERIC(14,2) NOT NULL,
  amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_bookings_car_plate ON public.bookings(car_plate);
CREATE INDEX idx_bookings_delivery_datetime ON public.bookings(delivery_datetime);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_bookings_reference_code ON public.bookings(reference_code);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  type payment_type NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  method payment_method NOT NULL,
  proof_url TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_booking_id ON public.payments(booking_id);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Fines table
CREATE TABLE public.fines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  car_plate TEXT NOT NULL,
  fine_number TEXT NOT NULL,
  issue_date DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  payment_status fine_payment_status NOT NULL DEFAULT 'unpaid',
  document_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_fines_car_plate ON public.fines(car_plate);
CREATE INDEX idx_fines_payment_status ON public.fines(payment_status);
CREATE INDEX idx_fines_issue_date ON public.fines(issue_date);

ALTER TABLE public.fines ENABLE ROW LEVEL SECURITY;

-- Supplier invoices table
CREATE TABLE public.supplier_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  car_plate TEXT,
  supplier_name TEXT NOT NULL,
  issue_date DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  payment_status invoice_payment_status NOT NULL DEFAULT 'to_pay',
  invoice_url TEXT,
  payment_proof_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_supplier_invoices_booking_id ON public.supplier_invoices(booking_id);
CREATE INDEX idx_supplier_invoices_payment_status ON public.supplier_invoices(payment_status);
CREATE INDEX idx_supplier_invoices_supplier_name ON public.supplier_invoices(supplier_name);

ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;

-- Expenses table
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  category expense_category NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_expenses_booking_id ON public.expenses(booking_id);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Audit logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  entity audit_entity NOT NULL,
  entity_id UUID NOT NULL,
  action audit_action NOT NULL,
  payload_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity, entity_id);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fines_updated_at BEFORE UPDATE ON public.fines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_supplier_invoices_updated_at BEFORE UPDATE ON public.supplier_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update booking amount_paid from payments
CREATE OR REPLACE FUNCTION public.update_booking_amount_paid()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.bookings
  SET amount_paid = (
    SELECT COALESCE(SUM(amount), 0)
    FROM public.payments
    WHERE booking_id = COALESCE(NEW.booking_id, OLD.booking_id)
  )
  WHERE id = COALESCE(NEW.booking_id, OLD.booking_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger to update amount_paid when payments change
CREATE TRIGGER update_booking_amount_paid_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_booking_amount_paid();

-- Create view for booking financials with calculated fields
CREATE OR REPLACE VIEW public.booking_financials AS
SELECT 
  b.id,
  b.reference_code,
  b.rental_price_gross,
  b.vat_rate,
  b.rental_price_gross / (1 + b.vat_rate / 100) AS rental_price_net,
  b.supplier_price,
  COALESCE((SELECT SUM(amount) FROM public.expenses WHERE booking_id = b.id), 0) AS expenses_total,
  b.rental_price_gross / (1 + b.vat_rate / 100) - b.supplier_price - COALESCE((SELECT SUM(amount) FROM public.expenses WHERE booking_id = b.id), 0) AS commission_net,
  CASE
    WHEN (b.rental_price_gross / (1 + b.vat_rate / 100) - b.supplier_price - COALESCE((SELECT SUM(amount) FROM public.expenses WHERE booking_id = b.id), 0)) < 0 THEN 'loss'::financial_status
    WHEN (b.rental_price_gross / (1 + b.vat_rate / 100) - b.supplier_price - COALESCE((SELECT SUM(amount) FROM public.expenses WHERE booking_id = b.id), 0)) = 0 THEN 'breakeven'::financial_status
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

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for bookings
CREATE POLICY "Authenticated users can view bookings"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "Staff can create bookings"
  ON public.bookings FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'staff')
  );

CREATE POLICY "Staff can update bookings"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'staff')
  );

CREATE POLICY "Admins can delete bookings"
  ON public.bookings FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for payments
CREATE POLICY "Authenticated users can view payments"
  ON public.payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can manage payments"
  ON public.payments FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'staff')
  );

-- RLS Policies for fines
CREATE POLICY "Authenticated users can view fines"
  ON public.fines FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "Staff can manage fines"
  ON public.fines FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'staff')
  );

-- RLS Policies for supplier_invoices
CREATE POLICY "Authenticated users can view invoices"
  ON public.supplier_invoices FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "Staff can manage invoices"
  ON public.supplier_invoices FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'staff')
  );

-- RLS Policies for expenses
CREATE POLICY "Authenticated users can view expenses"
  ON public.expenses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can manage expenses"
  ON public.expenses FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'staff')
  );

-- RLS Policies for audit_logs
CREATE POLICY "Authenticated users can view audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);