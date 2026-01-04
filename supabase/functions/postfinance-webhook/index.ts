import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// REMOVED: generateReceiptAndSendEmail function
// Email sending is now handled exclusively by the database trigger calling send-payment-confirmation
// This prevents duplicate emails and consolidates email logic in one place

/**
 * Infers transaction state from webhook context when state field is missing
 * This is a workaround for PostFinance webhooks that don't include the state field
 */
function inferTransactionState(event: any, existingPayment: any): string {
  // If we have an existing payment, check if it's already paid
  if (existingPayment?.paid_at) {
    console.log('💡 Payment already marked as paid, treating as COMPLETED');
    return 'COMPLETED';
  }

  // For Transaction entity webhooks without explicit state:
  // - Most webhooks we receive are for successful completions
  // - Authorization events typically include state in modern PostFinance configs
  // - Default to COMPLETED to unblock payment flow
  console.log('💡 No state in webhook - inferring COMPLETED based on Transaction webhook');
  return 'COMPLETED';
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  let webhookLogId: string | null = null;
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize Supabase client early
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // Log all incoming headers for debugging
    const allHeaders: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      allHeaders[key] = value;
    });
    console.log('📨 Incoming webhook headers:', allHeaders);

    // Read body first to check for test mode
    const body = await req.text();
    console.log('📨 Webhook body preview:', body.substring(0, 200));
    
    const rawEvent = JSON.parse(body);
    
    // =====================================================================
    // PAYLOAD NORMALIZATION: Support both Legacy and Modern/Event formats
    // =====================================================================
    // Legacy/Transaction format: { entityId, state, spaceId, eventId, type, ... }
    // Modern/Event format: { data: { transaction_id, status, id }, event: { ... }, ... }
    // =====================================================================
    
    let event: any = {};
    
    // Detect format by checking for 'data' object (Modern format indicator)
    if (rawEvent.data && typeof rawEvent.data === 'object') {
      console.log('📦 Detected Modern/Event webhook format - normalizing payload');
      
      // Extract entityId from data object - prioritize actual transaction ID
      let entityId = rawEvent.data.transaction_id || rawEvent.data.id || rawEvent.data.transactionId;
      
      // Check if the top-level entityId is generic (like 'Transaction', 'TransactionInvoice', or small numeric type IDs)
      const topLevelEntityId = rawEvent.entityId?.toString();
      const isGenericTopLevel = !topLevelEntityId || 
                                topLevelEntityId === 'Transaction' || 
                                topLevelEntityId === 'TransactionInvoice' ||
                                (topLevelEntityId.length <= 2 && !isNaN(Number(topLevelEntityId)));
      
      // Use data block ID if top-level is generic, otherwise prefer top-level if it looks like a real transaction ID
      if (!isGenericTopLevel && topLevelEntityId) {
        console.log(`📍 Using top-level entityId: ${topLevelEntityId}`);
        entityId = topLevelEntityId;
      } else if (entityId) {
        console.log(`📍 Using transaction ID from data block: ${entityId} (replacing generic/missing: ${topLevelEntityId})`);
      }
      
      // Map status to internal state constants (case-insensitive)
      const statusToState: Record<string, string> = {
        'paid': 'COMPLETED',
        'fulfilled': 'COMPLETED',
        'fulfill': 'COMPLETED',
        'successful': 'COMPLETED',
        'success': 'COMPLETED',
        'completed': 'COMPLETED',
        'authorized': 'AUTHORIZED',
        'pending': 'PENDING',
        'processing': 'PROCESSING',
        'confirmed': 'PENDING',
        'failed': 'FAILED',
        'declined': 'FAILED',
        'decline': 'FAILED',
        'voided': 'VOIDED',
        'expired': 'VOIDED',
      };
      
      const rawStatus = (rawEvent.data.status || rawEvent.data.state || '').toString();
      const normalizedStatus = rawStatus.toLowerCase();
      const state = statusToState[normalizedStatus] || rawStatus.toUpperCase();
      
      // Normalize to legacy format
      event = {
        entityId,
        state,
        eventId: rawEvent.event?.id || rawEvent.eventId || `event_${Date.now()}`,
        spaceId: rawEvent.data.space_id || rawEvent.data.spaceId || rawEvent.spaceId || req.headers.get('space'),
        type: rawEvent.event?.type || rawEvent.type,
        listenerEntityTechnicalName: rawEvent.listenerEntityTechnicalName || 'Transaction',
        webhookListenerId: rawEvent.webhookListenerId,
        listenerEntityId: rawEvent.listenerEntityId,
        // Preserve original data for logging
        _originalFormat: 'modern',
        _originalData: rawEvent.data,
      };
      
      console.log('📦 Normalized event:', {
        entityId: event.entityId,
        state: event.state,
        originalStatus: rawStatus,
        spaceId: event.spaceId,
      });
    } else {
      // Legacy format - use as-is but normalize state to uppercase
      console.log('📦 Detected Legacy/Transaction webhook format');
      event = rawEvent;
      event._originalFormat = 'legacy';
      
      // Normalize state to uppercase for consistent matching
      if (event.state && typeof event.state === 'string') {
        event.state = event.state.toUpperCase();
      }
    }

    // Check if this is a test/simulation transaction
    const isTestMode = event.entityId?.toString().startsWith('MOCK_') || 
                       event.state === 'TEST';

    // Extract webhook listener ID from payload - PostFinance sends both listenerEntityId and webhookListenerId
    // We check webhookListenerId first (simpler ID like "619627"), then fallback to listenerEntityId
    const webhookListenerId = event.webhookListenerId?.toString() || event.listenerEntityId?.toString();
    const listenerEntityId = event.listenerEntityId?.toString();

    // Create initial webhook log entry
    const { data: logEntry } = await supabaseClient
      .from('webhook_logs')
      .insert({
        event_id: event.eventId,
        entity_id: event.entityId?.toString() || 'unknown',
        event_type: event.type,
        state: event.state,
        space_id: event.spaceId?.toString(),
        webhook_listener_id: webhookListenerId,
        status: 'processing',
        request_payload: event,
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
        user_agent: req.headers.get('user-agent'),
      })
      .select('id')
      .single();
    
    webhookLogId = logEntry?.id;

    // Filter webhooks by listener ID - check both formats
    const expectedListenerId = Deno.env.get('POSTFINANCE_WEBHOOK_LISTENER_ID');
    if (expectedListenerId) {
      const matchesWebhookListenerId = webhookListenerId === expectedListenerId;
      const matchesListenerEntityId = listenerEntityId === expectedListenerId;
      
      if (!matchesWebhookListenerId && !matchesListenerEntityId) {
        console.log('🔕 Webhook from different listener, ignoring:', {
          received_webhookListenerId: webhookListenerId,
          received_listenerEntityId: listenerEntityId,
          expected: expectedListenerId
        });
        
        // Update log to reflect ignored status
        if (webhookLogId) {
          await supabaseClient
            .from('webhook_logs')
            .update({
              status: 'ignored',
              processing_duration_ms: Date.now() - startTime,
              response_data: { message: 'Webhook from different listener' }
            })
            .eq('id', webhookLogId);
        }
        
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      console.log('✅ Webhook listener ID matched:', {
        expected: expectedListenerId,
        matched_via: matchesWebhookListenerId ? 'webhookListenerId' : 'listenerEntityId'
      });
    }

    // Check if signature verification is enabled
    const signatureEnabled = Deno.env.get('POSTFINANCE_WEBHOOK_SIGNATURE_ENABLED') !== 'false';

    console.log('🔐 Webhook security mode:', {
      signature_verification: signatureEnabled ? 'ENABLED' : 'DISABLED',
      is_test_mode: isTestMode,
      environment_variable: Deno.env.get('POSTFINANCE_WEBHOOK_SIGNATURE_ENABLED')
    });

    if (!isTestMode && signatureEnabled) {
      // Real PostFinance webhook - verify signature using webhook-specific secret
      const webhookSecret = Deno.env.get('POSTFINANCE_WEBHOOK_SECRET');
      
      // PostFinance uses these header names (case-insensitive)
      const signature = req.headers.get('x-postfinance-signature') || 
                       req.headers.get('x-signature');
      const timestamp = req.headers.get('x-timestamp') || 
                       req.headers.get('timestamp');
      
      if (!signature || !webhookSecret || !timestamp) {
        console.error('❌ Missing required webhook headers:', {
          has_signature: !!signature,
          has_secret: !!webhookSecret,
          has_timestamp: !!timestamp,
          available_headers: Object.keys(allHeaders)
        });
        return new Response(
          JSON.stringify({ error: 'Unauthorized - Missing required headers' }),
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
      
      // PostFinance webhook signature format: HMAC-SHA256 of (timestamp + body)
      // Note: Using SHA-256 (most common) but can be configured to SHA-512
      const dataToSign = `${timestamp}${body}`;
      
      console.log('🔐 Webhook signature verification:', {
        timestamp,
        body_length: body.length,
        signature_preview: signature.substring(0, 20) + '...',
        data_to_sign_preview: dataToSign.substring(0, 100) + '...'
      });
      
      // Try both algorithms (SHA-256 is most common, SHA-512 is alternative)
      let isValid = false;
      const encoder = new TextEncoder();
      const dataBytes = encoder.encode(dataToSign);
      
      // Convert hex signature to buffer
      const signatureBuffer = Uint8Array.from(
        signature.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
      );
      
      // Try SHA-256 first (most common for PostFinance webhooks)
      try {
        const secretBytes = encoder.encode(webhookSecret);
        const key256 = await crypto.subtle.importKey(
          'raw',
          secretBytes,
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['verify']
        );
        
        isValid = await crypto.subtle.verify(
          'HMAC',
          key256,
          signatureBuffer,
          dataBytes
        );
        
        if (isValid) {
          console.log('✅ Signature verified with HMAC-SHA256');
        }
      } catch (e) {
        console.log('SHA-256 verification failed, trying SHA-512:', e);
      }
      
      // If SHA-256 fails, try SHA-512
      if (!isValid) {
        try {
          const secretBytes = encoder.encode(webhookSecret);
          const key512 = await crypto.subtle.importKey(
            'raw',
            secretBytes,
            { name: 'HMAC', hash: 'SHA-512' },
            false,
            ['verify']
          );
          
          isValid = await crypto.subtle.verify(
            'HMAC',
            key512,
            signatureBuffer,
            dataBytes
          );
          
          if (isValid) {
            console.log('✅ Signature verified with HMAC-SHA512');
          }
        } catch (e) {
          console.log('SHA-512 verification also failed:', e);
        }
      }
      
      if (!isValid) {
        console.error('❌ Invalid webhook signature - authentication failed');
        console.error('Verification details:', {
          signature_provided: signature.substring(0, 20) + '...',
          timestamp_used: timestamp,
          body_length: body.length,
          data_format: 'timestamp + body',
          tried_algorithms: ['HMAC-SHA256', 'HMAC-SHA512']
        });
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        );
      }
      
      console.log('✅ Webhook signature verified successfully');
    } else if (!isTestMode && !signatureEnabled) {
      console.warn('⚠️ WARNING: Webhook signature verification is DISABLED');
      console.warn('⚠️ Anyone can send webhook events to this endpoint - security risk!');
      console.log('Request accepted without verification:', {
        has_signature_header: !!(req.headers.get('x-postfinance-signature') || req.headers.get('x-signature')),
        has_timestamp_header: !!(req.headers.get('x-timestamp') || req.headers.get('timestamp')),
        headers_received: Object.keys(allHeaders),
        body_preview: body.substring(0, 100)
      });
    } else {
      console.log('Test mode detected - skipping signature verification');
    }

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
    let { eventId, entityId, state, listenerEntityTechnicalName, spaceId } = event;

    if (!entityId) {
      console.error('Missing entityId in webhook event');
      return new Response(JSON.stringify({ error: 'Missing entityId' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // If state is missing, fetch existing payment to help infer state
    let existingPayment = null;
    if (!state) {
      console.log('⚠️ State missing in webhook - checking existing payment');
      
      const { data: payment } = await supabaseClient
        .from('payments')
        .select('paid_at, payment_link_status')
        .eq('postfinance_transaction_id', entityId)
        .maybeSingle();
      
      existingPayment = payment;
      state = inferTransactionState(event, existingPayment);
      
      console.log('✅ Inferred state from context:', {
        entityId,
        inferredState: state,
        hadExistingPayment: !!existingPayment
      });
    }

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

    // Normalize state to uppercase for consistent matching
    if (state && typeof state === 'string') {
      state = state.toUpperCase();
    }

    // Map PostFinance states to our payment statuses
    // Expanded to handle all variations seen in production
    const stateToStatus: Record<string, string> = {
      'AUTHORIZED': 'authorized',
      'COMPLETED': 'paid',
      'FULFILL': 'paid',
      'FULFILLED': 'paid',
      'SUCCESSFUL': 'paid',
      'SUCCESS': 'paid',
      'FAILED': 'cancelled',
      'DECLINE': 'cancelled',
      'DECLINED': 'cancelled',
      'VOIDED': 'cancelled',
      'PENDING': 'active',
      'CONFIRMED': 'active',
      'PROCESSING': 'active'
    };

    const paymentStatus = stateToStatus[state] || 'active';

    console.log(`Processing webhook: entityId=${entityId}, state=${state}, mapped_status=${paymentStatus}, type=${event.type}`);

    // Find payment by transaction ID (entityId)
    const { data: payment, error: paymentError } = await supabaseClient
      .from('payments')
      .select('*')
      .eq('postfinance_transaction_id', entityId.toString())
      .maybeSingle();

    if (paymentError || !payment) {
      console.log('⚠️ Payment not found - treating as manual test webhook:', entityId);
      console.log('Test webhook details:', {
        entityId,
        state,
        eventType: event.type || 'Transaction',
        spaceId: event.spaceId
      });
      
      return new Response(
        JSON.stringify({ 
          received: true, 
          message: 'Test webhook processed successfully',
          note: 'No payment record found - this appears to be a manual test from PostFinance dashboard'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
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

        // Trigger security deposit confirmation email
        try {
          console.log('📧 Triggering security deposit confirmation email...');
          const { error: emailError } = await supabaseClient.functions.invoke(
            'trigger-security-deposit-confirmation',
            {
              body: {
                booking_id: authorization.booking_id,
                deposit_amount: authorization.amount,
              },
            }
          );

          if (emailError) {
            console.error('Failed to trigger security deposit confirmation email:', emailError);
          } else {
            console.log('✅ Security deposit confirmation email triggered');
          }
        } catch (emailErr) {
          console.error('Error calling trigger-security-deposit-confirmation:', emailErr);
        }
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

    // Update payment based on transaction state (PostFinance sends 'state', not 'type')
    // PostFinance transaction states: PENDING, CONFIRMED, PROCESSING, AUTHORIZED, COMPLETED, FULFILL, FAILED, DECLINE, VOIDED
    let updateData: any = {};

    // Determine if this is a successful payment based on state
    // Expanded to include all variations seen in production
    const successStates = ['COMPLETED', 'FULFILL', 'FULFILLED', 'AUTHORIZED', 'SUCCESSFUL', 'SUCCESS'];
    const failedStates = ['FAILED', 'DECLINE', 'DECLINED', 'VOIDED'];
    const pendingStates = ['PENDING', 'CONFIRMED', 'PROCESSING'];
    
    console.log('🔄 Processing webhook state:', state, 'for payment:', payment.id, 'intent:', payment.payment_intent);

    if (successStates.includes(state)) {
        // For security deposits, handle authorization
        if (payment.payment_intent === 'security_deposit') {
          console.log('🔐 Security deposit authorization via state:', state, 'for payment:', payment.id);
          updateData = {
            postfinance_transaction_id: entityId.toString(),
            payment_link_status: 'paid', // Mark as paid to indicate successful authorization
          };
          
          // Try multiple lookup strategies for authorization record
          let authorization = null;
          
          // Strategy 1: Lookup by payment.id (the UUID)
          const { data: authByPaymentId } = await supabaseClient
            .from('security_deposit_authorizations')
            .select('*')
            .eq('authorization_id', payment.id)
            .maybeSingle();
          
          if (authByPaymentId) {
            authorization = authByPaymentId;
            console.log('Found authorization by payment.id:', payment.id);
          } else {
            // Strategy 2: Lookup by booking_id + pending status
            const { data: authByBookingId } = await supabaseClient
              .from('security_deposit_authorizations')
              .select('*')
              .eq('booking_id', payment.booking_id)
              .eq('status', 'pending')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            if (authByBookingId) {
              authorization = authByBookingId;
              console.log('Found authorization by booking_id (pending):', payment.booking_id);
            }
          }

          if (authorization) {
            // Update authorization to authorized status
            const { error: authUpdateError } = await supabaseClient
              .from('security_deposit_authorizations')
              .update({
                status: 'authorized',
                authorized_at: new Date().toISOString(),
              })
              .eq('id', authorization.id);

            if (authUpdateError) {
              console.error('Failed to update authorization:', authUpdateError);
            } else {
              console.log('✅ Security deposit authorization updated to authorized');
            }

            // Update booking record
            const { error: bookingUpdateError } = await supabaseClient
              .from('bookings')
              .update({
                security_deposit_authorized_at: new Date().toISOString(),
                security_deposit_authorization_id: payment.id,
              })
              .eq('id', authorization.booking_id);

            if (bookingUpdateError) {
              console.error('Failed to update booking:', bookingUpdateError);
            } else {
              console.log('✅ Booking security deposit fields updated');
            }

            // Trigger security deposit confirmation email
            try {
              console.log('📧 Triggering security deposit confirmation email...');
              const { error: emailError } = await supabaseClient.functions.invoke(
                'trigger-security-deposit-confirmation',
                {
                  body: {
                    booking_id: authorization.booking_id,
                    deposit_amount: authorization.amount,
                  },
                }
              );

              if (emailError) {
                console.error('Failed to trigger security deposit confirmation email:', emailError);
              } else {
                console.log('✅ Security deposit confirmation email triggered');
              }
            } catch (emailErr) {
              console.error('Error calling trigger-security-deposit-confirmation:', emailErr);
            }
          } else {
            console.warn('⚠️ No authorization record found for security deposit payment:', payment.id);
          }
        } else {
          // Regular client payments - mark as paid
          updateData = {
            payment_link_status: 'paid',
            paid_at: new Date().toISOString(),
            postfinance_transaction_id: entityId.toString(),
          };
          console.log('✅ Payment succeeded (state:', state, '), updating status to paid');
        }
    } else if (failedStates.includes(state)) {
        updateData = {
          payment_link_status: 'cancelled',
        };
        console.log('❌ Payment failed (state:', state, '), updating status to cancelled');
    } else if (pendingStates.includes(state)) {
        // For pending states, just log and don't update - wait for final state
        console.log('⏳ Payment pending (state:', state, '), waiting for final state');
        
        // Update webhook log 
        if (webhookLogId) {
          await supabaseClient
            .from('webhook_logs')
            .update({
              status: 'success',
              processing_duration_ms: Date.now() - startTime,
              payment_id: payment?.id,
              booking_id: payment?.booking_id,
              response_data: { message: 'Pending state received, waiting for final state' }
            })
            .eq('id', webhookLogId);
        }
        
        return new Response(
          JSON.stringify({ received: true, message: 'Pending state acknowledged' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
    } else {
        console.log('⚠️ Unhandled transaction state:', state);
        return new Response(
          JSON.stringify({ received: true, message: 'State not handled: ' + state }),
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
    const isPaymentSuccess = successStates.includes(state);
    
    if (isPaymentSuccess && payment.payment_intent !== 'security_deposit') {
      console.log('💰 Payment successful - database trigger will handle email notification');
      
      // Check if this is the initial payment - if so, generate balance and deposit links
      const isInitialPayment = payment.payment_intent === 'client_payment' || 
                               payment.payment_intent === 'down_payment' ||
                               (payment.payment_intent !== 'balance_payment' && 
                                payment.payment_intent !== 'final_payment');
      
      if (isInitialPayment) {
        console.log('📧 Initial payment detected - triggering balance and deposit link generation');
        
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
            console.log('✅ Balance and deposit links generated successfully:', result);
          } else {
            const errorText = await generateResponse.text();
            console.error('❌ Failed to generate balance and deposit links:', errorText);
          }
        } catch (genError) {
          console.error('❌ Error calling generate-balance-and-deposit-links:', genError);
        }
      }
    } else if (isPaymentSuccess && payment.payment_intent === 'security_deposit') {
      console.log('Security deposit authorized - no email needed');
    }

    // The trigger will automatically update the booking status
    
    // Update webhook log with success
    if (webhookLogId) {
      await supabaseClient
        .from('webhook_logs')
        .update({
          status: 'success',
          processing_duration_ms: Date.now() - startTime,
          payment_id: payment?.id,
          booking_id: payment?.booking_id,
        })
        .eq('id', webhookLogId);
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Webhook error:', error);
    
    // Update webhook log with error
    if (webhookLogId) {
      await supabaseClient
        .from('webhook_logs')
        .update({
          status: 'error',
          processing_duration_ms: Date.now() - startTime,
          error_message: error.message,
          response_data: { error: error.message, stack: error.stack },
        })
        .eq('id', webhookLogId);
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
