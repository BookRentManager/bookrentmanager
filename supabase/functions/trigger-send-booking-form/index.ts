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
  const companyName = settings?.company_name || 'BookRent Manager';
  const companyAddress = settings?.company_address || '';
  const companyPhone = settings?.company_phone || '';
  const companyEmail = settings?.company_email || '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Complete Your Booking Form</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="margin: 0; font-size: 28px;">Complete Your Booking Form</h1>
      </div>
      
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; margin-bottom: 20px;">Dear ${booking.client_name},</p>
        
        <p style="font-size: 16px; margin-bottom: 20px;">
          Thank you for your booking! To finalize your reservation, please complete the booking form by clicking the button below.
        </p>
        
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #667eea; margin-top: 0;">Booking Details</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Booking Reference:</td>
              <td style="padding: 8px 0;">${booking.reference_code}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Vehicle:</td>
              <td style="padding: 8px 0;">${booking.car_model}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Delivery:</td>
              <td style="padding: 8px 0;">${booking.delivery_datetime ? new Date(booking.delivery_datetime).toLocaleString() : 'TBD'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Collection:</td>
              <td style="padding: 8px 0;">${booking.collection_datetime ? new Date(booking.collection_datetime).toLocaleString() : 'TBD'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Total Amount:</td>
              <td style="padding: 8px 0; font-size: 18px; font-weight: bold; color: #667eea;">${booking.currency} ${booking.amount_total}</td>
            </tr>
          </table>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${formUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-size: 18px; font-weight: bold;">
            Complete Booking Form
          </a>
        </div>
        
        <p style="font-size: 14px; color: #666; margin-top: 30px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${formUrl}" style="color: #667eea; word-break: break-all;">${formUrl}</a>
        </p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 14px; color: #666;">
          <p style="margin: 5px 0;"><strong>${companyName}</strong></p>
          ${companyAddress ? `<p style="margin: 5px 0;">${companyAddress}</p>` : ''}
          ${companyPhone ? `<p style="margin: 5px 0;">Phone: ${companyPhone}</p>` : ''}
          ${companyEmail ? `<p style="margin: 5px 0;">Email: ${companyEmail}</p>` : ''}
        </div>
      </div>
    </body>
    </html>
  `;
}
