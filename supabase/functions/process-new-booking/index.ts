import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { booking_id } = await req.json();

    if (!booking_id) {
      throw new Error('booking_id is required');
    }

    console.log('Processing new booking:', booking_id);

    // Fetch booking details
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      throw new Error(`Failed to fetch booking: ${bookingError?.message || 'Booking not found'}`);
    }

    if (!booking.client_email) {
      throw new Error('Booking has no client email');
    }

    // Generate token
    const { data: tokenData, error: tokenError } = await supabaseClient
      .rpc('generate_booking_token', { p_booking_id: booking_id });

    if (tokenError || !tokenData) {
      throw new Error(`Failed to generate token: ${tokenError?.message}`);
    }

    const token = tokenData;
    console.log('Generated token for booking:', booking.reference_code);

    const appDomain = Deno.env.get('APP_DOMAIN') || 
      Deno.env.get('SUPABASE_URL')?.replace('/v1', '') || '';
    const formUrl = `${appDomain}/booking-form/${token}`;

    // Fetch app settings
    const { data: appSettings } = await supabaseClient
      .from('app_settings')
      .select('*')
      .limit(1)
      .single();

    // Fetch email template from database
    const { data: emailTemplate } = await supabaseClient
      .from('email_templates')
      .select('*')
      .eq('template_type', 'booking_form')
      .eq('is_active', true)
      .single();

    const companyName = appSettings?.company_name || 'BookRentManager';
    
    // Generate email HTML and subject
    let emailSubject = `Complete Your Booking - ${booking.reference_code}`;
    let emailHtml = '';

    if (emailTemplate?.html_content) {
      console.log('Using custom email template from database');
      emailSubject = emailTemplate.subject_line || emailSubject;
      emailHtml = replacePlaceholders(emailTemplate.html_content, booking, formUrl, appSettings);
    } else {
      console.log('Using default hardcoded email template (fallback)');
      emailHtml = getBookingFormEmail(booking, formUrl, appSettings);
    }

    // Send via Zapier
    const zapierWebhookUrl = Deno.env.get('ZAPIER_SEND_BOOKING_FORM_WEBHOOK_URL');

    if (!zapierWebhookUrl) {
      console.error('ZAPIER_SEND_BOOKING_FORM_WEBHOOK_URL not configured');
      throw new Error('Zapier webhook URL not configured');
    }

    const webhookPayload = {
      client_email: booking.client_email,
      client_name: booking.client_name,
      booking_reference: booking.reference_code,
      email_subject: emailSubject,
      email_html: emailHtml,
      form_url: formUrl,
      booking_details: {
        car_model: booking.car_model,
        delivery_datetime: booking.delivery_datetime,
        collection_datetime: booking.collection_datetime,
        amount_total: booking.amount_total,
        currency: booking.currency,
        security_deposit_amount: booking.security_deposit_amount,
        payment_amount_percent: booking.payment_amount_percent,
      },
      company_info: {
        company_name: appSettings?.company_name || 'KingRent',
        company_email: appSettings?.company_email || '',
        company_phone: appSettings?.company_phone || '',
      },
      timestamp: new Date().toISOString(),
    };

    console.log('Sending webhook to Zapier for booking:', booking.reference_code);

    const webhookResponse = await fetch(zapierWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload),
    });

    if (!webhookResponse.ok) {
      console.error('Zapier webhook failed:', await webhookResponse.text());
      throw new Error(`Zapier webhook failed with status ${webhookResponse.status}`);
    }

    console.log('Email sent successfully to:', booking.client_email);

    // Update booking
    const { error: updateError } = await supabaseClient
      .from('bookings')
      .update({ booking_form_sent_at: new Date().toISOString() })
      .eq('id', booking_id);

    if (updateError) {
      console.error('Failed to update booking:', updateError);
    }

    // Log audit
    const { error: auditError } = await supabaseClient
      .from('audit_logs')
      .insert({
        entity: 'booking',
        entity_id: booking_id,
        action: 'booking_form_sent',
        payload_snapshot: {
          token_generated: true,
          email_sent: true,
          recipient: booking.client_email,
          form_url: formUrl,
        },
      });

    if (auditError) {
      console.error('Failed to create audit log:', auditError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        form_url: formUrl,
        token,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error processing new booking:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

// Replace placeholders in custom template
function replacePlaceholders(html: string, booking: any, formUrl: string, settings: any): string {
  const logoUrl = settings?.logo_url || 'https://bookrentmanager.lovable.app/king-rent-logo.png';
  const downPayment = ((booking.amount_total * (booking.payment_amount_percent || 0)) / 100).toFixed(2);
  const balancePayment = (booking.amount_total - parseFloat(downPayment)).toFixed(2);

  return html
    .replace(/\{\{reference_code\}\}/g, booking.reference_code)
    .replace(/\{\{client_name\}\}/g, booking.client_name)
    .replace(/\{\{client_email\}\}/g, booking.client_email || '')
    .replace(/\{\{car_model\}\}/g, booking.car_model)
    .replace(/\{\{car_plate\}\}/g, booking.car_plate || '')
    .replace(/\{\{pickup_date\}\}/g, booking.delivery_datetime ? new Date(booking.delivery_datetime).toLocaleString('en-GB') : 'TBD')
    .replace(/\{\{return_date\}\}/g, booking.collection_datetime ? new Date(booking.collection_datetime).toLocaleString('en-GB') : 'TBD')
    .replace(/\{\{pickup_location\}\}/g, booking.delivery_location || '')
    .replace(/\{\{return_location\}\}/g, booking.collection_location || '')
    .replace(/\{\{amount_total\}\}/g, Number(booking.amount_total).toLocaleString())
    .replace(/\{\{currency\}\}/g, booking.currency)
    .replace(/\{\{security_deposit_amount\}\}/g, Number(booking.security_deposit_amount || 0).toLocaleString())
    .replace(/\{\{payment_amount_percent\}\}/g, (booking.payment_amount_percent || 0).toString())
    .replace(/\{\{down_payment\}\}/g, downPayment)
    .replace(/\{\{balance_payment\}\}/g, balancePayment)
    .replace(/\{\{formUrl\}\}/g, formUrl)
    .replace(/\{\{company_name\}\}/g, settings?.company_name || 'KingRent')
    .replace(/\{\{company_email\}\}/g, settings?.company_email || '')
    .replace(/\{\{company_phone\}\}/g, settings?.company_phone || '')
    .replace(/\{\{logoUrl\}\}/g, logoUrl);
}

// Fallback hardcoded template
function getBookingFormEmail(booking: any, formUrl: string, settings: any): string {
  const companyName = settings?.company_name || 'KingRent';
  const logoUrl = settings?.logo_url || 'https://bookrentmanager.lovable.app/king-rent-logo.png';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        body { margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; padding: 0; }
        .header { background: #000000; color: #C5A572; padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0; border-bottom: 2px solid #C5A572; }
        .crown { font-size: 32px; margin-bottom: 10px; display: block; }
        .content { background: #ffffff; padding: 30px 20px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; }
        .footer { background: #000000; color: #C5A572; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #C5A572; }
        .button { display: inline-block; background: #000000; color: #C5A572; padding: 14px 24px; max-width: 280px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px auto; border: 2px solid #C5A572; transition: all 0.3s ease; }
        .button:hover { background: #C5A572; color: #000000; }
        .info-box { background: #fafafa; border-left: 4px solid #C5A572; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .warning-box { background: #fffbf0; border-left: 4px solid #C5A572; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .detail-row { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
        .celebration { font-size: 18px; color: #C5A572; font-weight: bold; margin-bottom: 20px; text-align: center; }
        h1 { margin: 0; font-size: 28px; font-family: 'Playfair Display', Georgia, serif; font-weight: 700; }
        h2 { color: #1f2937; font-size: 20px; margin-top: 0; font-family: 'Playfair Display', Georgia, serif; }
        @media only screen and (min-width: 481px) {
          .header img { max-width: 150px !important; width: 150px !important; }
        }
        @media only screen and (max-width: 480px) {
          .header { padding: 30px 12px !important; }
          .content { padding: 20px 12px !important; }
          .footer { padding: 15px 12px !important; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="${logoUrl}" alt="King Rent Logo" width="150" style="max-width: 150px; height: auto; display: block; margin: 0 auto 15px auto; object-fit: contain; background: transparent;" />
          <h1>Complete Your Booking</h1>
          <p style="margin: 5px 0; opacity: 0.9; font-style: italic; font-size: 12px;">Experience Luxury on Wheels</p>
          <p style="margin: 10px 0 0 0; opacity: 0.9; font-weight: 500;">Booking Reference: ${booking.reference_code}</p>
        </div>
        
        <div class="content">
          <p class="celebration">✨ Hello, ${booking.client_name}!</p>
          <p style="font-size: 16px; line-height: 1.7;">✨ <strong>Welcome to the King Rent family!</strong></p>
          <p>Thank you for choosing King Rent! We're excited to provide you with an exceptional luxury car rental experience. To confirm your reservation, please review and complete the booking form - it takes only few minutes!</p>
          <div style="height: 2px; background: linear-gradient(90deg, transparent, #C5A572, transparent); margin: 25px 0;"></div>
          
            <div class="info-box">
              <strong>📋 Booking Summary</strong><br>
              <div class="detail-row"><strong>Vehicle:</strong> ${booking.car_model}</div>
              <div class="detail-row"><strong>Delivery:</strong> ${new Date(booking.delivery_datetime).toLocaleString('en-GB')}</div>
              <div class="detail-row"><strong>Delivery Location:</strong> ${booking.delivery_location}</div>
              <div class="detail-row"><strong>Collection:</strong> ${new Date(booking.collection_datetime).toLocaleString('en-GB')}</div>
              <div class="detail-row"><strong>Collection Location:</strong> ${booking.collection_location}</div>
              <div class="detail-row"><strong>Total Amount:</strong> €${Number(booking.amount_total).toLocaleString()}</div>
              <div class="detail-row"><strong>Security Deposit:</strong> €${Number(booking.security_deposit_amount || 0).toLocaleString()} <em>(hold before delivery)</em></div>
            </div>

          <div style="text-align: center;">
            <a href="${formUrl}" class="button" style="display: inline-block; padding: 14px 24px; max-width: 280px; background: #000000; color: #C5A572; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; margin: 20px auto; border: 3px solid #C5A572; box-shadow: 0 4px 20px rgba(197, 165, 114, 0.4); text-transform: uppercase; letter-spacing: 1px; white-space: nowrap;">Complete Booking Form ✨</a>
          </div>

          <div class="warning-box">
            <strong>💼 Your Booking Journey:</strong><br>
            <ol style="margin: 10px 0 0 0; padding-left: 20px; line-height: 2;">
              <li><strong>Review & Sign</strong> - Quick digital signature (2 mins)</li>
              <li><strong>Down Payment ✅</strong> - ${booking.payment_amount_percent}% (€${((booking.amount_total * (booking.payment_amount_percent || 0)) / 100).toFixed(2)}) <span style="color: #16a34a; font-weight: 700;">→ Confirms Your Reservation</span></li>
              <li><strong>Balance Payment</strong> - ${100 - (booking.payment_amount_percent || 0)}% (€${(booking.amount_total - ((booking.amount_total * (booking.payment_amount_percent || 0)) / 100)).toFixed(2)}) remaining before your luxury experience begins</li>
              <li><strong>Security Deposit</strong> - €${Number(booking.security_deposit_amount || 0).toLocaleString()} temporary hold (released after rental)</li>
              <li><strong>Booking Portal</strong> - Access your personalized portal to review all details and manage your reservation</li>
            </ol>
          </div>

          <p style="margin-top: 30px; color: #6b7280; font-size: 14px; text-align: center;">
            Should you need any assistance or have any questions, please feel free to reach out to us.<br/><br/>
            Thank you once again for choosing King Rent!<br/><br/>
            <strong>Best Regards,<br/>
            The King Rent Team</strong>
          </p>
        </div>
        
        <div class="footer">
          <p style="margin: 0 0 10px 0; font-style: italic; font-size: 13px; color: #C5A572;">Your Trusted Luxury Car Rental Agency in Europe & Dubai</p>
          <p style="margin: 0; font-size: 14px;">
            King Rent<br>
            ${settings?.company_email || ''} | ${settings?.company_phone || ''}
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
