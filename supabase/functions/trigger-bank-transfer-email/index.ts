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
          guest_name,
          guest_email,
          car_model,
          pickup_date,
          dropoff_date,
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
      .select('bank_account_holder, bank_account_iban, bank_account_bic, bank_account_name')
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
      emailSubject = emailTemplate.subject || emailSubject;
      emailHtml = emailTemplate.body_html || '';

      // Replace placeholders
      const replacements: Record<string, string> = {
        '{{reference_code}}': payment.bookings?.reference_code || '',
        '{{client_name}}': payment.bookings?.client_name || '',
        '{{guest_name}}': payment.bookings?.guest_name || payment.bookings?.client_name || '',
        '{{car_model}}': payment.bookings?.car_model || '',
        '{{pickup_date}}': payment.bookings?.pickup_date ? new Date(payment.bookings.pickup_date).toLocaleDateString() : '',
        '{{dropoff_date}}': payment.bookings?.dropoff_date ? new Date(payment.bookings.dropoff_date).toLocaleDateString() : '',
        '{{payment_amount}}': payment.amount?.toString() || '0',
        '{{currency}}': payment.currency || 'EUR',
        '{{bank_holder}}': bankSettings?.bank_account_holder || '',
        '{{bank_iban}}': bankSettings?.bank_account_iban || '',
        '{{bank_bic}}': bankSettings?.bank_account_bic || '',
        '{{bank_name}}': bankSettings?.bank_account_name || '',
        '{{payment_link}}': paymentLink,
        '{{company_name}}': appSettings?.company_name || '',
      };

      for (const [placeholder, value] of Object.entries(replacements)) {
        emailHtml = emailHtml.replace(new RegExp(placeholder, 'g'), value);
        emailSubject = emailSubject.replace(new RegExp(placeholder, 'g'), value);
      }
    } else {
      // Fallback template
      emailSubject = `Payment Instructions - ${payment.bookings?.reference_code}`;
      emailHtml = `
        <h2>Bank Transfer Payment Instructions</h2>
        <p>Dear ${payment.bookings?.client_name},</p>
        <p>Thank you for your booking (${payment.bookings?.reference_code}).</p>
        <p>Please complete your payment of ${payment.amount} ${payment.currency} via bank transfer:</p>
        <ul>
          <li><strong>Account Holder:</strong> ${bankSettings?.bank_account_holder || 'N/A'}</li>
          <li><strong>IBAN:</strong> ${bankSettings?.bank_account_iban || 'N/A'}</li>
          <li><strong>BIC/SWIFT:</strong> ${bankSettings?.bank_account_bic || 'N/A'}</li>
          <li><strong>Bank:</strong> ${bankSettings?.bank_account_name || 'N/A'}</li>
          <li><strong>Reference:</strong> ${payment.bookings?.reference_code}</li>
        </ul>
        <p><a href="${paymentLink}">View full payment instructions</a></p>
      `;
    }

    // Prepare webhook payload
    const webhookPayload = {
      client_email: payment.bookings?.client_email || payment.bookings?.guest_email,
      client_name: payment.bookings?.client_name || '',
      booking_reference: payment.bookings?.reference_code || '',
      email_subject: emailSubject,
      email_html: emailHtml,
      payment_amount: payment.amount,
      currency: payment.currency,
      bank_holder: bankSettings?.bank_account_holder || '',
      bank_iban: bankSettings?.bank_account_iban || '',
      bank_bic: bankSettings?.bank_account_bic || '',
      bank_name: bankSettings?.bank_account_name || '',
      payment_link: paymentLink,
      booking_details: {
        reference: payment.bookings?.reference_code,
        car_model: payment.bookings?.car_model,
        pickup_date: payment.bookings?.pickup_date,
        dropoff_date: payment.bookings?.dropoff_date,
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