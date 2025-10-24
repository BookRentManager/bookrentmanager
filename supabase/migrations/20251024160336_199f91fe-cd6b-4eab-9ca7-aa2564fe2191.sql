-- Create email templates table
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type TEXT NOT NULL UNIQUE,
  subject_line TEXT NOT NULL,
  html_content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create payment success messages table
CREATE TABLE IF NOT EXISTS public.payment_success_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_type TEXT NOT NULL UNIQUE,
  html_content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_success_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_templates
CREATE POLICY "Admins can manage email templates"
  ON public.email_templates FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can view email templates"
  ON public.email_templates FOR SELECT
  USING (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for payment_success_messages
CREATE POLICY "Admins can manage success messages"
  ON public.payment_success_messages FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active success messages"
  ON public.payment_success_messages FOR SELECT
  USING (is_active = true);

-- Insert default email templates
INSERT INTO public.email_templates (template_type, subject_line, html_content) VALUES
('booking_confirmation', 'Complete Your Booking Form - {{reference_code}}', '<!DOCTYPE html><html><head><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px}.header{background:linear-gradient(135deg,#1a1a1a 0%,#2d2d2d 100%);color:#d4af37;padding:30px;text-align:center;border-radius:10px 10px 0 0}.logo{max-width:150px;height:auto;margin-bottom:15px}.content{background:#fff;padding:30px;border:1px solid #e0e0e0;border-top:none}.cta-button{display:inline-block;padding:15px 30px;background:#d4af37;color:#1a1a1a;text-decoration:none;border-radius:5px;font-weight:bold;margin:20px 0}.footer{background:#f5f5f5;padding:20px;text-align:center;font-size:12px;color:#666;border-radius:0 0 10px 10px}.booking-details{background:#f9f9f9;padding:15px;border-left:4px solid #d4af37;margin:20px 0}</style></head><body><div class="header"><img src="https://lbvaghmqwhsawvxyiemw.supabase.co/storage/v1/object/public/company-logos/logo-1761150745897.jpg" alt="{{company_name}}" class="logo"><h1>Complete Your Booking</h1></div><div class="content"><p>Dear {{client_name}},</p><p>Thank you for choosing {{company_name}}! Your booking has been created and we need you to complete a few more steps.</p><div class="booking-details"><strong>Booking Reference:</strong> {{reference_code}}<br><strong>Vehicle:</strong> {{car_model}}<br><strong>Pickup:</strong> {{pickup_date}}<br><strong>Return:</strong> {{return_date}}</div><p>Please click the button below to access your booking form:</p><center><a href="{{form_url}}" class="cta-button">Complete Booking Form</a></center><p>In the booking form, you will be able to:</p><ul><li>Review your booking details</li><li>Upload required documents</li><li>Complete payment</li><li>Sign the rental agreement</li></ul><p>If you have any questions, please don''t hesitate to contact us.</p></div><div class="footer"><p>{{company_name}}<br>{{company_email}} | {{company_phone}}</p></div></body></html>'),

('payment_confirmation', 'Payment Received - {{reference_code}}', '<!DOCTYPE html><html><head><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px}.header{background:linear-gradient(135deg,#1a1a1a 0%,#2d2d2d 100%);color:#d4af37;padding:30px;text-align:center;border-radius:10px 10px 0 0}.logo{max-width:150px;height:auto;margin-bottom:15px}.content{background:#fff;padding:30px;border:1px solid #e0e0e0;border-top:none}.success-icon{font-size:48px;color:#22c55e;text-align:center;margin:20px 0}.payment-details{background:#f9f9f9;padding:15px;border-left:4px solid #22c55e;margin:20px 0}.footer{background:#f5f5f5;padding:20px;text-align:center;font-size:12px;color:#666;border-radius:0 0 10px 10px}</style></head><body><div class="header"><img src="https://lbvaghmqwhsawvxyiemw.supabase.co/storage/v1/object/public/company-logos/logo-1761150745897.jpg" alt="{{company_name}}" class="logo"><h1>Payment Received</h1></div><div class="content"><div class="success-icon">✓</div><p>Dear {{client_name}},</p><p>We have successfully received your payment. Thank you!</p><div class="payment-details"><strong>Booking Reference:</strong> {{reference_code}}<br><strong>Amount Paid:</strong> {{amount_paid}} {{currency}}<br><strong>Payment Method:</strong> {{payment_method}}<br><strong>Transaction Date:</strong> {{payment_date}}</div><p><strong>Booking Details:</strong></p><ul><li>Vehicle: {{car_model}}</li><li>Pickup: {{pickup_date}} at {{pickup_location}}</li><li>Return: {{return_date}} at {{return_location}}</li></ul><p>You can access your booking portal anytime to view details and upload documents.</p></div><div class="footer"><p>{{company_name}}<br>{{company_email}} | {{company_phone}}</p></div></body></html>'),

('balance_reminder', 'Balance Payment Reminder - {{reference_code}}', '<!DOCTYPE html><html><head><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px}.header{background:linear-gradient(135deg,#1a1a1a 0%,#2d2d2d 100%);color:#d4af37;padding:30px;text-align:center;border-radius:10px 10px 0 0}.logo{max-width:150px;height:auto;margin-bottom:15px}.content{background:#fff;padding:30px;border:1px solid #e0e0e0;border-top:none}.cta-button{display:inline-block;padding:15px 30px;background:#d4af37;color:#1a1a1a;text-decoration:none;border-radius:5px;font-weight:bold;margin:20px 0}.balance-details{background:#fff9e6;padding:15px;border-left:4px solid #d4af37;margin:20px 0}.footer{background:#f5f5f5;padding:20px;text-align:center;font-size:12px;color:#666;border-radius:0 0 10px 10px}</style></head><body><div class="header"><img src="https://lbvaghmqwhsawvxyiemw.supabase.co/storage/v1/object/public/company-logos/logo-1761150745897.jpg" alt="{{company_name}}" class="logo"><h1>Balance Payment Reminder</h1></div><div class="content"><p>Dear {{client_name}},</p><p>This is a friendly reminder that your rental is approaching and there is an outstanding balance on your booking.</p><div class="balance-details"><strong>Booking Reference:</strong> {{reference_code}}<br><strong>Vehicle:</strong> {{car_model}}<br><strong>Pickup Date:</strong> {{pickup_date}}<br><strong>Outstanding Balance:</strong> {{remaining_amount}} {{currency}}</div><p>Please complete your payment before your pickup date:</p><center><a href="{{payment_url}}" class="cta-button">Pay Balance Now</a></center><p>If you have already made this payment, please disregard this message.</p></div><div class="footer"><p>{{company_name}}<br>{{company_email}} | {{company_phone}}</p></div></body></html>'),

('bank_transfer', 'Bank Transfer Instructions - {{reference_code}}', '<!DOCTYPE html><html><head><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px}.header{background:linear-gradient(135deg,#1a1a1a 0%,#2d2d2d 100%);color:#d4af37;padding:30px;text-align:center;border-radius:10px 10px 0 0}.logo{max-width:150px;height:auto;margin-bottom:15px}.content{background:#fff;padding:30px;border:1px solid #e0e0e0;border-top:none}.bank-details{background:#f0f9ff;padding:20px;border:2px solid #3b82f6;border-radius:5px;margin:20px 0}.important{background:#fef3c7;padding:15px;border-left:4px solid #f59e0b;margin:20px 0}.footer{background:#f5f5f5;padding:20px;text-align:center;font-size:12px;color:#666;border-radius:0 0 10px 10px}</style></head><body><div class="header"><img src="https://lbvaghmqwhsawvxyiemw.supabase.co/storage/v1/object/public/company-logos/logo-1761150745897.jpg" alt="{{company_name}}" class="logo"><h1>Bank Transfer Instructions</h1></div><div class="content"><p>Dear {{client_name}},</p><p>Please use the following bank details to complete your payment:</p><div class="bank-details"><strong>Account Name:</strong> {{account_name}}<br><strong>IBAN:</strong> {{iban}}<br><strong>BIC/SWIFT:</strong> {{bic}}<br><strong>Bank:</strong> {{bank_name}}<br><br><strong>Amount:</strong> {{amount}} {{currency}}<br><strong>Reference:</strong> {{reference}}</div><div class="important"><strong>⚠️ Important:</strong><br>Please include the reference code <strong>{{reference}}</strong> in your transfer to ensure proper processing.</div><p><strong>Booking Details:</strong></p><ul><li>Reference: {{reference_code}}</li><li>Vehicle: {{car_model}}</li><li>Pickup: {{pickup_date}}</li></ul></div><div class="footer"><p>{{company_name}}<br>{{company_email}} | {{company_phone}}</p></div></body></html>');

-- Insert default payment success messages
INSERT INTO public.payment_success_messages (message_type, html_content) VALUES
('down_payment', 'Your payment has been processed successfully. <strong>Booking Reference: {{bookingRef}}</strong><br /><br />You can now access your booking portal to view details, upload documents, and track your rental.<br /><br /><span class="text-xs text-muted-foreground">A confirmation email has been sent to your email address.</span>'),

('balance_payment', 'Your balance payment has been processed successfully. <strong>Booking Reference: {{bookingRef}}</strong><br /><br />Your booking is now fully paid. You can access your booking portal to view all details and prepare for your rental.'),

('security_deposit', 'Your security deposit has been authorized successfully. <strong>Booking Reference: {{bookingRef}}</strong><br /><br />This is a hold on your card, not a charge. The authorization will be released after your rental period unless damages occur.<br /><br />You can access your booking portal to view all details.');

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_email_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_email_templates_updated_at();

CREATE TRIGGER payment_success_messages_updated_at
  BEFORE UPDATE ON public.payment_success_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_email_templates_updated_at();