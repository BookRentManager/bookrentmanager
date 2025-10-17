import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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

    // Check if booking has email and is in draft status
    if (!booking.client_email) {
      throw new Error('Booking has no client email');
    }

    // Generate cryptographically secure token using database function
    const { data: tokenData, error: tokenError } = await supabaseClient
      .rpc('generate_booking_token', { p_booking_id: booking_id });

    if (tokenError || !tokenData) {
      throw new Error(`Failed to generate token: ${tokenError?.message}`);
    }

    const token = tokenData;
    console.log('Generated token for booking:', booking.reference_code);

    // Create form URL - use APP_DOMAIN if set, otherwise fall back to Supabase URL
    const appDomain = Deno.env.get('APP_DOMAIN') || 
      Deno.env.get('SUPABASE_URL')?.replace('/v1', '') || '';
    const formUrl = `${appDomain}/booking-form/${token}`;

    // Fetch app settings for company info
    const { data: appSettings } = await supabaseClient
      .from('app_settings')
      .select('*')
      .limit(1)
      .single();

    const companyName = appSettings?.company_name || 'BookRentManager';

    // Send booking confirmation email using styled template
    const emailHtml = getBookingFormEmail(booking, formUrl, appSettings);

    const { error: emailError } = await supabaseClient.functions.invoke('send-gmail', {
      body: {
        to: booking.client_email,
        subject: `Complete Your Booking - ${booking.reference_code}`,
        html: emailHtml,
      }
    });

    if (emailError) {
      console.error('Failed to send email:', emailError);
      throw new Error(`Failed to send email: ${emailError.message}`);
    }

    console.log('Email sent successfully to:', booking.client_email);

    // Update booking to mark form as sent
    const { error: updateError } = await supabaseClient
      .from('bookings')
      .update({ booking_form_sent_at: new Date().toISOString() })
      .eq('id', booking_id);

    if (updateError) {
      console.error('Failed to update booking:', updateError);
    }

    // Log action in audit_logs
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

function getBookingFormEmail(booking: any, formUrl: string, settings: any): string {
  const companyName = settings?.company_name || 'KingRent';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #ffffff; padding: 30px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; }
        .button { display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
        .info-box { background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .warning-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .detail-row { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
        h1 { margin: 0; font-size: 24px; }
        h2 { color: #1f2937; font-size: 20px; margin-top: 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✓ Complete Your Booking</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.95;">Booking Reference: ${booking.reference_code}</p>
        </div>
        
        <div class="content">
          <h2>Hello ${booking.client_name},</h2>
          
          <p>Thank you for choosing ${companyName}! To confirm your reservation, please complete the booking form by reviewing the details, accepting our terms and conditions, and providing your digital signature.</p>
          
          <div class="info-box">
            <strong>📋 Booking Summary</strong><br>
            <div class="detail-row"><strong>Vehicle:</strong> ${booking.car_model}</div>
            <div class="detail-row"><strong>Pickup:</strong> ${new Date(booking.delivery_datetime).toLocaleString('en-GB')}</div>
            <div class="detail-row"><strong>Return:</strong> ${new Date(booking.collection_datetime).toLocaleString('en-GB')}</div>
            <div class="detail-row"><strong>Total Amount:</strong> ${booking.currency}${Number(booking.amount_total).toLocaleString()}</div>
            <div class="detail-row"><strong>Security Deposit:</strong> ${booking.currency}${Number(booking.security_deposit_amount || 0).toLocaleString()} <em>(hold before pickup)</em></div>
          </div>

          <div style="text-align: center;">
            <a href="${formUrl}" class="button">Complete Booking Form</a>
          </div>

          <div class="warning-box">
            <strong>⚠️ Important Next Steps:</strong><br>
            <ol style="margin: 10px 0 0 0; padding-left: 20px;">
              <li><strong>Complete the form</strong> - Review details and sign</li>
              <li><strong>Down payment</strong> - ${booking.payment_amount_percent || 0}% (${booking.currency}${((booking.amount_total * (booking.payment_amount_percent || 0)) / 100).toFixed(2)}) to confirm your booking</li>
              <li><strong>Balance payment</strong> - Remaining amount before pickup (if any)</li>
              <li><strong>Security deposit</strong> - ${booking.currency}${Number(booking.security_deposit_amount || 0).toLocaleString()} authorization before pickup</li>
            </ol>
          </div>

          <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">
            This link is valid for 30 days. If you have any questions, please don't hesitate to contact us.
          </p>
        </div>
        
        <div class="footer">
          <p style="margin: 0; color: #6b7280; font-size: 14px;">
            ${companyName}<br>
            ${settings?.company_email || ''} | ${settings?.company_phone || ''}
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}
