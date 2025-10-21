import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { booking_id } = await req.json();

    if (!booking_id) {
      throw new Error('booking_id is required');
    }

    console.log('Fetching booking:', booking_id);

    // Get booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      throw new Error('Booking not found');
    }

    // Generate secure token
    const { data: tokenData, error: tokenError } = await supabase
      .rpc('generate_booking_token', { p_booking_id: booking_id });

    if (tokenError) {
      throw new Error('Failed to generate token');
    }

    const token = tokenData;
    // Use APP_DOMAIN if set, otherwise fall back to Supabase URL
    const appDomain = Deno.env.get('APP_DOMAIN') || 
      Deno.env.get('SUPABASE_URL')?.replace('/v1', '') || '';
    const formUrl = `${appDomain}/booking-form/${token}`;

    console.log('Generated token, form URL:', formUrl);

    // Get app settings for company info
    const { data: settings } = await supabase
      .from('app_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    // Create email using template
    const emailHtml = getBookingFormEmail(booking, formUrl, settings);

    console.log('Sending email to:', booking.client_email);

    // Send email via Gmail
    const { error: emailError } = await supabase.functions.invoke('send-gmail', {
      body: {
        to: booking.client_email,
        subject: `Complete Your Booking - ${booking.reference_code}`,
        html: emailHtml,
      },
    });

    if (emailError) {
      console.error('Failed to send email:', emailError);
      throw new Error('Failed to send email');
    }

    // Update booking
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ booking_form_sent_at: new Date().toISOString() })
      .eq('id', booking_id);

    if (updateError) {
      console.error('Failed to update booking:', updateError);
    }

    console.log('Booking form email sent successfully');

    return new Response(
      JSON.stringify({ success: true, form_url: formUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-booking-form-email:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getBookingFormEmail(booking: any, formUrl: string, settings: any): string {
  const companyName = settings?.company_name || 'KingRent';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        body { margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #000000; color: #C5A572; padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0; border-bottom: 2px solid #C5A572; }
        .crown { font-size: 32px; margin-bottom: 10px; display: block; }
        .content { background: #ffffff; padding: 30px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; }
        .footer { background: #000000; color: #C5A572; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #C5A572; }
        .button { display: inline-block; background: #000000; color: #C5A572; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; border: 2px solid #C5A572; transition: all 0.3s ease; }
        .button:hover { background: #C5A572; color: #000000; }
        .info-box { background: #fafafa; border-left: 4px solid #C5A572; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .warning-box { background: #fffbf0; border-left: 4px solid #C5A572; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .detail-row { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
        h1 { margin: 0; font-size: 28px; font-family: 'Playfair Display', Georgia, serif; font-weight: 700; }
        h2 { color: #1f2937; font-size: 20px; margin-top: 0; font-family: 'Playfair Display', Georgia, serif; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="${Deno.env.get("VITE_SUPABASE_URL")}/storage/v1/object/public/crown.png" alt="King Rent Crown" style="height: 50px; display: block; margin: 0 auto 10px auto;" />
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
            <div class="detail-row"><strong>Pickup:</strong> ${new Date(booking.delivery_datetime).toLocaleString('en-GB')}</div>
            <div class="detail-row"><strong>Return:</strong> ${new Date(booking.collection_datetime).toLocaleString('en-GB')}</div>
            <div class="detail-row"><strong>Total Amount:</strong> €${Number(booking.amount_total).toLocaleString()}</div>
            <div class="detail-row"><strong>Security Deposit:</strong> €${Number(booking.security_deposit_amount || 0).toLocaleString()} <em>(hold before pickup)</em></div>
          </div>

          <div style="text-align: center;">
            <a href="${formUrl}" class="button" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%); color: #C5A572; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 16px; margin: 20px 0; border: 2px solid #C5A572; box-shadow: 0 4px 15px rgba(197, 165, 114, 0.3); text-transform: uppercase; letter-spacing: 0.5px;">Complete Booking Form ✨</a>
          </div>

          <div class="warning-box">
            <strong>💼 Your Booking Journey:</strong><br>
            <ol style="margin: 10px 0 0 0; padding-left: 20px; line-height: 2;">
              <li><strong>Review & Sign</strong> - Quick digital signature (2 mins)</li>
              <li><strong>Down Payment</strong> - ${booking.payment_amount_percent}% (€${((booking.amount_total * (booking.payment_amount_percent || 0)) / 100).toFixed(2)}) securely confirms your reservation</li>
              <li><strong>Balance Payment</strong> - Remaining amount before your luxury experience begins</li>
              <li><strong>Security Deposit</strong> - €${Number(booking.security_deposit_amount || 0).toLocaleString()} temporary hold (released after rental)</li>
            </ol>
          </div>

          <p style="margin-top: 30px; color: #6b7280; font-size: 14px; text-align: center;">
            <strong>Your dedicated team is here to assist you.</strong><br/>
            This secure link is valid for 30 days. Questions? We're just a message away!
          </p>
        </div>
        
        <div class="footer">
          <p style="margin: 0 0 10px 0; font-style: italic; font-size: 13px; color: #C5A572;">Premium Car Rental Excellence</p>
          <p style="margin: 0; font-size: 14px;">
            ${companyName}<br>
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