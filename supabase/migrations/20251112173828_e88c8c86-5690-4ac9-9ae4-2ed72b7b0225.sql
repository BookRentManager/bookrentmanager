-- Add manual payment method to payment_methods table if not exists
INSERT INTO payment_methods (
  method_type, 
  display_name, 
  description, 
  currency, 
  fee_percentage, 
  is_enabled,
  admin_only
)
VALUES (
  'manual', 
  'Manual Payment', 
  'Accept cash, cryptocurrency, or other manual payment methods', 
  'EUR', 
  0, 
  true,
  true
)
ON CONFLICT (method_type) DO NOTHING;