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
  const companyAddress = settings?.company_address || '';
  const companyPhone = settings?.company_phone || '';
  const companyEmail = settings?.company_email || '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const crownUrl = `${supabaseUrl}/storage/v1/object/public/crown.png`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet">
      <title>Complete Your Booking Journey</title>
    </head>
    <body style="font-family: 'Georgia', serif; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <tr>
          <td style="background-color: #000000; color: #C5A572; padding: 40px 20px; text-align: center;">
            <img src="${crownUrl}" alt="King Rent Crown" style="height: 50px; display: block; margin: 0 auto 10px;" />
            <h1 style="font-family: 'Playfair Display', serif; margin: 20px 0 10px; font-size: 32px; color: #C5A572;">Complete Your Booking Journey</h1>
            <p style="color: #C5A572; font-size: 14px; font-style: italic; margin: 0;">Experience Luxury on Wheels</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 40px 30px;">
            <p style="font-size: 18px; color: #C5A572; font-weight: bold; margin-bottom: 20px;">Welcome to the King Rent family, ${booking.client_name}!</p>
            
            <p style="font-size: 16px; line-height: 1.8; margin-bottom: 20px;">
              We're thrilled that you've chosen King Rent for your luxury vehicle rental. Your premium experience begins here.
            </p>
            
            <div style="height: 2px; background: linear-gradient(to right, transparent, #C5A572, transparent); margin: 30px 0;"></div>
            
            <div style="background-color: #f9f9f9; border-left: 4px solid #C5A572; padding: 20px; margin: 20px 0;">
              <h2 style="color: #000000; margin-top: 0; font-size: 20px;">Your Booking Details</h2>
              <table width="100%" cellpadding="8" cellspacing="0">
                <tr>
                  <td style="font-weight: bold; color: #666;">Reference:</td>
                  <td style="color: #000;">${booking.reference_code}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold; color: #666;">Vehicle:</td>
                  <td style="color: #000;">${booking.car_model}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold; color: #666;">Pickup:</td>
                  <td style="color: #000;">${booking.delivery_datetime ? new Date(booking.delivery_datetime).toLocaleString() : 'TBD'}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold; color: #666;">Return:</td>
                  <td style="color: #000;">${booking.collection_datetime ? new Date(booking.collection_datetime).toLocaleString() : 'TBD'}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold; color: #666;">Total:</td>
                  <td style="font-size: 20px; color: #C5A572; font-weight: bold;">${booking.currency} ${booking.amount_total}</td>
                </tr>
              </table>
            </div>
            
            <p style="font-size: 16px; line-height: 1.8; margin: 20px 0;">
              To finalize your reservation and unlock your exclusive booking portal, please complete your booking form:
            </p>
            
            <div style="text-align: center; margin: 40px 0;">
              <a href="${formUrl}" style="display: inline-block; background-color: #000000; color: #C5A572; padding: 15px 40px; text-decoration: none; border: 2px solid #C5A572; font-size: 18px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Complete Booking Form ✨</a>
            </div>
            
            <div style="height: 2px; background: linear-gradient(to right, transparent, #C5A572, transparent); margin: 30px 0;"></div>
            
            <p style="font-size: 13px; color: #666; line-height: 1.8;">
              <strong>⏱️ Quick & Easy:</strong> Takes only 5 minutes to complete<br>
              <strong>🔒 Secure:</strong> Your information is protected<br>
              <strong>✨ Exclusive:</strong> Access your premium client portal
            </p>
            
            <p style="font-size: 12px; color: #999; margin-top: 30px;">
              If the button doesn't work, copy this link: <a href="${formUrl}" style="color: #C5A572; word-break: break-all;">${formUrl}</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="background-color: #f5f5f5; padding: 30px; text-align: center; border-top: 3px solid #C5A572;">
            <p style="font-family: 'Playfair Display', serif; font-size: 18px; color: #000; margin: 0 0 10px;">${companyName}</p>
            <p style="color: #C5A572; font-size: 12px; font-style: italic; margin: 0 0 15px;">Your satisfaction is our priority</p>
            ${companyAddress ? `<p style="font-size: 12px; color: #666; margin: 5px 0;">${companyAddress}</p>` : ''}
            ${companyPhone ? `<p style="font-size: 12px; color: #666; margin: 5px 0;">📞 ${companyPhone}</p>` : ''}
            ${companyEmail ? `<p style="font-size: 12px; color: #666; margin: 5px 0;">✉️ ${companyEmail}</p>` : ''}
            <p style="font-size: 11px; color: #999; margin-top: 20px;">🔒 Secure Payment • ✅ Verified Service • ⭐ Premium Experience</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}
