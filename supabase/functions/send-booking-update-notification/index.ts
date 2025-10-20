import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const { booking_id, changes } = await req.json();
    
    if (!booking_id) {
      throw new Error('Missing booking_id');
    }

    console.log('Sending booking update notification for:', booking_id);

    // Fetch booking details
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking || !booking.client_email) {
      console.error('Error fetching booking or no client email:', bookingError);
      throw new Error('Booking not found or no client email');
    }

    const { data: appSettings } = await supabaseClient
      .from('app_settings')
      .select('*')
      .limit(1)
      .single();

    const companyName = appSettings?.company_name || 'BookRentManager';

    // Get or generate access token for client portal
    let accessToken = '';
    const { data: tokenData } = await supabaseClient
      .from('booking_access_tokens')
      .select('token')
      .eq('booking_id', booking.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tokenData?.token) {
      accessToken = tokenData.token;
    } else {
      const { data: newToken } = await supabaseClient
        .rpc('generate_booking_token', { p_booking_id: booking.id });
      accessToken = newToken || '';
    }

    // Build portal URL
    const appDomain = Deno.env.get('APP_DOMAIN') || 'https://bookrentmanager.lovable.app';
    const portalUrl = `${appDomain}/client-portal/${accessToken}`;

    // Build changes summary HTML
    let changesSummary = '';
    if (changes && Object.keys(changes).length > 0) {
      changesSummary = '<ul style="margin: 16px 0; padding-left: 20px;">';
      for (const [field, value] of Object.entries(changes)) {
        const fieldName = field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        changesSummary += `<li style="margin-bottom: 8px;"><strong>${fieldName}:</strong> ${value}</li>`;
      }
      changesSummary += '</ul>';
    }

    // Generate email HTML
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Booking Updated</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            Dear ${booking.client_name},
          </p>
          
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            Your booking <strong>${booking.reference_code}</strong> has been updated by ${companyName}.
          </p>

          ${changesSummary ? `
            <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h3 style="color: #667eea; margin-top: 0;">Changes Made:</h3>
              ${changesSummary}
            </div>
          ` : ''}

          <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #667eea; margin-top: 0;">Booking Details:</h3>
            <p><strong>Reference:</strong> ${booking.reference_code}</p>
            <p><strong>Vehicle:</strong> ${booking.car_model}</p>
            <p><strong>Pick-up:</strong> ${new Date(booking.delivery_datetime).toLocaleDateString()} at ${booking.delivery_location}</p>
            <p><strong>Return:</strong> ${new Date(booking.collection_datetime).toLocaleDateString()} at ${booking.collection_location}</p>
            <p><strong>Total Amount:</strong> ${booking.currency} ${booking.amount_total.toFixed(2)}</p>
            <p><strong>Amount Paid:</strong> ${booking.currency} ${booking.amount_paid.toFixed(2)}</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${portalUrl}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; 
                      padding: 15px 40px; 
                      text-decoration: none; 
                      border-radius: 25px; 
                      font-size: 16px; 
                      font-weight: bold;
                      display: inline-block;">
              View Updated Booking
            </a>
          </div>

          <p style="font-size: 14px; color: #666; margin-top: 30px;">
            If you have any questions about these changes, please contact us.
          </p>

          <p style="font-size: 14px; color: #666; margin-top: 20px;">
            Best regards,<br>
            <strong>${companyName}</strong>
          </p>
        </div>
      </div>
    `;

    const emailSubject = `Booking ${booking.reference_code} - Updated`;

    // Send email to client
    const { error: emailError } = await supabaseClient.functions.invoke('send-gmail', {
      body: {
        to: booking.client_email,
        subject: emailSubject,
        html: emailHtml,
      }
    });

    if (emailError) {
      console.error('Error sending update email to client:', emailError);
      throw emailError;
    }

    console.log('Update email sent successfully to:', booking.client_email);

    // Send notification to admin
    const adminEmail = appSettings?.company_email || Deno.env.get('BOOKING_EMAIL_ADDRESS');
    if (adminEmail && adminEmail !== booking.client_email) {
      const adminEmailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Booking Updated - ${booking.reference_code}</h2>
          <p><strong>Client:</strong> ${booking.client_name}</p>
          <p><strong>Email:</strong> ${booking.client_email}</p>
          <p><strong>Vehicle:</strong> ${booking.car_model}</p>
          <p><strong>Status:</strong> ${booking.status}</p>
          ${changesSummary ? `
            <div>
              <h3>Changes Made:</h3>
              ${changesSummary}
            </div>
          ` : ''}
          <p><strong>Client Portal:</strong> <a href="${portalUrl}" style="color: #10b981;">View Portal</a></p>
        </div>
      `;
      
      await supabaseClient.functions.invoke('send-gmail', {
        body: {
          to: adminEmail,
          subject: `Booking Updated: ${booking.reference_code} - ${booking.client_name}`,
          html: adminEmailHtml,
        }
      }).catch((err: any) => {
        console.error('Failed to send admin notification:', err);
      });
    }

    // Update booking to mark that update notification was sent
    await supabaseClient
      .from('bookings')
      .update({ 
        updated_at: new Date().toISOString()
      })
      .eq('id', booking_id);

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in send-booking-update-notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
