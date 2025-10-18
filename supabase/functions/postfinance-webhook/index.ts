import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const generateReceiptAndSendEmail = async (paymentId: string, supabaseClient: any) => {
  try {
    console.log('Generating receipt for payment:', paymentId);
    
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

    // Fetch payment and booking details for email
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

    const { data: appSettings } = await supabaseClient
      .from('app_settings')
      .select('*')
      .limit(1)
      .single();

    const companyName = appSettings?.company_name || 'BookRentManager';
    const remainingBalance = booking.amount_total - booking.amount_paid;

    // Send email with receipt
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Payment Receipt</h2>
        <p>Dear ${booking.client_name},</p>
        <p>Thank you for your payment. Please find your payment receipt attached.</p>
        
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
          ? '<p style="color: #10b981; font-weight: bold;">Your booking is confirmed!</p>'
          : ''
        }

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
      console.log('Receipt email sent successfully');
      
      // Update payment record to mark receipt as sent
      await supabaseClient
        .from('payments')
        .update({ receipt_sent_at: new Date().toISOString() })
        .eq('id', paymentId);
    }
  } catch (error) {
    console.error('Error in generateReceiptAndSendEmail:', error);
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

        // Update booking
        await supabaseClient
          .from('bookings')
          .update({
            security_deposit_authorized_at: new Date().toISOString(),
            security_deposit_authorization_id: payment.id,
          })
          .eq('id', authorization.booking_id);

        console.log('Security deposit authorization recorded');
      }

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

    // Generate receipt and send email for successful payments (in background)
    if (event.type === 'payment.succeeded') {
      console.log('Triggering receipt generation for payment:', payment.id);
      generateReceiptAndSendEmail(payment.id, supabaseClient).catch(err => {
        console.error('Background receipt generation failed:', err);
        // Log error to audit_logs
        supabaseClient.from('audit_logs').insert({
          entity: 'payment',
          entity_id: payment.id,
          action: 'receipt_generation_failed',
          payload_snapshot: { error: err.message, timestamp: new Date().toISOString() }
        });
      });
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
