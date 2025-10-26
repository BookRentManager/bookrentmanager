import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BankTransferEmailRequest {
  payment_id: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { payment_id }: BankTransferEmailRequest = await req.json();
    console.log('Triggering bank transfer email for payment:', payment_id);

    if (!payment_id) {
      throw new Error('payment_id is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const zapierWebhookUrl = Deno.env.get('ZAPIER_BANK_TRANSFER_WEBHOOK_URL');
    const appDomain = Deno.env.get('APP_DOMAIN') || 'https://bookrentmanager.lovable.app';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch payment details with booking information
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select(`
        *,
        bookings (
          id,
          reference_code,
          client_name,
          client_email,
          car_model,
          collection_datetime,
          delivery_datetime,
          amount_total,
          amount_paid
        )
      `)
      .eq('id', payment_id)
      .single();

    if (paymentError || !payment) {
      throw new Error(`Payment not found: ${paymentError?.message}`);
    }

    console.log('Payment fetched:', payment.id, 'for booking:', payment.bookings?.reference_code);

    // Fetch email template
    const { data: emailTemplate } = await supabase
      .from('email_templates')
      .select('*')
      .eq('template_type', 'bank_transfer_instructions')
      .eq('is_active', true)
      .single();

    // Fetch bank account settings
    const { data: bankSettings } = await supabase
      .from('app_settings')
      .select('bank_account_holder, bank_account_iban, bank_account_bic, bank_account_bank_name')
      .single();

    // Fetch app settings for company info
    const { data: appSettings } = await supabase
      .from('app_settings')
      .select('*')
      .single();

    // Build payment link URL
    const paymentLink = `${appDomain}/bank-transfer-instructions?payment_id=${payment_id}`;

    // Build email subject and body from template or use defaults
    let emailSubject = 'Bank Transfer Payment Instructions';
    let emailHtml = '';

    if (emailTemplate) {
      emailSubject = emailTemplate.subject_line || emailSubject;
      emailHtml = emailTemplate.html_content || '';

      // Replace placeholders
      const replacements: Record<string, string> = {
        '{{reference_code}}': payment.bookings?.reference_code || '',
        '{{client_name}}': payment.bookings?.client_name || '',
        '{{car_model}}': payment.bookings?.car_model || '',
        '{{pickup_date}}': payment.bookings?.collection_datetime ? new Date(payment.bookings.collection_datetime).toLocaleDateString() : '',
        '{{dropoff_date}}': payment.bookings?.delivery_datetime ? new Date(payment.bookings.delivery_datetime).toLocaleDateString() : '',
        '{{payment_amount}}': payment.amount?.toString() || '0',
        '{{currency}}': payment.currency || 'EUR',
        '{{bank_holder}}': bankSettings?.bank_account_holder || '',
        '{{bank_iban}}': bankSettings?.bank_account_iban || '',
        '{{bank_bic}}': bankSettings?.bank_account_bic || '',
        '{{bank_name}}': bankSettings?.bank_account_bank_name || '',
        '{{payment_link}}': paymentLink,
        '{{company_name}}': appSettings?.company_name || '',
      };

      for (const [placeholder, value] of Object.entries(replacements)) {
        emailHtml = emailHtml.replace(new RegExp(placeholder, 'g'), value);
        emailSubject = emailSubject.replace(new RegExp(placeholder, 'g'), value);
      }
    } else {
      // Fallback to styled template
      emailSubject = `Bank Transfer Instructions - ${payment.bookings?.reference_code}`;
      
      const logoUrl = appSettings?.logo_url || '';
      const companyName = appSettings?.company_name || 'King Rent';
      
      emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background: linear-gradient(135deg, #1a1a2e 0%, #2d2d44 100%); padding: 30px; text-align: center; }
    .logo { max-width: 200px; height: auto; }
    .content { padding: 40px 30px; }
    .booking-ref { background-color: #f8f9fa; border-left: 4px solid #6366f1; padding: 15px; margin: 20px 0; }
    .bank-details { background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 25px 0; }
    .bank-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
    .bank-label { font-weight: bold; color: #4b5563; }
    .bank-value { color: #1f2937; font-family: monospace; }
    .amount-box { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 25px 0; }
    .amount { font-size: 32px; font-weight: bold; }
    .cta-button { display: inline-block; background-color: #6366f1; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { background-color: #f9fafb; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${logoUrl ? `<img src="${logoUrl}" alt="${companyName}" class="logo">` : `<h1 style="color: white; margin: 0;">${companyName}</h1>`}
    </div>
    
    <div class="content">
      <h2 style="color: #1f2937; margin-top: 0;">Bank Transfer Payment Instructions</h2>
      
      <p>Dear ${payment.bookings?.client_name},</p>
      
      <p>Thank you for your booking. Please complete your payment via bank transfer using the details below:</p>
      
      <div class="booking-ref">
        <strong>Booking Reference:</strong> ${payment.bookings?.reference_code}<br>
        <strong>Vehicle:</strong> ${payment.bookings?.car_model}
      </div>
      
      <div class="amount-box">
        <div style="font-size: 14px; margin-bottom: 5px;">Amount to Transfer</div>
        <div class="amount">${payment.amount} ${payment.currency}</div>
      </div>
      
      <div class="bank-details">
        <h3 style="margin-top: 0; color: #1f2937;">Bank Account Details</h3>
        <div class="bank-row">
          <span class="bank-label">Account Holder:</span>
          <span class="bank-value">${bankSettings?.bank_account_holder || 'N/A'}</span>
        </div>
        <div class="bank-row">
          <span class="bank-label">IBAN:</span>
          <span class="bank-value">${bankSettings?.bank_account_iban || 'N/A'}</span>
        </div>
        <div class="bank-row">
          <span class="bank-label">BIC/SWIFT:</span>
          <span class="bank-value">${bankSettings?.bank_account_bic || 'N/A'}</span>
        </div>
        <div class="bank-row" style="border-bottom: none;">
          <span class="bank-label">Bank:</span>
          <span class="bank-value">${bankSettings?.bank_account_bank_name || 'N/A'}</span>
        </div>
      </div>
      
      <p><strong>Important:</strong> Please use your booking reference <strong>${payment.bookings?.reference_code}</strong> as the payment reference.</p>
      
      <div style="text-align: center;">
        <a href="${paymentLink}" class="cta-button">View Full Instructions & Upload Proof</a>
      </div>
      
      <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
        After making the transfer, please upload your payment proof using the link above to speed up the confirmation process.
      </p>
    </div>
    
    <div class="footer">
      <p style="margin: 5px 0;">${companyName}</p>
      <p style="margin: 5px 0;">This is an automated message, please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
      `;
    }

    // Prepare webhook payload
    const webhookPayload = {
      client_email: payment.bookings?.client_email,
      client_name: payment.bookings?.client_name || '',
      booking_reference: payment.bookings?.reference_code || '',
      email_subject: emailSubject,
      email_html: emailHtml,
      payment_amount: payment.amount,
      currency: payment.currency,
      bank_holder: bankSettings?.bank_account_holder || '',
      bank_iban: bankSettings?.bank_account_iban || '',
      bank_bic: bankSettings?.bank_account_bic || '',
      bank_name: bankSettings?.bank_account_bank_name || '',
      payment_link: paymentLink,
      booking_details: {
        reference: payment.bookings?.reference_code,
        car_model: payment.bookings?.car_model,
        pickup_date: payment.bookings?.collection_datetime,
        dropoff_date: payment.bookings?.delivery_datetime,
        total_amount: payment.bookings?.amount_total,
        amount_paid: payment.bookings?.amount_paid,
      },
      timestamp: new Date().toISOString(),
    };

    // Send to Zapier webhook if URL is configured
    if (zapierWebhookUrl) {
      console.log('Sending webhook to Zapier for payment:', payment_id);
      
      const zapierResponse = await fetch(zapierWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookPayload),
      });

      if (!zapierResponse.ok) {
        console.error('Zapier webhook failed:', zapierResponse.status, zapierResponse.statusText);
      } else {
        console.log('Zapier webhook sent successfully');
      }
    } else {
      console.warn('ZAPIER_BANK_TRANSFER_WEBHOOK_URL not configured, skipping email');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Bank transfer email triggered',
        payment_id,
        webhook_sent: !!zapierWebhookUrl
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in trigger-bank-transfer-email:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});