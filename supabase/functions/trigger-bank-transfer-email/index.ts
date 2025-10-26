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

    // Generate or fetch booking access token for client portal
    let accessToken = '';
    const { data: existingToken } = await supabase
      .from('booking_access_tokens')
      .select('token')
      .eq('booking_id', payment.bookings?.id)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existingToken?.token) {
      accessToken = existingToken.token;
      console.log('Using existing access token for client portal');
    } else {
      const { data: newToken, error: tokenError } = await supabase
        .rpc('generate_booking_token', { p_booking_id: payment.bookings?.id });
      
      if (tokenError) {
        console.error('Error generating token:', tokenError);
      } else {
        accessToken = newToken;
        console.log('Generated new access token for client portal');
      }
    }

    // Build client portal URL
    const clientPortalUrl = `${appDomain}/client-portal/${accessToken}`;

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
        '{{payment_link}}': clientPortalUrl,
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
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    body { margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { background: #000000; color: #C5A572; padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0; border-bottom: 2px solid #C5A572; }
    .logo { max-width: 150px; height: auto; display: block; margin: 0 auto 15px auto; object-fit: contain; background: transparent; }
    h1 { margin: 0; font-size: 28px; font-family: 'Playfair Display', Georgia, serif; font-weight: 700; color: #C5A572; }
    h2 { color: #1f2937; font-size: 20px; margin-top: 0; font-family: 'Playfair Display', Georgia, serif; }
    .content { background: #ffffff; padding: 30px 20px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; }
    .booking-ref { background-color: #fafafa; border-left: 4px solid #C5A572; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .bank-details { background-color: #fafafa; border-radius: 8px; padding: 20px; margin: 25px 0; border: 1px solid #e5e7eb; }
    .bank-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
    .bank-label { font-weight: bold; color: #4b5563; }
    .bank-value { color: #1f2937; font-family: monospace; }
    .amount-box { background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%); color: #C5A572; padding: 20px; border-radius: 8px; text-align: center; margin: 25px 0; border: 2px solid #C5A572; }
    .amount { font-size: 32px; font-weight: bold; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%); color: #C5A572; padding: 14px 24px; text-decoration: none; border-radius: 6px; font-weight: 700; margin: 20px auto; border: 2px solid #C5A572; box-shadow: 0 4px 15px rgba(197, 165, 114, 0.3); text-transform: uppercase; letter-spacing: 0.5px; max-width: 320px; }
    .cta-button:hover { background: #C5A572; color: #000000; }
    .footer { background: #000000; color: #C5A572; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #C5A572; }
    @media only screen and (min-width: 481px) {
      .header img { max-width: 150px !important; width: 150px !important; }
    }
    @media only screen and (max-width: 480px) {
      .header, .content, .footer { padding-left: 12px; padding-right: 12px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${logoUrl ? `<img src="${logoUrl}" alt="${companyName}" class="logo">` : `<h1>${companyName}</h1>`}
      <h1>Bank Transfer Payment</h1>
      <p style="margin: 5px 0; opacity: 0.9; font-style: italic; font-size: 12px;">Experience Luxury on Wheels</p>
      <p style="margin: 10px 0 0 0; opacity: 0.9; font-weight: 500;">Booking Reference: ${payment.bookings?.reference_code}</p>
    </div>
    
    <div class="content">
      <h2>Complete Your Payment</h2>
      
      <p style="font-size: 16px; line-height: 1.7;">Dear ${payment.bookings?.client_name},</p>
      
      <p>Thank you for choosing ${companyName}! Please complete your payment via bank transfer using the details below:</p>
      
      <div style="height: 2px; background: linear-gradient(90deg, transparent, #C5A572, transparent); margin: 25px 0;"></div>
      
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
        <a href="${clientPortalUrl}" class="cta-button" style="display: inline-block;">📤 Upload Payment Proof in Client Portal</a>
      </div>
      
      <p style="color: #6b7280; font-size: 14px; margin-top: 30px; text-align: center;">
        After making the transfer, please access the client portal above and navigate to the <strong>Payments</strong> section to upload your payment proof. This will speed up the confirmation process.
      </p>
    </div>
    
    <div class="footer">
      <p style="margin: 0 0 10px 0; font-style: italic; font-size: 13px;">Your Trusted Luxury Car Rental Agency in Europe & Dubai</p>
      <p style="margin: 0; font-size: 14px;">
        ${companyName}<br>
        ${appSettings?.company_email || ''} | ${appSettings?.company_phone || ''}
      </p>
      <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(197, 165, 114, 0.3); font-size: 11px; opacity: 0.8;">
        🔒 Secure Payment | ⭐ Verified Service | 🚗 Premium Fleet
      </div>
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
      client_portal_url: clientPortalUrl,
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