import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const generateReceiptAndSendEmail = async (paymentId: string, supabaseClient: any) => {
  try {
    console.log('=== Starting receipt generation and email sending for payment:', paymentId);
    
    // Generate receipt PDF
    console.log('Step 1: Invoking generate-payment-receipt function...');
    const { data: receiptData, error: receiptError } = await supabaseClient.functions.invoke(
      'generate-payment-receipt',
      {
        body: { payment_id: paymentId }
      }
    );

    if (receiptError) {
      console.error('!!! Error generating receipt:', receiptError);
      return;
    }

    console.log('✓ Receipt generated successfully:', receiptData?.receipt_url);

    // Fetch payment and booking details BEFORE generating booking confirmation
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
    console.log('Step 2: Invoking generate-booking-confirmation function for booking:', payment.booking_id);
    const { data: confirmationData, error: confirmationError } = await supabaseClient.functions.invoke(
      'generate-booking-confirmation',
      {
        body: { booking_id: payment.booking_id }
      }
    );

    if (confirmationError) {
      console.error('!!! Error generating booking confirmation:', confirmationError);
      // Don't fail - continue with just receipt
    } else {
      console.log('✓ Booking confirmation generated successfully:', confirmationData?.confirmation_url);
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

    console.log('Step 3: Sending confirmation email to client:', booking.client_email);
    const { error: emailError } = await supabaseClient.functions.invoke('send-gmail', {
      body: {
        to: booking.client_email,
        subject: `Payment Receipt - ${booking.reference_code}`,
        html: emailHtml,
      }
    });

    if (emailError) {
      console.error('!!! Error sending receipt email:', emailError);
    } else {
      console.log('✓ Receipt email sent successfully to client');
      
      // Update payment record to mark receipt as sent and confirmation email sent
      await supabaseClient
        .from('payments')
        .update({ 
          receipt_sent_at: new Date().toISOString(),
          confirmation_email_sent_at: new Date().toISOString()
        })
        .eq('id', paymentId);

      // Update booking to mark confirmation PDF sent
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
        console.log('Step 4: Sending notification to admin:', adminEmail);
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
        }).then(() => {
          console.log('✓ Admin notification sent successfully');
        }).catch((err: any) => {
          console.error('!!! Failed to send admin notification:', err);
        });
      }
    }
    console.log('=== Email generation and sending completed successfully ===');
  } catch (error) {
    console.error('!!! Error in generateReceiptAndSendEmail:', error);
    console.error('Error details:', error instanceof Error ? error.message : error);
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // TODO: Verify webhook signature with PostFinance secret
    const webhookSecret = Deno.env.get('POSTFINANCE_WEBHOOK_SECRET');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const event = await req.json();
    console.log('PostFinance webhook received:', JSON.stringify({ type: event.type, timestamp: new Date().toISOString() }));

    const { session_id, transaction_id, status } = event.data || {};

    if (!session_id) {
      console.error('Missing session_id in webhook event');
      throw new Error('Missing session_id in webhook');
    }

    // Find payment by session ID - support both postfinance_session_id and payment_link_id
    const { data: payment, error: paymentError } = await supabaseClient
      .from('payments')
      .select('*')
      .or(`postfinance_session_id.eq.${session_id},payment_link_id.eq.${session_id}`)
      .maybeSingle();

    if (paymentError || !payment) {
      console.error('Payment not found for session:', session_id, 'Error:', paymentError?.message);
      throw new Error('Payment not found');
    }

    console.log('Found payment:', payment.id, 'Current status:', payment.payment_link_status);

    // Idempotency check - prevent duplicate processing
    if (event.type === 'payment.succeeded' && payment.payment_link_status === 'paid') {
      console.log('Duplicate webhook - payment already marked as paid:', payment.id);
      return new Response(
        JSON.stringify({ received: true, message: 'Already processed (idempotent)' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (event.type === 'payment.failed' && payment.payment_link_status === 'cancelled') {
      console.log('Duplicate webhook - payment already marked as failed:', payment.id);
      return new Response(
        JSON.stringify({ received: true, message: 'Already processed (idempotent)' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Handle security deposit authorization events
    if (event.type === 'authorization.succeeded') {
      console.log('Security deposit authorization succeeded');
      
      // Update payment record to mark as authorized (NOT paid - this is an authorization)
      await supabaseClient
        .from('payments')
        .update({
          payment_link_status: 'paid', // Keep for consistency, but this means "authorized" for deposits
          paid_at: new Date().toISOString(), // This is actually "authorized_at" for deposits
        })
        .eq('id', payment.id);
      
      const { data: authorization, error: authError } = await supabaseClient
        .from('security_deposit_authorizations')
        .select('*')
        .eq('authorization_id', payment.id)
        .single();

      if (!authError && authorization) {
        await supabaseClient
          .from('security_deposit_authorizations')
          .update({
            status: 'authorized',
            authorized_at: new Date().toISOString(),
          })
          .eq('id', authorization.id);

        // Update booking with security deposit authorization
        await supabaseClient
          .from('bookings')
          .update({
            security_deposit_authorized_at: new Date().toISOString(),
            security_deposit_authorization_id: payment.id,
          })
          .eq('id', authorization.booking_id);

        console.log('Security deposit authorization recorded successfully');
      }

      // DON'T trigger receipt generation for authorizations
      return new Response(
        JSON.stringify({ received: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (event.type === 'authorization.expired') {
      console.log('Security deposit authorization expired');
      
      const { data: authorization } = await supabaseClient
        .from('security_deposit_authorizations')
        .select('*, bookings(reference_code, client_email)')
        .eq('authorization_id', payment.id)
        .single();

      if (authorization) {
        await supabaseClient
          .from('security_deposit_authorizations')
          .update({ status: 'expired' })
          .eq('id', authorization.id);

        // Send admin alert
        await supabaseClient.from('audit_logs').insert({
          entity: 'security_deposit_authorization',
          entity_id: authorization.id,
          action: 'expired',
          payload_snapshot: {
            booking_reference: authorization.bookings.reference_code,
            amount: authorization.amount,
          },
        });

        console.log('Security deposit authorization expired recorded');
      }

      return new Response(
        JSON.stringify({ received: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (event.type === 'capture.succeeded') {
      console.log('Security deposit capture succeeded');
      
      const { data: authorization } = await supabaseClient
        .from('security_deposit_authorizations')
        .select('*')
        .eq('authorization_id', payment.id)
        .single();

      if (authorization) {
        // This should already be updated by the capture-security-deposit function
        console.log('Capture confirmation received from PostFinance');
      }

      return new Response(
        JSON.stringify({ received: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Update payment based on event type
    let updateData: any = {};

    switch (event.type) {
      case 'payment.succeeded':
        updateData = {
          payment_link_status: 'paid',
          paid_at: new Date().toISOString(),
          postfinance_transaction_id: transaction_id,
        };
        console.log('Payment succeeded, updating status to paid');
        break;

      case 'payment.failed':
        updateData = {
          payment_link_status: 'cancelled',
        };
        console.log('Payment failed, updating status to cancelled');
        break;

      case 'session.expired':
        updateData = {
          payment_link_status: 'expired',
        };
        console.log('Session expired, updating status to expired');
        break;

      default:
        console.log('Unhandled event type:', event.type);
        return new Response(
          JSON.stringify({ received: true, message: 'Event type not handled' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
    }

    // Update payment record
    const { error: updateError } = await supabaseClient
      .from('payments')
      .update(updateData)
      .eq('id', payment.id);

    if (updateError) {
      console.error('Payment update error:', updateError);
      throw updateError;
    }

    console.log('Payment updated successfully:', payment.id, 'New status:', updateData.payment_link_status);

    // Generate receipt and send email for successful PAYMENTS ONLY (not authorizations)
    if (event.type === 'payment.succeeded' && payment.payment_intent !== 'security_deposit') {
      console.log('Triggering receipt generation for payment:', payment.id);
      generateReceiptAndSendEmail(payment.id, supabaseClient).catch(err => {
        console.error('Background receipt generation failed:', err);
        supabaseClient.from('audit_logs').insert({
          entity: 'payment',
          entity_id: payment.id,
          action: 'receipt_generation_failed',
          payload_snapshot: { error: err.message, timestamp: new Date().toISOString() }
        });
      });
    } else if (event.type === 'payment.succeeded' && payment.payment_intent === 'security_deposit') {
      console.log('Security deposit authorized - no receipt needed');
    }

    // The trigger will automatically update the booking status

    return new Response(
      JSON.stringify({ received: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
