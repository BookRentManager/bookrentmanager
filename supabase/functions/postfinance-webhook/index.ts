import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// REMOVED: generateReceiptAndSendEmail function
// Email sending is now handled exclusively by the database trigger calling send-payment-confirmation
// This prevents duplicate emails and consolidates email logic in one place

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Read body first to check for test mode
    const body = await req.text();
    const event = JSON.parse(body);

    // Check if this is a test/simulation transaction
    const isTestMode = event.entityId?.toString().startsWith('MOCK_') || 
                       event.state === 'TEST';

    if (!isTestMode) {
      // Real PostFinance webhook - verify signature using webhook-specific secret
      const webhookSecret = Deno.env.get('POSTFINANCE_WEBHOOK_SECRET');
      const signature = req.headers.get('x-signature');
      const timestamp = req.headers.get('x-timestamp');
      
      if (!signature || !webhookSecret || !timestamp) {
        console.error('Missing webhook signature, secret, or timestamp');
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        );
      }
      
      // Validate timestamp (prevent replay attacks - max 15 minutes old)
      const allowedOffset = 15 * 60; // 15 minutes in seconds
      const currentTime = Math.floor(Date.now() / 1000);
      const requestTimestamp = parseInt(timestamp);
      
      if (requestTimestamp < currentTime - allowedOffset) {
        console.error(`Webhook request expired - possible replay attack. Request time: ${requestTimestamp}, Current time: ${currentTime}, Diff: ${currentTime - requestTimestamp}s`);
        return new Response(
          JSON.stringify({ error: 'Request expired' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        );
      }
      
      console.log('✅ Webhook timestamp validated:', {
        request_timestamp: requestTimestamp,
        current_time: currentTime,
        age_seconds: currentTime - requestTimestamp
      });
      
      // Build data to sign: timestamp|body (PostFinance webhook format)
      const dataToSign = `${timestamp}|${body}`;
      
      // Base64 decode the webhook secret
      const decodedSecret = Uint8Array.from(atob(webhookSecret), c => c.charCodeAt(0));
      
      console.log('Webhook signature verification details:', {
        data_to_sign_format: 'timestamp|body',
        data_length: dataToSign.length,
        secret_length_bytes: decodedSecret.length,
        signature_length: signature.length,
        algorithm: 'HMAC-SHA512'
      });
      
      // Import key for HMAC-SHA512 (PostFinance uses SHA-512 for webhooks)
      const key = await crypto.subtle.importKey(
        'raw',
        decodedSecret,
        { name: 'HMAC', hash: 'SHA-512' },
        false,
        ['verify']
      );
      
      // Convert hex signature to buffer
      const signatureBuffer = Uint8Array.from(
        signature.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
      );
      
      // Verify signature
      const encoder = new TextEncoder();
      const isValid = await crypto.subtle.verify(
        'HMAC',
        key,
        signatureBuffer,
        encoder.encode(dataToSign)
      );
      
      if (!isValid) {
        console.error('Invalid webhook signature - authentication failed');
        console.error('Verification details:', {
          signature_provided: signature.substring(0, 20) + '...',
          timestamp_used: timestamp,
          body_length: body.length,
          data_signed: dataToSign.substring(0, 50) + '...'
        });
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        );
      }
      
      console.log('✅ Webhook signature verified successfully');
    } else {
      console.log('Test mode detected - skipping signature verification');
    }
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('PostFinance webhook received:', JSON.stringify({ 
      eventId: event.eventId,
      entityId: event.entityId,
      state: event.state,
      listenerEntityTechnicalName: event.listenerEntityTechnicalName,
      spaceId: event.spaceId,
      mode: isTestMode ? 'TEST' : 'PRODUCTION',
      timestamp: new Date().toISOString() 
    }));

    // Validate required fields from PostFinance webhook
    const { eventId, entityId, state, listenerEntityTechnicalName, spaceId } = event;

    if (!entityId || !state) {
      console.error('Missing required fields in webhook event');
      throw new Error('Missing entityId or state in webhook');
    }

    // Verify spaceId matches configuration (skip in test mode)
    if (!isTestMode) {
      const configuredSpaceId = Deno.env.get('POSTFINANCE_SPACE_ID');
      if (spaceId && configuredSpaceId && spaceId.toString() !== configuredSpaceId) {
        console.error(`SpaceId mismatch: received ${spaceId}, expected ${configuredSpaceId}`);
        throw new Error('SpaceId mismatch');
      }
    }

    // Map PostFinance states to our payment statuses
    const stateToStatus: Record<string, string> = {
      'AUTHORIZED': 'authorized',
      'COMPLETED': 'paid',
      'FULFILL': 'paid',
      'FAILED': 'cancelled',
      'DECLINE': 'cancelled',
      'VOIDED': 'cancelled',
      'PENDING': 'active',
      'PROCESSING': 'active'
    };

    const paymentStatus = stateToStatus[state] || 'active';

    console.log(`Processing webhook: entityId=${entityId}, state=${state}, mapped_status=${paymentStatus}`);

    // Find payment by transaction ID (entityId)
    const { data: payment, error: paymentError } = await supabaseClient
      .from('payments')
      .select('*')
      .eq('postfinance_transaction_id', entityId.toString())
      .maybeSingle();

    if (paymentError || !payment) {
      console.error('Payment not found for transaction:', entityId, 'Error:', paymentError?.message);
      throw new Error(`Payment not found for transaction ${entityId}`);
    }

    console.log('Found payment:', payment.id, 'Current status:', payment.payment_link_status, 'Intent:', payment.payment_intent);

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
      
      // Don't update payment_link_status here - security deposits remain 'active'
      // They are excluded from revenue by payment_intent check in the database trigger
      
      // CRITICAL FIX: Use payment.id (the UUID from payments table)
      const { data: authorization, error: authError } = await supabaseClient
        .from('security_deposit_authorizations')
        .select('*')
        .eq('authorization_id', payment.id)
        .maybeSingle();

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
        // For security deposits, don't mark as 'paid' - they're authorizations only
        // The database trigger will exclude them from revenue by payment_intent
        if (payment.payment_intent === 'security_deposit') {
          console.log('Security deposit authorization via payment.succeeded - updating authorization record');
          updateData = {
            // Don't set payment_link_status to 'paid' - security deposits stay 'active'
            postfinance_transaction_id: entityId.toString(),
          };
        } else {
          // Regular client payments (initial/balance) - mark as paid
          updateData = {
            payment_link_status: 'paid',
            paid_at: new Date().toISOString(),
            postfinance_transaction_id: entityId.toString(),
          };
          console.log('Payment succeeded, updating status to paid');
        }
        
        // For security deposit payments, also update authorization record
        if (payment.payment_intent === 'security_deposit') {
          
          // CRITICAL FIX: Use payment.id (the UUID from payments table)
          const { data: authorization } = await supabaseClient
            .from('security_deposit_authorizations')
            .select('*')
            .eq('authorization_id', payment.id)
            .maybeSingle();

          if (authorization) {
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

            console.log('Security deposit authorization recorded via payment.succeeded');
          }
        }
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

    // Email sending is now handled exclusively by the database trigger
    // The trigger will automatically call send-payment-confirmation after payment status update
    // This prevents duplicate emails and provides better idempotency
    if (event.type === 'payment.succeeded' && payment.payment_intent !== 'security_deposit') {
      console.log('Payment successful - database trigger will handle email notification');
      
      // Check if this is the initial payment - if so, generate balance and deposit links
      const isInitialPayment = payment.payment_intent === 'client_payment' || 
                               payment.payment_intent === 'down_payment' ||
                               (payment.payment_intent !== 'balance_payment' && 
                                payment.payment_intent !== 'final_payment');
      
      if (isInitialPayment) {
        console.log('Initial payment detected - triggering balance and deposit link generation');
        
        try {
          const generateResponse = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-balance-and-deposit-links`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({ booking_id: payment.booking_id }),
            }
          );
          
          if (generateResponse.ok) {
            const result = await generateResponse.json();
            console.log('Balance and deposit links generated successfully:', result);
          } else {
            const errorText = await generateResponse.text();
            console.error('Failed to generate balance and deposit links:', errorText);
          }
        } catch (genError) {
          console.error('Error calling generate-balance-and-deposit-links:', genError);
        }
      }
    } else if (event.type === 'payment.succeeded' && payment.payment_intent === 'security_deposit') {
      console.log('Security deposit authorized - no email needed');
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
