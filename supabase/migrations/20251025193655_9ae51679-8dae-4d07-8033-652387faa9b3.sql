-- Insert default bank transfer instructions email template
INSERT INTO email_templates (template_type, subject_line, html_content, is_active)
VALUES (
  'bank_transfer_instructions',
  'Bank Transfer Payment Instructions - Booking {{reference_code}}',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .logo { text-align: center; margin-bottom: 30px; }
    .logo img { max-width: 200px; height: auto; }
    .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .bank-details { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
    .bank-details h3 { margin-top: 0; color: #856404; }
    .detail-row { margin: 10px 0; }
    .detail-label { font-weight: bold; color: #666; }
    .detail-value { color: #333; font-size: 16px; }
    .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <img src="{{logo_url}}" alt="Company Logo">
    </div>
    
    <div class="header">
      <h2>Bank Transfer Payment Instructions</h2>
      <p>Booking Reference: <strong>{{reference_code}}</strong></p>
      <p>Dear {{client_name}},</p>
      <p>Thank you for completing your booking form! To confirm your reservation, please transfer the payment to our bank account.</p>
    </div>
    
    <div class="bank-details">
      <h3>Bank Account Details</h3>
      <div class="detail-row">
        <div class="detail-label">Account Holder:</div>
        <div class="detail-value">{{bank_holder}}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">IBAN:</div>
        <div class="detail-value">{{bank_iban}}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">BIC/SWIFT:</div>
        <div class="detail-value">{{bank_bic}}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">Bank Name:</div>
        <div class="detail-value">{{bank_name}}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">Amount to Transfer:</div>
        <div class="detail-value"><strong>{{amount}} {{currency}}</strong></div>
      </div>
      <div class="detail-row">
        <div class="detail-label">Reference/Description:</div>
        <div class="detail-value"><strong>{{reference_code}}</strong></div>
      </div>
    </div>
    
    <p><strong>Important Instructions:</strong></p>
    <p>{{payment_instructions}}</p>
    
    <div style="text-align: center;">
      <a href="{{payment_link}}" class="button">View Full Payment Instructions</a>
    </div>
    
    <p>After making the transfer, you can upload your payment confirmation via the link above or through your client portal.</p>
    
    <div class="footer">
      <p>This is an automated email. If you have any questions, please contact us.</p>
      <p>{{company_name}}<br>{{company_email}}<br>{{company_phone}}</p>
    </div>
  </div>
</body>
</html>',
  true
)
ON CONFLICT DO NOTHING;