import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getBookingConfirmedEmail, getEmailSubject } from "../_shared/email-templates.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const generateReceiptAndSendEmail = async (
  paymentId: string, 
  supabaseClient: any, 
  bookingUpdateType: 'initial_confirmation' | 'additional_payment' = 'additional_payment'
) => {
  try {
    console.log('Sending payment confirmation email for payment:', paymentId, 'Type:', bookingUpdateType);
    
    // Fetch payment and booking details
    const { data: payment, error: paymentError } = await supabaseClient
      .from('payments')
      .select('*, booking_id')
      .eq('id', paymentId)
      .single();

    if (paymentError || !payment) {
      console.error('Error fetching payment for email:', paymentError);
      return;
    }

    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select('*')
      .eq('id', payment.booking_id)
      .single();

    if (bookingError || !booking || !booking.client_email) {
      console.error('Error fetching booking or no client email:', bookingError);
      return;
    }

    // CRITICAL IDEMPOTENCY CHECK: Prevent duplicate emails
    if (bookingUpdateType === 'initial_confirmation' && booking.booking_confirmation_pdf_sent_at) {
      console.log('Booking confirmation already sent at:', booking.booking_confirmation_pdf_sent_at, '- Skipping duplicate');
      return;
    }

    if (bookingUpdateType === 'additional_payment' && payment.confirmation_email_sent_at) {
      console.log('Payment confirmation already sent at:', payment.confirmation_email_sent_at, '- Skipping duplicate');
      return;
    }

    const { data: appSettings } = await supabaseClient
      .from('app_settings')
      .select('*')
      .limit(1)
      .single();

    const companyName = appSettings?.company_name || 'BookRentManager';
    const remainingBalance = booking.amount_total - booking.amount_paid;

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

    console.log('Portal URL generated:', portalUrl);

    // Format booking data for email template
    const bookingDetails = {
      reference_code: booking.reference_code,
      client_name: booking.client_name,
      car_model: booking.car_model,
      pickup_date: new Date(booking.delivery_datetime).toLocaleDateString(),
      return_date: new Date(booking.collection_datetime).toLocaleDateString(),
      pickup_location: booking.delivery_location,
      return_location: booking.collection_location,
      amount_total: booking.amount_total,
      amount_paid: booking.amount_paid,
    };

    // Generate email HTML using template - different for initial confirmation vs additional payment
    const emailHtml = getBookingConfirmedEmail(bookingDetails, portalUrl);
    const emailSubject = bookingUpdateType === 'initial_confirmation'
      ? getEmailSubject('booking_confirmed', booking.reference_code)
      : `Payment Received - ${booking.reference_code}`;

    const { error: emailError } = await supabaseClient.functions.invoke('send-gmail', {
      body: {
        to: booking.client_email,
        subject: emailSubject,
        html: emailHtml,
      }
    });

    if (emailError) {
      console.error('Error sending receipt email:', emailError);
    } else {
      console.log('Receipt email sent successfully to:', booking.client_email);
      
      // Update payment record
      await supabaseClient
        .from('payments')
        .update({ 
          confirmation_email_sent_at: new Date().toISOString()
        })
        .eq('id', paymentId);

      // Update booking
      await supabaseClient
        .from('bookings')
        .update({ 
          booking_confirmation_pdf_sent_at: new Date().toISOString() 
        })
        .eq('id', payment.booking_id);

      // Send notification to admin
      const adminEmail = appSettings?.company_email || Deno.env.get('BOOKING_EMAIL_ADDRESS');
      if (adminEmail && adminEmail !== booking.client_email) {
        const adminEmailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">New Booking Confirmation - ${booking.reference_code}</h2>
            <p><strong>Client:</strong> ${booking.client_name}</p>
            <p><strong>Email:</strong> ${booking.client_email}</p>
            <p><strong>Amount Paid:</strong> ${payment.currency} ${payment.amount.toFixed(2)}</p>
            <p><strong>Status:</strong> ${booking.status}</p>
            <p><strong>Vehicle:</strong> ${booking.car_model}</p>
            <p><strong>Client Portal:</strong> <a href="${portalUrl}" style="color: #10b981;">View Portal</a></p>
          </div>
        `;
        
        await supabaseClient.functions.invoke('send-gmail', {
          body: {
            to: adminEmail,
            subject: `Booking Confirmed: ${booking.reference_code} - ${booking.client_name}`,
            html: adminEmailHtml,
          }
        }).catch((err: any) => {
          console.error('Failed to send admin notification:', err);
        });
      }
    }
  } catch (error) {
    console.error('Error in generateReceiptAndSendEmail:', error);
    throw error;
  }
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

    const { payment_id, booking_update_type } = await req.json();
    
    if (!payment_id) {
      throw new Error('Missing payment_id');
    }

    console.log('Processing payment confirmation for:', payment_id, 'Type:', booking_update_type);

    await generateReceiptAndSendEmail(payment_id, supabaseClient, booking_update_type || 'additional_payment');

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in send-payment-confirmation:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
