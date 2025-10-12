-- Create app_settings table for business configuration
CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL DEFAULT 'KingRent',
  company_email text,
  company_phone text,
  company_address text,
  default_currency text NOT NULL DEFAULT 'EUR',
  default_vat_rate numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage app settings
CREATE POLICY "Admins can manage app settings"
  ON public.app_settings
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Insert default settings
INSERT INTO public.app_settings (company_name, default_currency, default_vat_rate)
VALUES ('KingRent', 'EUR', 0)
ON CONFLICT DO NOTHING;

-- Add trigger for updated_at
CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();