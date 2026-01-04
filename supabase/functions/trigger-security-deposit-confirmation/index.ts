import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  booking_id: string;
  deposit_amount?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { booking_id, deposit_amount }: RequestBody = await req.json();

    if (!booking_id) {
      throw new Error('booking_id is required');
    }

    console.log('Sending security deposit confirmation email for booking:', booking_id);

    // Fetch booking details
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      throw new Error(`Failed to fetch booking: ${bookingError?.message || 'Booking not found'}`);
    }

    // Check if client has email
    if (!booking.client_email) {
      console.log('No client email found, skipping email send');
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'No client email provided, skipping confirmation email',
          email_sent: false
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Fetch app settings
    const { data: appSettings } = await supabaseClient
      .from('app_settings')
      .select('*')
      .limit(1)
      .single();

    // Generate or get existing access token for client portal
    const { data: existingToken } = await supabaseClient
      .from('booking_access_tokens')
      .select('token')
      .eq('booking_id', booking.id)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let accessToken = existingToken?.token;
    if (!accessToken) {
      const { data: tokenData } = await supabaseClient.rpc('generate_booking_token', {
        p_booking_id: booking.id
      });
      accessToken = tokenData;
    }

    const appDomain = Deno.env.get('APP_DOMAIN') || 'https://bookrentmanager.com';
    const portalUrl = `${appDomain}/client-portal/${accessToken}`;
    const logoUrl = 'https://bookrentmanager.lovable.app/king-rent-logo.png';
    const companyName = appSettings?.company_name || 'King Rent';
    const actualDepositAmount = deposit_amount || booking.security_deposit_amount || 0;

    console.log('Portal URL generated:', portalUrl);

    // Build email HTML matching the "Booking Confirmed" styling
    const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Georgia', serif; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background-color: #000000; color: #C5A572; padding: 40px 20px; text-align: center; border-bottom: 3px solid #C5A572; }
        .header h1 { font-family: 'Playfair Display', serif; font-size: 32px; margin: 20px 0 10px; color: #C5A572; }
        .celebration { font-size: 18px; color: #C5A572; font-weight: bold; margin-bottom: 20px; text-align: center; }
        .content { padding: 40px 30px; background: #fff; }
        .gold-divider { height: 2px; background: linear-gradient(to right, transparent, #C5A572, transparent); margin: 30px 0; }
        .booking-details { background: #f9f9f9; border-left: 4px solid #C5A572; padding: 25px; margin: 20px 0; }
        .detail-row { padding: 10px 0; border-bottom: 1px solid #e0e0e0; }
        .label { font-weight: bold; color: #666; display: inline-block; width: 40%; }
        .value { color: #000; display: inline-block; width: 58%; }
        .cta-button { display: inline-block; background-color: #000000; color: #C5A572; padding: 15px 35px; border: 2px solid #C5A572; font-size: 16px; font-weight: bold; text-decoration: none; margin: 10px; }
        .footer { background: #f5f5f5; padding: 30px 20px; text-align: center; border-top: 3px solid #C5A572; }
        @media only screen and (min-width: 481px) {
          .header img { max-width: 150px !important; width: 150px !important; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="${logoUrl}" alt="${companyName} Logo" width="150" style="max-width: 150px; height: auto; display: block; margin: 0 auto 15px auto; object-fit: contain; background: transparent;" />
          <h1>Security Deposit Authorized</h1>
          <p style="margin: 5px 0; opacity: 0.9; font-style: italic; font-size: 12px;">Your Deposit is Secured</p>
          <p style="margin: 10px 0 0 0; opacity: 0.9; font-weight: 500;">Booking Reference: ${booking.reference_code}</p>
        </div>
        
        <div class="content">
          <p class="celebration">✅ Thank you, ${booking.client_name}!</p>
          
          <p style="font-size: 16px; line-height: 1.8;">
            Your security deposit has been successfully authorized. This is a temporary hold on your card — <strong>you have not been charged</strong>.<br><br>
            The deposit will be automatically released after your rental is complete and the vehicle is returned in good condition.
          </p>
          
          <div class="gold-divider"></div>
          
          <div class="booking-details">
            <h3 style="margin-top: 0; color: #000; font-family: 'Playfair Display', serif;">🔐 Deposit Authorization Details</h3>
            <div class="detail-row">
              <span class="label">Amount Authorized:</span>
              <span class="value" style="font-weight: bold; font-size: 18px; color: #16a34a;">${booking.currency} ${actualDepositAmount.toFixed(2)}</span>
            </div>
            <div class="detail-row">
              <span class="label">Status:</span>
              <span class="value" style="color: #16a34a; font-weight: bold;">✓ Authorized (Not Charged)</span>
            </div>
            <div class="detail-row" style="border-bottom: none;">
              <span class="label">Release:</span>
              <span class="value">Automatic after rental completion</span>
            </div>
          </div>

          <div class="booking-details">
            <h3 style="margin-top: 0; color: #000; font-family: 'Playfair Display', serif;">🚗 Booking Information</h3>
            <div class="detail-row">
              <span class="label">Reference:</span>
              <span class="value" style="font-weight: bold;">${booking.reference_code}</span>
            </div>
            <div class="detail-row">
              <span class="label">Vehicle:</span>
              <span class="value">${booking.car_model}</span>
            </div>
            <div class="detail-row">
              <span class="label">Delivery:</span>
              <span class="value">${new Date(booking.delivery_datetime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            </div>
            <div class="detail-row" style="border-bottom: none;">
              <span class="label">Delivery Location:</span>
              <span class="value">${booking.delivery_location}</span>
            </div>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${portalUrl}" class="cta-button">🔐 Access Your Client Portal</a>
          </div>
          
          <div class="gold-divider"></div>
          
          <p style="font-size: 15px; line-height: 1.8;">
            Your Luxury Car Rental Experience awaits. We are here to ensure every moment exceeds your expectations. Should you have any questions or requests, our dedicated team is at your service.<br><br>
            <strong>Do not reply to this email. Kindly use our official contacts.</strong>
          </p>
          
          <p style="font-size: 14px; color: #666; margin-top: 30px;">
            With gratitude,<br>
            <strong style="color: #000;">The ${companyName} Team</strong>
          </p>
        </div>
        
        <div class="footer">
          <p style="margin: 0 0 10px 0; font-style: italic; font-size: 13px; color: #C5A572;">Your Trusted Luxury Car Rental Partner</p>
          <p style="margin: 0; font-size: 14px; color: #666;">
            ${companyName}<br>
            ${appSettings?.company_email ? `📧 ${appSettings.company_email}` : ''} ${appSettings?.company_phone ? `| 📞 ${appSettings.company_phone}` : ''}
          </p>
          <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e0e0e0; font-size: 11px; color: #999;">
            🔒 Secure Process | ⭐ Verified Service | 🚗 Premium Fleet
          </div>
          <p style="margin-top: 10px; font-size: 12px; color: #999;">
            © ${new Date().getFullYear()} ${companyName}. All Rights Reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
    `;

    // Send email via Zapier webhook
    const zapierWebhookUrl = Deno.env.get('ZAPIER_SECURITY_DEPOSIT_CONFIRMATION_WEBHOOK_URL');
    
    if (!zapierWebhookUrl) {
      console.log('No Zapier webhook URL configured for security deposit confirmation, skipping email send');
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Security deposit confirmation webhook not configured - email not sent',
          email_sent: false
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log('Sending email via Zapier webhook...');
    
    const emailPayload = {
      to: booking.client_email,
      subject: `Security Deposit Authorized - ${booking.reference_code}`,
      html: emailHtml,
      booking_reference: booking.reference_code,
      client_name: booking.client_name,
      deposit_amount: actualDepositAmount,
      currency: booking.currency,
      type: 'security_deposit_confirmation'
    };

    const zapierResponse = await fetch(zapierWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emailPayload)
    });

    if (!zapierResponse.ok) {
      const errorText = await zapierResponse.text();
      console.error('Zapier webhook failed:', errorText);
      throw new Error(`Failed to send email via Zapier: ${errorText}`);
    }

    console.log('Email sent successfully via Zapier');

    // Create audit log
    await supabaseClient.from('audit_logs').insert({
      entity: 'booking',
      entity_id: booking_id,
      action: 'security_deposit_confirmation_sent',
      payload_snapshot: {
        deposit_amount: actualDepositAmount,
        sent_to: booking.client_email,
        sent_at: new Date().toISOString(),
      },
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Security deposit confirmation email sent successfully',
        email_sent: true,
        sent_to: booking.client_email
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error sending security deposit confirmation email:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
