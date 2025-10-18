import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const generateReceiptAndSendEmail = async (paymentId: string, supabaseClient: any) => {
  try {
    console.log('Generating receipt and booking confirmation for payment:', paymentId);
    
    // Generate receipt PDF
    const { data: receiptData, error: receiptError } = await supabaseClient.functions.invoke(
      'generate-payment-receipt',
      {
        body: { payment_id: paymentId }
      }
    );

    if (receiptError) {
      console.error('Error generating receipt:', receiptError);
      return;
    }

    console.log('Receipt generated:', receiptData?.receipt_url);

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

    // Generate booking confirmation PDF
    console.log('Generating booking confirmation PDF for booking:', payment.booking_id);
    const { data: confirmationData, error: confirmationError } = await supabaseClient.functions.invoke(
      'generate-booking-confirmation',
      {
        body: { booking_id: payment.booking_id }
      }
    );

    if (confirmationError) {
      console.error('Error generating booking confirmation:', confirmationError);
    } else {
      console.log('Booking confirmation generated:', confirmationData?.confirmation_url);
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

    const { data: appSettings } = await supabaseClient
      .from('app_settings')
      .select('*')
      .limit(1)
      .single();

    const companyName = appSettings?.company_name || 'BookRentManager';
    const remainingBalance = booking.amount_total - booking.amount_paid;

    // Send email with receipt and booking confirmation
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Payment Confirmation & Booking Details</h2>
        <p>Dear ${booking.client_name},</p>
        <p>Thank you for your payment. Your booking is now confirmed!</p>
        
        ${booking.guest_name ? `
          <div style="background-color: #e0f2fe; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h4 style="margin-top: 0; color: #0369a1;">Guest Information</h4>
            <p style="margin: 5px 0;"><strong>Name:</strong> ${booking.guest_name}</p>
            ${booking.guest_country ? `<p style="margin: 5px 0;"><strong>Country:</strong> ${booking.guest_country}</p>` : ''}
            ${booking.guest_phone ? `<p style="margin: 5px 0;"><strong>Phone:</strong> ${booking.guest_phone}</p>` : ''}
          </div>
        ` : ''}
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Payment Summary</h3>
          <p><strong>Booking Reference:</strong> ${booking.reference_code}</p>
          <p><strong>Amount Paid:</strong> ${payment.currency} ${payment.amount.toFixed(2)}</p>
          <p><strong>Payment Method:</strong> ${payment.payment_method_type || payment.method}</p>
          ${payment.postfinance_transaction_id ? `<p><strong>Transaction ID:</strong> ${payment.postfinance_transaction_id}</p>` : ''}
          <p><strong>Total Booking Amount:</strong> ${booking.currency} ${booking.amount_total.toFixed(2)}</p>
          <p><strong>Total Paid:</strong> ${booking.currency} ${booking.amount_paid.toFixed(2)}</p>
          <p><strong>Remaining Balance:</strong> ${booking.currency} ${remainingBalance.toFixed(2)}</p>
        </div>

        ${remainingBalance === 0 
          ? '<div style="background-color: #d1fae5; color: #065f46; padding: 15px; border-radius: 8px; margin: 20px 0;"><strong>✓ Your booking is now fully paid!</strong></div>'
          : `<div style="background-color: #fef3c7; color: #92400e; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <strong>Remaining balance:</strong> ${booking.currency} ${remainingBalance.toFixed(2)} is due.
            </div>`
        }

        ${booking.status === 'confirmed' 
          ? '<p style="color: #10b981; font-weight: bold;">✓ Your booking is confirmed!</p>'
          : ''
        }

        <div style="margin: 30px 0;">
          <h3>Your Documents</h3>
          <p>Please find your documents below:</p>
          <ul style="list-style: none; padding: 0;">
            ${receiptData?.receipt_url ? `
              <li style="margin: 10px 0;">
                <a href="${receiptData.receipt_url}" 
                   style="display: inline-block; background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                  📄 Download Payment Receipt
                </a>
              </li>
            ` : ''}
            ${confirmationData?.confirmation_url ? `
              <li style="margin: 10px 0;">
                <a href="${confirmationData.confirmation_url}" 
                   style="display: inline-block; background-color: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                  📋 Download Signed Booking Confirmation
                </a>
              </li>
            ` : ''}
          </ul>
        </div>

        <p>If you have any questions, please don't hesitate to contact us.</p>
        <p>Best regards,<br>${companyName}</p>
      </div>
    `;

    const { error: emailError } = await supabaseClient.functions.invoke('send-gmail', {
      body: {
        to: booking.client_email,
        subject: `Payment Receipt - ${booking.reference_code}`,
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
          receipt_sent_at: new Date().toISOString(),
          confirmation_email_sent_at: new Date().toISOString()
        })
        .eq('id', paymentId);

      // Update booking
      if (confirmationData?.confirmation_url) {
        await supabaseClient
          .from('bookings')
          .update({ 
            booking_confirmation_pdf_sent_at: new Date().toISOString() 
          })
          .eq('id', payment.booking_id);
      }

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
            <div style="margin: 20px 0;">
              <h3>Documents:</h3>
              ${receiptData?.receipt_url ? `<p><a href="${receiptData.receipt_url}" style="color: #2563eb;">Payment Receipt</a></p>` : ''}
              ${confirmationData?.confirmation_url ? `<p><a href="${confirmationData.confirmation_url}" style="color: #10b981;">Signed Booking Confirmation</a></p>` : ''}
            </div>
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

    const { payment_id } = await req.json();
    
    if (!payment_id) {
      throw new Error('Missing payment_id');
    }

    console.log('Processing payment confirmation for:', payment_id);

    await generateReceiptAndSendEmail(payment_id, supabaseClient);

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
