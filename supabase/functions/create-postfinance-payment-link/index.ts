import { createClient } from 'npm:@supabase/supabase-js@2';
import { encodeBase64, decodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import { getSuggestionsForStatus } from './helpers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * PostFinance Payment Integration
 * 
 * Supported Payment Methods:
 * - visa_mastercard: Visa/Mastercard cards (EUR, 2% fee, no conversion)
 * - amex: American Express (CHF, 3.5% fee, EUR→CHF conversion)
 * 
 * Payment Method Mapping:
 * - visa_mastercard → database enum: 'card'
 * - amex → database enum: 'card'
 * - bank_transfer → database enum: 'wire' (not supported by PostFinance)
 * - manual → database enum: 'other' (not supported by PostFinance)
 * 
 * Flow:
 * 1. Client selects payment method on booking form
 * 2. Frontend calls this function with payment_method_type
 * 3. Function validates it's a card payment (visa_mastercard or amex)
 * 4. Function fetches payment method config (fees, currency, conversion)
 * 5. Function calculates total amount with fees
 * 6. Function applies currency conversion if needed (Amex only)
 * 7. Function creates payment record with method='card'
 * 8. Function returns payment link to PostFinance simulation
 * 9. Client completes payment on PostFinance page
 * 10. Webhook updates payment status and triggers booking confirmation
 */

interface PaymentLinkRequest {
  booking_id: string;
  amount: number;
  payment_type: 'deposit' | 'rental' | 'additional';
  payment_intent: 'down_payment' | 'final_payment' | 'additional_payment' | 'security_deposit';
  payment_method_type: string; // visa_mastercard or amex
  expires_in_hours?: number;
  description?: string;
  send_email?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const {
      booking_id,
      amount,
      payment_type,
      payment_intent,
      payment_method_type,
      expires_in_hours = 48,
      description,
      send_email = false
    }: PaymentLinkRequest = await req.json();

    // ===== CREDENTIAL VALIDATION =====
    const userId = Deno.env.get('POSTFINANCE_USER_ID');
    const spaceId = Deno.env.get('POSTFINANCE_SPACE_ID');
    const authKey = Deno.env.get('POSTFINANCE_AUTHENTICATION_KEY');
    const environment = Deno.env.get('POSTFINANCE_ENVIRONMENT') || 'production';

    console.log('=== POSTFINANCE CREDENTIALS VALIDATION ===');
    console.log('Environment:', environment);
    console.log('User ID present:', !!userId, 'Value:', userId);
    console.log('Space ID present:', !!spaceId, 'Value:', spaceId);
    console.log('Auth Key present:', !!authKey, 'Length:', authKey?.length || 0);
    
    if (!userId || !spaceId || !authKey) {
      throw new Error(`Missing PostFinance credentials: ${!userId ? 'USER_ID ' : ''}${!spaceId ? 'SPACE_ID ' : ''}${!authKey ? 'AUTH_KEY' : ''}`);
    }

    // Validate User ID format (should be numeric)
    if (!/^\d+$/.test(userId)) {
      throw new Error(`Invalid POSTFINANCE_USER_ID format: expected numeric, got "${userId}"`);
    }

    // Validate Space ID format (should be numeric)
    if (!/^\d+$/.test(spaceId)) {
      throw new Error(`Invalid POSTFINANCE_SPACE_ID format: expected numeric, got "${spaceId}"`);
    }

    // Validate Authentication Key format (should be base64, 44 chars for 256-bit key)
    if (authKey.length !== 44) {
      throw new Error(`Invalid POSTFINANCE_AUTHENTICATION_KEY length: expected 44 chars (base64), got ${authKey.length}`);
    }

    console.log('✅ All credentials validated');
    console.log('===========================================\n');

    console.log('Creating payment link for booking:', booking_id, 'Payment method:', payment_method_type);

    // Validate that this is a card payment (only visa_mastercard and amex work with PostFinance)
    if (payment_method_type !== 'visa_mastercard' && payment_method_type !== 'amex') {
      throw new Error('PostFinance payment links can only be created for card payments (visa_mastercard or amex)');
    }

    // Validate booking exists and is not cancelled
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      throw new Error('Booking not found');
    }

    if (booking.status === 'cancelled') {
      throw new Error('Cannot create payment link for cancelled booking');
    }

    // Get payment method configuration for fees and currency
    const { data: paymentMethod, error: pmError } = await supabaseClient
      .from('payment_methods')
      .select('*')
      .eq('method_type', payment_method_type)
      .eq('is_enabled', true)
      .single();

    if (pmError || !paymentMethod) {
      throw new Error(`Payment method ${payment_method_type} not found or disabled`);
    }

    console.log('Payment method config:', {
      type: paymentMethod.method_type,
      fee: paymentMethod.fee_percentage,
      currency: paymentMethod.currency,
      requires_conversion: paymentMethod.requires_conversion
    });

    // Calculate fee and total amount (NO FEES FOR SECURITY DEPOSITS)
    let feeAmount = 0;
    let totalAmount = amount;

    if (payment_intent !== 'security_deposit') {
      feeAmount = (amount * paymentMethod.fee_percentage) / 100;
      totalAmount = amount + feeAmount;
    }

    console.log('Payment calculation:', {
      original_amount: amount,
      fee_percentage: payment_intent === 'security_deposit' ? 0 : paymentMethod.fee_percentage,
      fee_amount: feeAmount,
      total_amount: totalAmount,
      currency: paymentMethod.currency,
      is_security_deposit: payment_intent === 'security_deposit'
    });

    // Handle currency conversion if needed
    let finalAmount = totalAmount;
    let finalCurrency = paymentMethod.currency;
    let conversionRate = null;

    if (paymentMethod.requires_conversion) {
      // Get latest EUR to CHF conversion rate
      const { data: rateData, error: rateError } = await supabaseClient
        .rpc('get_latest_conversion_rate', {
          p_from_currency: 'EUR',
          p_to_currency: 'CHF'
        });

      if (rateError) {
        console.error('Failed to get conversion rate:', rateError);
        throw new Error('Currency conversion failed');
      }

      conversionRate = rateData;
      finalAmount = totalAmount * conversionRate;
      
      console.log('Currency conversion applied:', {
        from_currency: 'EUR',
        to_currency: 'CHF',
        rate: conversionRate,
        original_amount: totalAmount,
        converted_amount: finalAmount
      });
    }

    // Calculate expiry time
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expires_in_hours);

    // Real PostFinance Checkout API Integration
    const postfinanceSpaceId = Deno.env.get('POSTFINANCE_SPACE_ID');
    const postfinanceUserId = Deno.env.get('POSTFINANCE_USER_ID');
    const postfinanceAuthKey = Deno.env.get('POSTFINANCE_AUTHENTICATION_KEY');
    const appDomain = Deno.env.get('APP_DOMAIN') || 'https://bookrentmanager.com';

    if (!postfinanceSpaceId || !postfinanceUserId || !postfinanceAuthKey) {
      throw new Error('PostFinance credentials not configured');
    }

    console.warn('⚠️ PRODUCTION MODE: Real PostFinance transactions will be created');
    console.log('Transaction details:', {
      amount: finalAmount,
      currency: finalCurrency,
      booking: booking.reference_code,
      payment_intent,
    });

    // Prepare transaction payload for PostFinance
    const transactionPayload = {
      currency: finalCurrency,
      lineItems: [{
        name: description || `${payment_intent.replace(/_/g, ' ').toUpperCase()} - ${booking.car_model}`,
        quantity: 1,
        amountIncludingTax: Math.round(finalAmount * 100), // Convert to cents
        type: 'PRODUCT',
        uniqueId: `${payment_intent}_${booking_id.substring(0, 8)}`,
      }],
      successUrl: `${appDomain}/payment/confirmation?session_id={TRANSACTION_ID}&status=success`,
      failedUrl: `${appDomain}/payment/confirmation?session_id={TRANSACTION_ID}&status=failed`,
      language: 'en',
      customerId: booking.client_email,
      billingAddress: {
        emailAddress: booking.client_email,
        givenName: booking.client_name?.split(' ')[0] || 'Customer',
        familyName: booking.client_name?.split(' ').slice(1).join(' ') || '',
        country: booking.country || 'CH',
        city: booking.billing_address?.split(',')[0] || '',
        postCode: '',
        street: booking.billing_address || '',
      },
      metaData: {
        booking_id,
        payment_intent,
        booking_reference: booking.reference_code,
        payment_method_type,
      },
    };

    // Validate transaction payload
    if (!transactionPayload.lineItems[0].amountIncludingTax || transactionPayload.lineItems[0].amountIncludingTax <= 0) {
      throw new Error('Invalid amount: must be positive');
    }
    if (!transactionPayload.currency || transactionPayload.currency.length !== 3) {
      throw new Error('Invalid currency: must be 3-letter ISO code');
    }
    if (!transactionPayload.billingAddress.emailAddress || !transactionPayload.billingAddress.emailAddress.includes('@')) {
      throw new Error('Invalid email address');
    }

    console.log('=== POSTFINANCE REQUEST PAYLOAD ===');
    console.log('Full transaction payload:', JSON.stringify(transactionPayload, null, 2));
    console.log('Payload size:', JSON.stringify(transactionPayload).length, 'bytes');
    console.log('Amount (cents):', transactionPayload.lineItems[0].amountIncludingTax);
    console.log('Currency:', transactionPayload.currency);
    console.log('Customer email:', transactionPayload.billingAddress.emailAddress);
    console.log('Booking reference:', booking.reference_code);
    console.log('=== END REQUEST PAYLOAD ===');

    // Generate correlation ID for request tracking
    const requestId = `pfr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Generate MAC authentication headers (HMAC-SHA512)
    // CRITICAL: PostFinance expects Unix timestamp in SECONDS, not milliseconds
    const timestampMillis = Date.now();
    const timestamp = Math.floor(timestampMillis / 1000).toString();
    const macVersion = '1';
    
    // Create the data to sign: METHOD|PATH|TIMESTAMP
    // CRITICAL: Path for MAC signature should NOT include query string
    const method = 'POST';
    const pathForSignature = '/api/transaction/create';
    const dataToSign = `${method}|${pathForSignature}|${timestamp}`;
    
    console.log('=== REQUEST CORRELATION ===');
    console.log('Request ID:', requestId);
    console.log('Request timestamp:', new Date().toISOString());
    console.log('===========================');
    
    console.log('=== MAC SIGNATURE DIAGNOSTIC INFO ===');
    console.log('Timestamp (milliseconds):', timestampMillis);
    console.log('Timestamp (seconds - USED):', timestamp);
    console.log('Timestamp validation:', {
      is_10_digits: timestamp.length === 10,
      is_reasonable_date: new Date(parseInt(timestamp) * 1000).getFullYear() === new Date().getFullYear()
    });
    console.log('Method:', method);
    console.log('Path (for signature - NO query string):', pathForSignature);
    console.log('Path (full URL - WITH query string):', `/api/transaction/create?spaceId=${postfinanceSpaceId}`);
    console.log('Data to sign:', dataToSign);
    console.log('Data to sign (length):', dataToSign.length);
    console.log('Data to sign (bytes as hex):', Array.from(new TextEncoder().encode(dataToSign))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' '));
    
    // Sign with HMAC-SHA256 (required by PostFinance for API authentication)
    const encoder = new TextEncoder();
    // Decode the base64-encoded PostFinance authentication key
    const keyData = Uint8Array.from(atob(postfinanceAuthKey), c => c.charCodeAt(0));
    
    console.log('Authentication key validation:', {
      length_bytes: keyData.length,
      is_32_bytes: keyData.length === 32,
      base64_original_length: postfinanceAuthKey.length,
      first_4_bytes_hex: Array.from(keyData.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(' '),
      last_4_bytes_hex: Array.from(keyData.slice(-4)).map(b => b.toString(16).padStart(2, '0')).join(' ')
    });
    
    if (keyData.length !== 32) {
      console.warn('⚠️ WARNING: Authentication key is not 32 bytes! Expected 32, got:', keyData.length);
      throw new Error(`Invalid authentication key length: ${keyData.length} bytes (expected 32)`);
    }
    
    // Validate credentials format
    console.log('Credentials validation:', {
      user_id_format: /^\d+$/.test(postfinanceUserId),
      user_id_value: postfinanceUserId,
      space_id_format: /^\d+$/.test(postfinanceSpaceId),
      space_id_value: postfinanceSpaceId,
      auth_key_is_base64: /^[A-Za-z0-9+/=]+$/.test(postfinanceAuthKey)
    });
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      encoder.encode(dataToSign)
    );
    
    const signatureBytes = new Uint8Array(signature);
    console.log('Signature validation:', {
      length_bytes: signatureBytes.length,
      is_32_bytes: signatureBytes.length === 32,
      algorithm: 'HMAC-SHA256 (PostFinance requirement)'
    });
    console.log('Signature (hex):', Array.from(signatureBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join(''));
    
    const macValue = encodeBase64(signatureBytes);
    console.log('Signature (base64):', macValue);
    console.log('Signature (base64 length):', macValue.length);
    
    // Log exact request components for manual verification
    console.log('=== EXACT REQUEST COMPONENTS ===');
    console.log('Component 1 - HTTP Method:', method);
    console.log('Component 2 - API Path (signature):', pathForSignature);
    console.log('Component 2 - API Path (full URL):', `/api/transaction/create?spaceId=${postfinanceSpaceId}`);
    console.log('Component 3 - Timestamp:', timestamp);
    console.log('Concatenated (with pipes):', dataToSign);
    console.log('Concatenated length:', dataToSign.length);
    console.log('Expected format: METHOD|PATH|TIMESTAMP');
    console.log('=== END EXACT COMPONENTS ===');
    
    console.log('MAC Headers being sent:');
    console.log('  x-mac-userid:', postfinanceUserId);
    console.log('  x-mac-timestamp:', timestamp);
    console.log('  x-mac-value:', macValue.substring(0, 20) + '... (truncated)');
    console.log('  x-mac-version:', macVersion);
    console.log('=== END DIAGNOSTIC INFO ===');

    // Determine API URL based on environment
    const isProduction = Deno.env.get('POSTFINANCE_ENVIRONMENT') === 'production';
    const baseUrl = 'https://checkout.postfinance.ch'; // Same URL for both test and production
    
    const apiUrl = `${baseUrl}/api/transaction/create?spaceId=${postfinanceSpaceId}`;
    
    console.log('Calling PostFinance API:', {
      url: apiUrl,
      environment: isProduction ? 'production' : 'test',
      userId: postfinanceUserId,
      spaceId: postfinanceSpaceId
    });

    // Call PostFinance API with MAC authentication
    const requestStartTime = Date.now();
    let postfinanceResponse;
    try {
      console.log('=== SENDING REQUEST TO POSTFINANCE ===');
      console.log('Request ID:', requestId);
      console.log('URL:', apiUrl);
      console.log('Headers:', {
        'Content-Type': 'application/json',
        'x-mac-userid': postfinanceUserId,
        'x-mac-timestamp': timestamp,
        'x-mac-value': `${macValue.substring(0, 20)}... (${macValue.length} chars)`,
        'x-mac-version': macVersion,
      });
      console.log('Body size:', JSON.stringify(transactionPayload).length, 'bytes');
      console.log('=======================================');
      
      postfinanceResponse = await fetch(
        apiUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-mac-userid': postfinanceUserId,
            'x-mac-timestamp': timestamp,
            'x-mac-value': macValue,
            'x-mac-version': macVersion,
          },
          body: JSON.stringify(transactionPayload),
        }
      );
      
      const requestDuration = Date.now() - requestStartTime;
      console.log('Request completed in', requestDuration, 'ms');
      
    } catch (fetchError) {
      const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
      console.error('=== NETWORK ERROR ===');
      console.error('Request ID:', requestId);
      console.error('Error:', errorMessage);
      console.error('URL:', apiUrl);
      console.error('Space ID:', postfinanceSpaceId);
      console.error('Duration:', Date.now() - requestStartTime, 'ms');
      console.error('=====================');
      
      return new Response(
        JSON.stringify({ 
          error: 'Network error connecting to PostFinance',
          request_id: requestId,
          details: errorMessage,
          suggestion: 'Check if PostFinance API is accessible and credentials are correct',
          debugging: {
            url: apiUrl,
            space_id: postfinanceSpaceId,
            duration_ms: Date.now() - requestStartTime
          }
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!postfinanceResponse.ok) {
      const errorText = await postfinanceResponse.text();
      const responseHeaders = Object.fromEntries(postfinanceResponse.headers.entries());
      const requestDuration = Date.now() - requestStartTime;
      
      console.error('=== POSTFINANCE ERROR RESPONSE ===');
      console.error('Request ID:', requestId);
      console.error('Status:', postfinanceResponse.status, postfinanceResponse.statusText);
      console.error('Duration:', requestDuration, 'ms');
      console.error('Response Headers:', JSON.stringify(responseHeaders, null, 2));
      console.error('Response Body (raw):', errorText);
      console.error('Request Details:', {
        url: apiUrl,
        method: 'POST',
        space_id: postfinanceSpaceId,
        user_id: postfinanceUserId,
        timestamp_used: timestamp,
        mac_value_length: macValue.length,
        data_to_sign: dataToSign,
        data_to_sign_length: dataToSign.length
      });
      
      // Test HMAC with known values to verify implementation
      console.error('=== HMAC IMPLEMENTATION TEST ===');
      try {
        const testKey = new Uint8Array(32).fill(0); // All zeros test key
        const testData = 'test';
        const testCryptoKey = await crypto.subtle.importKey(
          'raw',
          testKey,
          { name: 'HMAC', hash: 'SHA-512' },
          false,
          ['sign']
        );
        const testSig = await crypto.subtle.sign('HMAC', testCryptoKey, encoder.encode(testData));
        const testSigHex = Array.from(new Uint8Array(testSig))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        console.error('Test HMAC-SHA512(zeros_32, "test"):', testSigHex);
        console.error('Expected (verify online):', 'should be verifiable with online HMAC calculator');
      } catch (testError) {
        console.error('HMAC test failed:', testError);
      }
      console.error('=== END HMAC TEST ===');
      
      // Parse structured error if available
      let structuredError = null;
      try {
        structuredError = JSON.parse(errorText);
        console.error('Structured error:', JSON.stringify(structuredError, null, 2));
      } catch {
        console.error('Error response is not JSON - using raw text');
      }
      console.error('=== END ERROR RESPONSE ===');
      
      // Get error-specific suggestions
      const suggestions = getSuggestionsForStatus(postfinanceResponse.status);
      
      return new Response(
        JSON.stringify({
          error: 'PostFinance API Error',
          request_id: requestId,
          status: postfinanceResponse.status,
          statusText: postfinanceResponse.statusText,
          details: structuredError || errorText,
          response_headers: responseHeaders,
          debugging: {
            timestamp_used: timestamp,
            timestamp_format: 'Unix seconds (10 digits)',
            mac_signature_length: macValue.length,
            mac_version: macVersion,
            request_url: apiUrl,
            space_id: postfinanceSpaceId,
            user_id: postfinanceUserId,
            request_duration_ms: requestDuration,
            payload_size_bytes: JSON.stringify(transactionPayload).length
          },
          suggestions,
          next_steps: [
            'Check the edge function logs for detailed MAC signature information',
            'Verify all credentials in Lovable Cloud backend settings',
            'Ensure the space ID matches your PostFinance account',
            'Contact PostFinance support with the Request ID if issue persists'
          ]
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const transactionData = await postfinanceResponse.json();
    console.log('PostFinance API Response:', JSON.stringify(transactionData, null, 2));
    
    const sessionId = transactionData.id?.toString() || `pf_${Date.now()}`;
    const paymentPageUrl = transactionData.paymentPageUrl || 
      `https://checkout.postfinance.ch/s/${postfinanceSpaceId}/payment/selection?transaction=${sessionId}`;

    console.log('PostFinance transaction created:', {
      sessionId,
      paymentPageUrl: paymentPageUrl.substring(0, 80) + '...',
    });

    // Insert payment record with complete tracking
    const { data: payment, error: paymentError } = await supabaseClient
      .from('payments')
      .insert({
        booking_id,
        amount,
        type: payment_type,
        method: 'card', // Card payments use 'card' enum
        payment_method_type, // Track actual method (visa_mastercard or amex)
        original_amount: amount,
        original_currency: 'EUR',
        fee_percentage: payment_intent === 'security_deposit' ? 0 : paymentMethod.fee_percentage,
        fee_amount: feeAmount,
        total_amount: totalAmount,
        currency: finalCurrency,
        converted_amount: paymentMethod.requires_conversion ? finalAmount : null,
        conversion_rate_used: conversionRate,
        payment_link_id: sessionId,
        payment_link_url: paymentPageUrl,
        payment_link_status: 'active',
        payment_link_expires_at: expiresAt.toISOString(),
        postfinance_session_id: transactionData.id?.toString() || sessionId,
        payment_intent,
        note: description || `${payment_intent.replace('_', ' ')} via ${paymentMethod.display_name}`,
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Payment insert error:', paymentError);
      throw paymentError;
    }

    console.log('Payment record created:', {
      id: payment.id,
      method: payment.method,
      payment_method_type: payment.payment_method_type,
      total_amount: payment.total_amount,
      currency: payment.currency
    });

    // Optional: Send email to client
    if (send_email && booking.client_email) {
      console.log('Sending payment link email to:', booking.client_email);
      // TODO: Integrate with email service
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: payment.id,
        payment_link: paymentPageUrl,
        expires_at: expiresAt.toISOString(),
        amount: payment.total_amount, // Return total with fees
        currency: payment.currency,
        original_amount: payment.original_amount,
        fee_amount: payment.fee_amount,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error creating payment link:', error);
    
    // Return detailed error to frontend for better debugging
    const errorResponse = {
      error: error.message || 'Unknown error',
      details: error.message.includes('PostFinance API error') 
        ? error.message 
        : 'Failed to create PostFinance payment link. Please check your payment configuration.',
      timestamp: new Date().toISOString(),
    };
    
    return new Response(
      JSON.stringify(errorResponse),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
