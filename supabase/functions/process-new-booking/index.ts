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

    // Create form URL
    const baseUrl = Deno.env.get('SUPABASE_URL')?.replace('/v1', '') || '';
    const appDomain = baseUrl.replace('supabase.co', 'lovableproject.com');
    const formUrl = `${appDomain}/booking-form/${token}`;

    // Fetch app settings for company info
    const { data: appSettings } = await supabaseClient
      .from('app_settings')
      .select('*')
      .limit(1)
      .single();

    const companyName = appSettings?.company_name || 'BookRentManager';

    // Send booking confirmation email
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Complete Your Booking</h2>
        <p>Dear ${booking.client_name},</p>
        <p>Thank you for choosing ${companyName}! Your booking has been created and is awaiting completion.</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Booking Summary</h3>
          <p><strong>Reference:</strong> ${booking.reference_code}</p>
          <p><strong>Vehicle:</strong> ${booking.car_model}</p>
          <p><strong>Delivery:</strong> ${new Date(booking.delivery_datetime).toLocaleString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
          })}</p>
          <p><strong>Collection:</strong> ${new Date(booking.collection_datetime).toLocaleString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
          })}</p>
          <p><strong>Total Amount:</strong> ${booking.currency} ${booking.amount_total.toFixed(2)}</p>
          ${booking.security_deposit_amount > 0 
            ? `<p><strong>Security Deposit:</strong> ${booking.currency} ${booking.security_deposit_amount.toFixed(2)}</p>` 
            : ''
          }
        </div>

        <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
          <h3 style="margin-top: 0; color: #1e40af;">Next Steps</h3>
          <p>Please complete your booking by clicking the button below:</p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${formUrl}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Complete Booking Form
            </a>
          </div>
          <p style="font-size: 12px; color: #666;">This link is valid for 30 days.</p>
        </div>

        ${booking.payment_amount_percent && booking.payment_amount_percent > 0 
          ? `<div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #92400e;">
                <strong>Payment Required:</strong> ${booking.payment_amount_percent}% down payment (${booking.currency} ${((booking.amount_total * booking.payment_amount_percent) / 100).toFixed(2)}) is required to confirm your booking.
              </p>
            </div>`
          : ''
        }

        <p>If you have any questions, please don't hesitate to contact us.</p>
        <p>Best regards,<br>${companyName}</p>
      </div>
    `;

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
