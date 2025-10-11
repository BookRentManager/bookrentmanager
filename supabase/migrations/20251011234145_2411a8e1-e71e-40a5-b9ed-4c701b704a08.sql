-- Auto-assign admin role to new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Add created_by tracking to bookings, fines, and invoices
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
ALTER TABLE public.fines ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
ALTER TABLE public.supplier_invoices ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
ALTER TABLE public.client_invoices ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Add user profiles table to store view preferences
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  view_scope text NOT NULL DEFAULT 'all' CHECK (view_scope IN ('all', 'own')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update all profiles"
  ON public.profiles FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (true);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, view_scope)
  VALUES (NEW.id, NEW.email, 'all');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_profile_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profile();

-- Update RLS policies to respect view_scope
DROP POLICY IF EXISTS "Admin and staff can view bookings" ON public.bookings;
CREATE POLICY "Admin and staff can view bookings"
  ON public.bookings FOR SELECT
  USING (
    has_role(auth.uid(), 'admin') AND (
      (SELECT view_scope FROM public.profiles WHERE id = auth.uid()) = 'all'
      OR created_by = auth.uid()
      OR created_by IS NULL
    )
  );

DROP POLICY IF EXISTS "Admin and staff can view fines" ON public.fines;
CREATE POLICY "Admin and staff can view fines"
  ON public.fines FOR SELECT
  USING (
    has_role(auth.uid(), 'admin') AND (
      (SELECT view_scope FROM public.profiles WHERE id = auth.uid()) = 'all'
      OR created_by = auth.uid()
      OR created_by IS NULL
    ) AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "Admin and staff can view invoices" ON public.supplier_invoices;
CREATE POLICY "Admin and staff can view invoices"
  ON public.supplier_invoices FOR SELECT
  USING (
    has_role(auth.uid(), 'admin') AND (
      (SELECT view_scope FROM public.profiles WHERE id = auth.uid()) = 'all'
      OR created_by = auth.uid()
      OR created_by IS NULL
    ) AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "Admin and staff can view client invoices" ON public.client_invoices;
CREATE POLICY "Admin and staff can view client invoices"
  ON public.client_invoices FOR SELECT
  USING (
    has_role(auth.uid(), 'admin') AND (
      (SELECT view_scope FROM public.profiles WHERE id = auth.uid()) = 'all'
      OR created_by = auth.uid()
      OR created_by IS NULL
    ) AND deleted_at IS NULL
  );