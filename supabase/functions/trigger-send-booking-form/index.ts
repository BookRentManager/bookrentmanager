import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { booking_id } = await req.json();
    console.log('Triggering booking form email for booking:', booking_id);

    if (!booking_id) {
      throw new Error('booking_id is required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      console.error('Error fetching booking:', bookingError);
      throw new Error('Booking not found');
    }

    console.log('Fetched booking:', booking.reference_code);

    // Check if client email exists
    if (!booking.client_email) {
      throw new Error('Client email is missing');
    }

    // Generate secure token for booking form
    const { data: tokenData, error: tokenError } = await supabase
      .rpc('generate_booking_token', { p_booking_id: booking_id });

    if (tokenError || !tokenData) {
      console.error('Error generating token:', tokenError);
      throw new Error('Failed to generate booking form token');
    }

    console.log('Generated booking token');

    // Construct booking form URL
    const appDomain = Deno.env.get('APP_DOMAIN') || 'https://bookrentmanager.lovable.app';
    const formUrl = `${appDomain}/booking-form/${tokenData}`;

    // Fetch app settings for company info
    const { data: settings } = await supabase
      .from('app_settings')
      .select('company_name, company_address, company_phone, company_email')
      .single();

    // Construct email subject
    const emailSubject = `Complete Your Booking Form - ${booking.reference_code}`;

    // Construct email HTML body
    const emailHtml = getBookingFormEmail(booking, formUrl, settings);

    // Get Zapier webhook URL from environment
    const zapierWebhookUrl = Deno.env.get('ZAPIER_SEND_BOOKING_FORM_WEBHOOK_URL');
    
    if (!zapierWebhookUrl) {
      throw new Error('Zapier webhook URL not configured. Please add ZAPIER_SEND_BOOKING_FORM_WEBHOOK_URL to secrets.');
    }

    // Send webhook to Zapier
    console.log('Sending webhook to Zapier...');
    const webhookPayload = {
      client_email: booking.client_email,
      client_name: booking.client_name,
      booking_reference: booking.reference_code,
      email_subject: emailSubject,
      email_html: emailHtml,
      booking_details: {
        car_model: booking.car_model,
        delivery_date: booking.delivery_datetime,
        collection_date: booking.collection_datetime,
        delivery_location: booking.delivery_location,
        collection_location: booking.collection_location,
        amount_total: booking.amount_total,
        currency: booking.currency,
      },
      form_url: formUrl,
      timestamp: new Date().toISOString(),
    };

    const zapierResponse = await fetch(zapierWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload),
    });

    if (!zapierResponse.ok) {
      console.error('Zapier webhook failed:', zapierResponse.status);
      throw new Error('Failed to trigger Zapier webhook');
    }

    console.log('Zapier webhook sent successfully');

    // Update booking to mark form as sent
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ booking_form_sent_at: new Date().toISOString() })
      .eq('id', booking_id);

    if (updateError) {
      console.error('Error updating booking:', updateError);
      // Don't throw - email was sent, just log the error
    }

    console.log('Booking form email triggered successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Booking form email triggered via Zapier',
        booking_reference: booking.reference_code,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Error in trigger-send-booking-form:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

// Email template function
function getBookingFormEmail(booking: any, formUrl: string, settings: any): string {
  const companyName = settings?.company_name || 'King Rent';
  const companyEmail = settings?.company_email || '';
  const companyPhone = settings?.company_phone || '';
  // Use the gold transparent PNG directly instead of the database logo
  const logoUrl = 'https://bookrentmanager.lovable.app/king-rent-logo.png';
  const downPayment = ((booking.amount_total * (booking.payment_amount_percent || 0)) / 100).toFixed(2);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    body { margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { background: #000000; color: #C5A572; padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0; border-bottom: 2px solid #C5A572; }
    .crown { font-size: 32px; margin-bottom: 10px; display: block; }
    .content { background: #ffffff; padding: 30px 20px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; }
    .footer { background: #000000; color: #C5A572; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #C5A572; }
    .button { display: inline-block; background: #000000; color: #C5A572; padding: 14px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px auto; border: 2px solid #C5A572; transition: all 0.3s ease; max-width: 280px; }
    .button:hover { background: #C5A572; color: #000000; }
    .info-box { background: #fafafa; border-left: 4px solid #C5A572; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .warning-box { background: #fffbf0; border-left: 4px solid #C5A572; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .detail-row { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    h1 { margin: 0; font-size: 28px; font-family: 'Playfair Display', Georgia, serif; font-weight: 700; }
    h2 { color: #1f2937; font-size: 20px; margin-top: 0; font-family: 'Playfair Display', Georgia, serif; }
    @media only screen and (max-width: 480px) {
      .header, .content, .footer { padding-left: 12px; padding-right: 12px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${logoUrl}" alt="King Rent Logo" style="max-width: 200px; height: auto; display: block; margin: 0 auto 15px auto; object-fit: contain; background: transparent;" />
      <h1>Complete Your Booking</h1>
      <p style="margin: 5px 0; opacity: 0.9; font-style: italic; font-size: 12px;">Experience Luxury on Wheels</p>
      <p style="margin: 10px 0 0 0; opacity: 0.9; font-weight: 500;">Booking Reference: ${booking.reference_code}</p>
    </div>
    
    <div class="content">
      <h2>Hello ${booking.client_name},</h2>
      <p style="font-size: 16px; line-height: 1.7;">✨ <strong>Welcome to the King Rent family!</strong></p>
      <p>Thank you for choosing ${companyName}! We're excited to provide you with an exceptional luxury car rental experience. To confirm your reservation, please complete the booking form - it takes only 5 minutes!</p>
      <div style="height: 2px; background: linear-gradient(90deg, transparent, #C5A572, transparent); margin: 25px 0;"></div>
      
      <div class="info-box">
        <strong>📋 Booking Summary</strong><br>
        <div class="detail-row"><strong>Vehicle:</strong> ${booking.car_model}</div>
        <div class="detail-row"><strong>Pickup:</strong> ${booking.delivery_datetime ? new Date(booking.delivery_datetime).toLocaleString('en-GB') : 'TBD'}</div>
        <div class="detail-row"><strong>Return:</strong> ${booking.collection_datetime ? new Date(booking.collection_datetime).toLocaleString('en-GB') : 'TBD'}</div>
        <div class="detail-row"><strong>Total Amount:</strong> ${booking.currency} ${Number(booking.amount_total).toLocaleString()}</div>
        <div class="detail-row"><strong>Security Deposit:</strong> ${booking.currency} ${Number(booking.security_deposit_amount || 0).toLocaleString()} <em>(hold before pickup)</em></div>
      </div>

      <div style="text-align: center;">
        <a href="${formUrl}" class="button" style="display: inline-block; padding: 14px 24px; background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%); color: #C5A572; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 15px; margin: 20px auto; border: 2px solid #C5A572; box-shadow: 0 4px 15px rgba(197, 165, 114, 0.3); text-transform: uppercase; letter-spacing: 0.5px; max-width: 280px;">Complete Booking Form ✨</a>
      </div>

      <div class="warning-box">
        <strong>💼 Your Booking Journey:</strong><br>
        <ol style="margin: 10px 0 0 0; padding-left: 20px; line-height: 2;">
          <li><strong>Review & Sign</strong> - Quick digital signature (2 mins)</li>
          <li><strong>Down Payment</strong> - ${booking.payment_amount_percent}% (${booking.currency} ${downPayment}) securely confirms your reservation</li>
          <li><strong>Balance Payment</strong> - Remaining amount before your luxury experience begins</li>
          <li><strong>Security Deposit</strong> - ${booking.currency} ${Number(booking.security_deposit_amount || 0).toLocaleString()} temporary hold (released after rental)</li>
        </ol>
      </div>

      <p style="margin-top: 30px; color: #6b7280; font-size: 14px; text-align: center;">
        <strong>Your dedicated team is here to assist you.</strong><br/>
        This secure link is valid for 30 days. Questions? We're just a message away!
      </p>
    </div>
    
    <div class="footer">
      <p style="margin: 0 0 10px 0; font-style: italic; font-size: 13px; color: #C5A572;">Your Trusted Luxury Car Rental Agency in Europe & Dubai</p>
      <p style="margin: 0; font-size: 14px;">
        ${companyName}<br>
        ${companyEmail} | ${companyPhone}
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
