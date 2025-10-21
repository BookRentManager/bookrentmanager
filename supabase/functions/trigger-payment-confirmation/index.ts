import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  payment_id: string;
  booking_update_type?: 'initial_confirmation' | 'additional_payment';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { payment_id, booking_update_type = 'additional_payment' }: RequestBody = await req.json();

    if (!payment_id) {
      throw new Error('payment_id is required');
    }

    console.log('Processing payment confirmation for:', payment_id, 'Type:', booking_update_type);

    // Fetch payment details
    const { data: payment, error: paymentError } = await supabaseClient
      .from('payments')
      .select('*')
      .eq('id', payment_id)
      .single();

    if (paymentError || !payment) {
      throw new Error(`Failed to fetch payment: ${paymentError?.message || 'Payment not found'}`);
    }

    // Check if confirmation email was already sent
    if (payment.confirmation_email_sent_at) {
      console.log('Confirmation email already sent, skipping');
      return new Response(
        JSON.stringify({ message: 'Confirmation email already sent' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Fetch booking details
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select('*')
      .eq('id', payment.booking_id)
      .single();

    if (bookingError || !booking) {
      throw new Error(`Failed to fetch booking: ${bookingError?.message || 'Booking not found'}`);
    }

    // Fetch app settings for admin email
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
      .single();

    let accessToken = existingToken?.token;
    if (!accessToken) {
      const { data: tokenData } = await supabaseClient.rpc('generate_booking_token', {
        p_booking_id: booking.id
      });
      accessToken = tokenData;
    }

    const appDomain = Deno.env.get('APP_DOMAIN') || 'https://bookrentmanager.com';
    const portalUrl = `${appDomain}/client-portal/${accessToken}`;
    
    console.log('Portal URL generated:', portalUrl);

    // Generate PDFs
    console.log('Generating payment receipt PDF...');
    const { data: receiptData, error: receiptError } = await supabaseClient.functions.invoke(
      'generate-payment-receipt',
      { body: { payment_id: payment.id } }
    );

    if (receiptError || !receiptData?.receipt_url) {
      console.error('Failed to generate payment receipt:', receiptError);
      throw new Error('Failed to generate payment receipt PDF');
    }

    console.log('Payment receipt generated:', receiptData.receipt_url);

    // Generate booking confirmation PDF
    console.log('Generating booking confirmation PDF...');
    const { data: confirmationData, error: confirmationError } = await supabaseClient.functions.invoke(
      'generate-booking-confirmation',
      { body: { booking_id: booking.id } }
    );

    if (confirmationError || !confirmationData?.confirmation_url) {
      console.error('Failed to generate booking confirmation:', confirmationError);
      throw new Error('Failed to generate booking confirmation PDF');
    }

    console.log('Booking confirmation generated:', confirmationData.confirmation_url);

    // Format email content
    const isInitialConfirmation = booking_update_type === 'initial_confirmation';
    const emailSubject = isInitialConfirmation
      ? `Booking Confirmed - ${booking.reference_code}`
      : `Payment Received - ${booking.reference_code}`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9fafb; padding: 30px; }
          .booking-details { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .label { font-weight: bold; color: #6b7280; }
          .value { color: #111827; }
          .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${isInitialConfirmation ? '🎉 Booking Confirmed!' : '💰 Payment Received'}</h1>
          </div>
          
          <div class="content">
            <p>Dear ${booking.client_name},</p>
            
            ${isInitialConfirmation 
              ? `<p>Great news! Your booking has been confirmed. We've received your payment and everything is set for your rental.</p>`
              : `<p>We've successfully received your payment. Thank you for completing this transaction.</p>`
            }
            
            <div class="booking-details">
              <h3>Booking Details</h3>
              <div class="detail-row">
                <span class="label">Booking Reference:</span>
                <span class="value">${booking.reference_code}</span>
              </div>
              <div class="detail-row">
                <span class="label">Vehicle:</span>
                <span class="value">${booking.car_model} (${booking.car_plate})</span>
              </div>
              <div class="detail-row">
                <span class="label">Pickup:</span>
                <span class="value">${new Date(booking.delivery_datetime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>
              <div class="detail-row">
                <span class="label">Return:</span>
                <span class="value">${new Date(booking.collection_datetime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>
            </div>

            <div class="booking-details">
              <h3>Payment Information</h3>
              <div class="detail-row">
                <span class="label">Amount Paid:</span>
                <span class="value">${payment.currency} ${payment.total_amount?.toFixed(2) || payment.amount.toFixed(2)}</span>
              </div>
              <div class="detail-row">
                <span class="label">Payment Method:</span>
                <span class="value">${payment.method}</span>
              </div>
              <div class="detail-row">
                <span class="label">Total Booking Cost:</span>
                <span class="value">${booking.currency} ${booking.amount_total.toFixed(2)}</span>
              </div>
              <div class="detail-row">
                <span class="label">Total Paid:</span>
                <span class="value">${booking.currency} ${booking.amount_paid.toFixed(2)}</span>
              </div>
              <div class="detail-row">
                <span class="label">Balance Remaining:</span>
                <span class="value">${booking.currency} ${(booking.amount_total - booking.amount_paid).toFixed(2)}</span>
              </div>
            </div>

            <p style="text-align: center;">
              <a href="${portalUrl}" class="button">View Your Booking Portal</a>
            </p>

            <p>Your payment receipt and booking confirmation are attached to this email. You can also access all your booking documents through the client portal.</p>
            
            ${isInitialConfirmation 
              ? `<p>We're looking forward to serving you! If you have any questions, please don't hesitate to contact us.</p>`
              : `<p>Thank you for your payment. If you have any questions, please contact us.</p>`
            }
            
            <p>Best regards,<br>${appSettings?.company_name || 'KingRent'}</p>
          </div>
          
          <div class="footer">
            <p>${appSettings?.company_name || 'KingRent'}</p>
            ${appSettings?.company_email ? `<p>Email: ${appSettings.company_email}</p>` : ''}
            ${appSettings?.company_phone ? `<p>Phone: ${appSettings.company_phone}</p>` : ''}
          </div>
        </div>
      </body>
      </html>
    `;

    // Send webhook to Zapier
    const webhookUrl = Deno.env.get('ZAPIER_PAYMENT_CONFIRMATION_WEBHOOK_URL');
    if (!webhookUrl) {
      throw new Error('ZAPIER_PAYMENT_CONFIRMATION_WEBHOOK_URL not configured');
    }

    console.log('Sending webhook to Zapier...');

    const webhookPayload = {
      // Email recipients
      client_email: booking.client_email,
      client_name: booking.client_name,
      admin_email: appSettings?.company_email || '',
      
      // Email content
      email_subject: emailSubject,
      email_html: emailHtml,
      
      // PDF attachments
      payment_receipt_url: receiptData.receipt_url,
      booking_confirmation_url: confirmationData.confirmation_url,
      
      // Additional data
      booking_reference: booking.reference_code,
      portal_url: portalUrl,
      
      // Booking details
      booking_details: {
        reference: booking.reference_code,
        car_model: booking.car_model,
        car_plate: booking.car_plate,
        delivery_datetime: booking.delivery_datetime,
        collection_datetime: booking.collection_datetime,
        delivery_location: booking.delivery_location,
        collection_location: booking.collection_location,
        amount_total: booking.amount_total,
        amount_paid: booking.amount_paid,
        currency: booking.currency,
      },
      
      // Payment details
      payment_details: {
        amount: payment.amount,
        total_amount: payment.total_amount || payment.amount,
        currency: payment.currency,
        method: payment.method,
        payment_method_type: payment.payment_method_type,
        paid_at: payment.paid_at,
      },
      
      // Metadata
      booking_update_type,
      timestamp: new Date().toISOString(),
    };

    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload),
    });

    if (!webhookResponse.ok) {
      console.error('Zapier webhook failed:', await webhookResponse.text());
      throw new Error('Failed to send webhook to Zapier');
    }

    console.log('Zapier webhook sent successfully');

    // Update payment record to mark confirmation email as sent
    const { error: updateError } = await supabaseClient
      .from('payments')
      .update({ 
        confirmation_email_sent_at: new Date().toISOString(),
        receipt_sent_at: new Date().toISOString(),
      })
      .eq('id', payment_id);

    if (updateError) {
      console.error('Failed to update payment confirmation timestamp:', updateError);
    }

    // Update booking record with PDF URL
    const { error: bookingUpdateError } = await supabaseClient
      .from('bookings')
      .update({ 
        booking_confirmation_pdf_sent_at: new Date().toISOString(),
        confirmation_pdf_url: confirmationData.confirmation_url,
      })
      .eq('id', booking.id);

    if (bookingUpdateError) {
      console.error('Failed to update booking confirmation timestamp:', bookingUpdateError);
    }

    console.log('Payment confirmation process completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Payment confirmation sent successfully',
        receipt_url: receiptData.receipt_url,
        confirmation_url: confirmationData.confirmation_url,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in payment confirmation:', error);
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
