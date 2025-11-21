import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};


/**
 * PostFinance Transaction Integration
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
 * 8. Function creates PostFinance transaction and returns redirect URL
 * 9. Client completes payment on PostFinance page
 * 10. Webhook updates payment status and triggers booking confirmation
 */

interface TransactionRequest {
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
    }: TransactionRequest = await req.json();

    // ===== CREDENTIAL VALIDATION =====
    const userId = Deno.env.get('POSTFINANCE_USER_ID');
    const spaceId = Deno.env.get('POSTFINANCE_SPACE_ID');
    const authKey = Deno.env.get('POSTFINANCE_AUTHENTICATION_KEY');
    const environment = Deno.env.get('POSTFINANCE_ENVIRONMENT') || 'production';

    if (!userId || !spaceId || !authKey) {
      throw new Error('Missing PostFinance credentials');
    }

    console.log('PostFinance credentials loaded:', {
      userId,
      spaceId,
      environment
    });

    console.log('Creating PostFinance transaction for booking:', booking_id, 'Payment method:', payment_method_type);

    // Validate that this is a card payment (only visa_mastercard and amex work with PostFinance)
    if (payment_method_type !== 'visa_mastercard' && payment_method_type !== 'amex') {
      throw new Error('PostFinance transactions can only be created for card payments (visa_mastercard or amex)');
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

    // Generate booking token for success/failure URLs
    const { data: tokenData, error: tokenError } = await supabaseClient
      .rpc('generate_booking_token', {
        p_booking_id: booking_id,
        p_expires_in_days: 7
      });

    if (tokenError) {
      console.error('Failed to generate booking token:', tokenError);
      throw new Error('Failed to generate booking access token');
    }

    const bookingToken = tokenData;

    // Real PostFinance Checkout API Integration
    const postfinanceSpaceId = Deno.env.get('POSTFINANCE_SPACE_ID');
    const postfinanceUserId = Deno.env.get('POSTFINANCE_USER_ID');
    const postfinanceAuthKey = Deno.env.get('POSTFINANCE_AUTHENTICATION_KEY');
    const visaMastercardConfigId = Deno.env.get('POSTFINANCE_VISA_MASTERCARD_CONFIG_ID');
    const amexConfigId = Deno.env.get('POSTFINANCE_AMEX_CONFIG_ID');
    const postfinanceEnvironment = Deno.env.get('POSTFINANCE_ENVIRONMENT') || 'test';
    const appDomain = Deno.env.get('APP_DOMAIN') || 'https://bookrentmanager.com';

    if (!postfinanceSpaceId || !postfinanceUserId || !postfinanceAuthKey || !visaMastercardConfigId || !amexConfigId) {
      throw new Error('PostFinance credentials not configured. Please set all required environment variables including payment method configuration IDs');
    }

    console.log('Creating PostFinance Transaction:', {
      booking: booking.reference_code,
      amount: finalAmount,
      currency: finalCurrency
    });
    
    // Determine which payment method configuration ID to use
    const paymentMethodConfigId = payment_method_type === 'amex' ? amexConfigId : visaMastercardConfigId;
    
    // Parse and validate the config ID - ensure it's sent as a pure integer
    const cleanConfigId = paymentMethodConfigId!.replace(/[,\s]/g, '').trim();
    const configIdAsNumber = parseInt(cleanConfigId, 10);
    
    if (isNaN(configIdAsNumber)) {
      throw new Error(`Invalid payment method config ID: ${paymentMethodConfigId}`);
    }
    
    console.log('Using Payment Method Config ID:', {
      payment_method_type,
      original_value: paymentMethodConfigId,
      cleaned_value: cleanConfigId,
      parsed_as_number: configIdAsNumber,
      type: typeof configIdAsNumber
    });
    
    // Transaction payload - Official PostFinance CREATE Transaction API structure
    const transactionPayload = {
      // Environment selection (FORCE_TEST_ENVIRONMENT or FORCE_PRODUCTION_ENVIRONMENT)
      environmentSelectionStrategy: postfinanceEnvironment === 'production' 
        ? 'FORCE_PRODUCTION_ENVIRONMENT' 
        : 'FORCE_TEST_ENVIRONMENT',
      
      // Customer information
      customerEmailAddress: booking.client_email,
      customersPresence: "NOT_PRESENT",
      
      // Language and currency
      language: 'en',
      currency: finalCurrency,
      
      // External reference for tracking
      merchantReference: `${booking.reference_code}-${payment_intent}-${Date.now()}`,
      
      // Line items - following official API structure
      lineItems: [{
        shippingRequired: false,
        quantity: 1,
        name: description || `${payment_intent.replace(/_/g, ' ').toUpperCase()} - ${booking.car_model}`,
        taxes: [],
        attributes: {},
        amountIncludingTax: Math.round(finalAmount * 100), // CRITICAL: Convert to cents (minor currency unit)
        discountIncludingTax: 0,
        sku: booking.reference_code,
        type: 'PRODUCT',
        uniqueId: `${payment_intent}_${booking_id.substring(0, 8)}`
      }],
      
      // Metadata for webhook processing (all values must be strings)
      metaData: {
        bookingId: booking_id,
        bookingReference: booking.reference_code,
        paymentIntent: payment_intent,
        originalAmount: amount.toString(),
        originalCurrency: booking.currency,
        feeAmount: feeAmount.toString(),
        feePercentage: paymentMethod.fee_percentage.toString(),
        totalAmount: totalAmount.toString(),
        convertedAmount: finalAmount.toString(),
        convertedCurrency: finalCurrency,
        ...(conversionRate && {
          conversionRate: conversionRate.toString()
        }),
        bookingToken: bookingToken
      },
      
      // Payment method configurations
      allowedPaymentMethodConfigurations: [configIdAsNumber],
      
      // Transaction behavior
      autoConfirmationEnabled: true,
      completionBehavior: "COMPLETE_IMMEDIATELY",
      chargeRetryEnabled: false,
      emailsDisabled: false,
      
      // Success/failure redirect URLs
      successUrl: `${appDomain}/payment-confirmation?session_id=TRANSACTION_ID&token=${bookingToken}`,
      failedUrl: `${appDomain}/booking-form?token=${bookingToken}&payment_failed=true`,
      
      // Billing address (conditionally included)
      ...(booking.billing_address && {
        billingAddress: {
          emailAddress: booking.client_email || '',
          givenName: booking.client_name?.split(' ')[0] || booking.client_name || '',
          familyName: booking.client_name?.split(' ').slice(1).join(' ') || '',
          street: booking.billing_address || '',
          city: '',
          postcode: '',
          country: booking.country || ''
        }
      })
    };

    // Validate transaction payload
    if (!transactionPayload.lineItems[0].amountIncludingTax || transactionPayload.lineItems[0].amountIncludingTax <= 0) {
      throw new Error('Invalid amount: must be positive');
    }
    if (!transactionPayload.currency || transactionPayload.currency.length !== 3) {
      throw new Error('Invalid currency: must be 3-letter ISO code');
    }
    if (!booking.client_email || !booking.client_email.includes('@')) {
      throw new Error('Invalid email address');
    }

    console.log('=== POSTFINANCE REQUEST PAYLOAD ===');
    console.log('Full transaction payload:', JSON.stringify(transactionPayload, null, 2));
    console.log('Payload size:', JSON.stringify(transactionPayload).length, 'bytes');
    console.log('Amount (cents):', transactionPayload.lineItems[0].amountIncludingTax);
    console.log('Currency:', transactionPayload.currency);
    console.log('Customer email:', booking.client_email);
    console.log('Booking reference:', booking.reference_code);
    console.log('=== END REQUEST PAYLOAD ===');

    // Generate correlation ID for request tracking
    const requestId = `pfr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('=== REQUEST CORRELATION ===');
    console.log('Request ID:', requestId);
    console.log('Request timestamp:', new Date().toISOString());
    console.log('===========================');
    
    // ===== JWT AUTHENTICATION IMPLEMENTATION =====
    console.log('=== JWT AUTHENTICATION SETUP ===');
    console.log('User ID:', postfinanceUserId);
    console.log('Space ID:', postfinanceSpaceId);
    console.log('Auth Key Length:', postfinanceAuthKey?.length);
    console.log('Environment:', postfinanceEnvironment);
    
    // Generate JWT timestamp (Unix seconds)
    const iat = Math.floor(Date.now() / 1000);
    
    console.log('JWT Timestamp (iat):', iat);
    console.log('=== END JWT SETUP ===\n');
    
    // Determine API URL based on environment
    const isProduction = Deno.env.get('POSTFINANCE_ENVIRONMENT') === 'production';
    const baseUrl = 'https://checkout.postfinance.ch'; // Same URL for both test and production
    
    // Transaction Create API endpoint
    const requestPath = '/api/transaction/create';
    const apiUrl = `${baseUrl}${requestPath}`;
    
    console.log('=== TRANSACTION CREATE API CALL ===');
    console.log('Calling PostFinance Transaction API:', {
      url: apiUrl,
      endpoint: requestPath,
      environment: isProduction ? 'production' : 'test',
      userId: postfinanceUserId,
      spaceId: postfinanceSpaceId
    });
    console.log('✅ Using Transaction Create API (not Payment Link)');

    // Call PostFinance API with JWT Authentication
    const requestStartTime = Date.now();
    const requestBody = JSON.stringify(transactionPayload);
    
    // Generate JWT for authentication
    // PostFinance uses JWT with HS256 algorithm
    const method = 'POST';
    
    console.log('=== JWT GENERATION ===');
    console.log('Request method:', method);
    console.log('Request path (in JWT):', requestPath);
    console.log('Request path (full URL with query):', apiUrl);
    console.log('🔍 Using Transaction Create endpoint path in JWT');
    console.log('User ID (sub):', postfinanceUserId);
    console.log('Timestamp (iat):', iat);
    
    // JWT Header - CRITICAL FIX: Use 'typ' not 'type' (RFC 7519 standard)
    const jwtHeader = {
      alg: 'HS256',
      typ: 'JWT',
      ver: 1
    };
    
    // JWT Payload - CRITICAL: space must be in JWT claims, not request body
    const jwtPayload = {
      sub: postfinanceUserId,
      iat: iat,
      space: parseInt(postfinanceSpaceId, 10), // REQUIRED: Space ID in JWT claims
      requestPath: requestPath,
      requestMethod: method
    };
    
    // Base64URL encode function
    const base64urlEncode = (str: string) => {
      return btoa(str)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    };
    
    // Encode header and payload
    const encodedHeader = base64urlEncode(JSON.stringify(jwtHeader));
    const encodedPayload = base64urlEncode(JSON.stringify(jwtPayload));
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    
    console.log('JWT Header:', JSON.stringify(jwtHeader));
    console.log('JWT Payload:', JSON.stringify(jwtPayload));
    console.log('Signing input:', signingInput.substring(0, 100) + '...');
    
    // Decode authentication key from base64 (as per PostFinance documentation)
    // The auth key is base64-encoded, we need to decode it to raw bytes
    console.log('=== KEY VALIDATION ===');
    console.log('Auth key (base64) length:', postfinanceAuthKey.length);
    
    const authKeyDecoded = atob(postfinanceAuthKey);
    const keyData = Uint8Array.from(authKeyDecoded, c => c.charCodeAt(0));
    
    console.log('Auth key decoded length:', keyData.length, 'bytes');
    console.log('🔍 CRITICAL: HS256 requires EXACTLY 32 bytes');
    
    if (keyData.length !== 32) {
      console.error('❌ KEY LENGTH MISMATCH!');
      console.error('Expected: 32 bytes, Got:', keyData.length, 'bytes');
      console.error('This will cause authentication to fail');
    } else {
      console.log('✅ Key length valid: 32 bytes');
    }
    
    // Log first and last few bytes for verification (without exposing full key)
    console.log('Key bytes (first 4):', Array.from(keyData.slice(0, 4)));
    console.log('Key bytes (last 4):', Array.from(keyData.slice(-4)));
    console.log('=== END KEY VALIDATION ===');
    
    // Sign with HMAC-SHA256
    const encoder = new TextEncoder();
    const messageData = encoder.encode(signingInput);
    
    console.log('Message to sign length:', messageData.length, 'bytes');
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const signatureArray = Array.from(new Uint8Array(signature));
    const signatureBase64url = btoa(String.fromCharCode(...signatureArray))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    
    const jwtToken = `${signingInput}.${signatureBase64url}`;
    
    console.log('JWT Signature:', signatureBase64url.substring(0, 30) + '...');
    console.log('Complete JWT:', jwtToken.substring(0, 100) + '...');
    console.log('JWT Length:', jwtToken.length);
    console.log('=== END JWT GENERATION ===\n');
    
    // Prepare request headers with JWT authentication
    // CRITICAL: Space ID is in JWT claims, NOT in headers
    const requestHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'BookRentManager/1.0',
      'X-Request-Id': requestId,
      'Authorization': `Bearer ${jwtToken}`,
    };
    
    console.log('=== COMPLETE HTTP REQUEST DETAILS ===');
    console.log('Request ID:', requestId);
    console.log('Timestamp:', new Date().toISOString());
    console.log('Method: POST');
    console.log('URL:', apiUrl);
    console.log('URL Components:');
    console.log('  - Base:', baseUrl);
    console.log('  - Path:', requestPath, '(Transaction Create API)');
    console.log('\nRequest Headers (JWT Authentication):');
    Object.entries(requestHeaders).forEach(([key, value]) => {
      if (key === 'Authorization') {
        console.log(`  ${key}: Bearer ${value.substring(7, 57)}...`);
      } else {
        console.log(`  ${key}: ${value}`);
      }
    });
    console.log('\nRequest Body:');
    console.log('  - Size:', requestBody.length, 'bytes');
    console.log('  - Preview:', requestBody.substring(0, 200) + '...');
    console.log('\nPostFinance Configuration:');
    console.log('  - Space ID:', postfinanceSpaceId);
    console.log('  - User ID:', postfinanceUserId);
    console.log('  - Environment:', postfinanceEnvironment);
    console.log('  - Auth method: JWT (JSON Web Token)');
    console.log('  - JWT Algorithm: HS256');
    console.log('  - JWT Version: 1');
    console.log('=== END REQUEST DETAILS ===\n');
    
    let postfinanceResponse;
    try {
      postfinanceResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: requestHeaders,
        body: requestBody,
      });
      
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
      const requestDuration = Date.now() - requestStartTime;
      
      // STEP 1: Read the body IMMEDIATELY before it becomes stale
      let errorBody: any = null;
      let errorText = '';
      
      console.error('\n=== ❌ POSTFINANCE API ERROR - Reading Body First ===');
      console.error('Request ID:', requestId);
      
      try {
        errorBody = await postfinanceResponse.json();
        errorText = JSON.stringify(errorBody, null, 2);
        console.error('✅ Successfully read JSON response body');
      } catch (jsonErr) {
        console.error('JSON parse failed, trying text...');
        try {
          errorText = await postfinanceResponse.text();
          console.error('✅ Successfully read text response body');
        } catch (textErr) {
          errorText = 'Could not read response body';
          console.error('❌ Could not read response body at all');
        }
      }
      
      // STEP 2: Now do all the diagnostic logging with the body we already captured
      console.error('\n=== FULL DIAGNOSTICS ===');
      console.error('Timestamp:', new Date().toISOString());
      console.error('Duration:', requestDuration, 'ms');
      console.error('Status Code:', postfinanceResponse.status);
      console.error('Status Text:', postfinanceResponse.statusText);
      
      console.error('\n--- Error Response Body ---');
      console.error(errorText);
      
      console.error('\n--- Request That Failed ---');
      console.error('URL:', apiUrl);
      console.error('Method: POST');
      console.error('Space ID:', postfinanceSpaceId);
      console.error('User ID:', postfinanceUserId);
      console.error('Booking:', booking.reference_code);
      console.error('Payment Method:', payment_method_type);
      console.error('Connector ID:', paymentMethodConfigId);
      console.error('Amount:', finalAmount, finalCurrency);
      
      console.error('\n--- Request Headers Sent ---');
      Object.entries(requestHeaders).forEach(([key, value]) => {
        if (key === 'Authorization') {
          console.error(`  ${key}: Bearer ${String(value).substring(7, 37)}...`);
        } else {
          console.error(`  ${key}: ${value}`);
        }
      });
      
      console.error('\n--- Request Payload Summary ---');
      console.error('Currency:', transactionPayload.currency);
      console.error('Line Items:', transactionPayload.lineItems.length);
      console.error('Total Amount (cents):', transactionPayload.lineItems[0].amountIncludingTax);
      console.error('Payment Method Configs:', JSON.stringify(transactionPayload.allowedPaymentMethodConfigurations));
      console.error('Auth format: JWT (JSON Web Token with HS256)');
      console.error('Body size:', requestBody.length, 'bytes');
      
      console.error('\n=== END FULL DIAGNOSTICS ===\n');
      
      return new Response(
        JSON.stringify({
          error: 'PostFinance API Error',
          request_id: requestId,
          status: postfinanceResponse.status,
          statusText: postfinanceResponse.statusText,
          details: errorBody || errorText,
          response_status: postfinanceResponse.status,
          debugging: {
            auth_method: 'JWT (HS256)',
            request_url: apiUrl,
            space_id: postfinanceSpaceId,
            user_id: postfinanceUserId,
            request_duration_ms: requestDuration,
            payload_size_bytes: JSON.stringify(transactionPayload).length
          },
          
          next_steps: [
            'Check the edge function logs for detailed request information',
            'Verify all credentials in Lovable Cloud backend settings',
            'Ensure the space ID matches your PostFinance account',
            'Contact PostFinance support with the Request ID if issue persists'
          ]
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SUCCESS: Extract transaction details from response
    const transactionData = await postfinanceResponse.json();
    
    // The response structure contains redirectUrl for payment page
    const paymentRedirectUrl = transactionData.redirectUrl || transactionData.url;
    const transactionId = transactionData.id?.toString() || transactionData.transaction?.id?.toString();
    
    if (!paymentRedirectUrl) {
      console.error('Missing redirectUrl in response:', JSON.stringify(transactionData, null, 2));
      throw new Error('PostFinance response missing payment redirect URL');
    }
    
    console.log('=== ✅ TRANSACTION CREATED SUCCESSFULLY ===');
    console.log('Request ID:', requestId);
    console.log('Duration:', Date.now() - requestStartTime, 'ms');
    console.log('Transaction ID:', transactionId);
    console.log('Redirect URL:', paymentRedirectUrl);
    console.log('Full response:', JSON.stringify(transactionData, null, 2));
    console.log('=== END SUCCESS ===\n');

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
        payment_link_id: transactionId,
        payment_link_url: paymentRedirectUrl,
        payment_link_status: 'active',
        postfinance_session_id: transactionId,
        postfinance_transaction_id: transactionId,
        payment_intent,
        note: description || `${payment_intent.replace('_', ' ')} via ${paymentMethod.display_name}`,
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Failed to create payment record:', paymentError);
      throw paymentError;
    }

    console.log('Payment record created:', payment.id);

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: payment.id,
        redirectUrl: paymentRedirectUrl,
        transaction_id: transactionId,
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
    console.error('Transaction creation failed:', error);
    
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to create transaction',
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
