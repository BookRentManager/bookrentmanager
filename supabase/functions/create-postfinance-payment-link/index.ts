import { createClient } from 'npm:@supabase/supabase-js@2';

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

    if (!userId || !spaceId || !authKey) {
      throw new Error('Missing PostFinance credentials');
    }

    console.log('PostFinance credentials loaded:', {
      userId,
      spaceId,
      environment
    });

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
    const postfinanceEnvironment = Deno.env.get('POSTFINANCE_ENVIRONMENT') || 'test';
    const appDomain = Deno.env.get('APP_DOMAIN') || 'https://bookrentmanager.com';

    if (!postfinanceSpaceId || !postfinanceUserId || !postfinanceAuthKey) {
      throw new Error('PostFinance credentials not configured');
    }

    console.log('Creating PostFinance transaction:', {
      booking: booking.reference_code,
      amount: finalAmount,
      currency: finalCurrency
    });
    const transactionPayload = {
      currency: finalCurrency,
      lineItems: [{
        name: description || `${payment_intent.replace(/_/g, ' ').toUpperCase()} - ${booking.car_model}`,
        quantity: 1,
        amountIncludingTax: Math.round(finalAmount * 100), // Convert to cents
        type: 'PRODUCT',
        uniqueId: `${payment_intent}_${booking_id.substring(0, 8)}`,
      }],
      successUrl: `${appDomain}/payment/confirmation?${new URLSearchParams({ session_id: '{TRANSACTION_ID}', status: 'success' }).toString()}`,
      failedUrl: `${appDomain}/payment/confirmation?${new URLSearchParams({ session_id: '{TRANSACTION_ID}', status: 'failed' }).toString()}`,
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
    
    const apiUrl = `${baseUrl}/api/transaction/create?spaceId=${postfinanceSpaceId}`;
    
    console.log('Calling PostFinance API:', {
      url: apiUrl,
      environment: isProduction ? 'production' : 'test',
      userId: postfinanceUserId,
      spaceId: postfinanceSpaceId
    });

    // Call PostFinance API with MAC Authentication
    const requestStartTime = Date.now();
    const requestBody = JSON.stringify(transactionPayload);
    
    // Generate JWT for authentication
    // PostFinance uses JWT with HS256 algorithm
    const method = 'POST';
    const requestPath = `/api/transaction/create?spaceId=${postfinanceSpaceId}`;
    
    console.log('=== JWT GENERATION ===');
    console.log('Request method:', method);
    console.log('Request path:', requestPath);
    console.log('User ID (sub):', postfinanceUserId);
    console.log('Timestamp (iat):', iat);
    
    // JWT Header
    const jwtHeader = {
      alg: 'HS256',
      type: 'JWT',
      ver: 1
    };
    
    // JWT Payload
    const jwtPayload = {
      sub: postfinanceUserId,
      iat: iat,
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
    
    // Decode authentication key from base64
    const authKeyDecoded = atob(postfinanceAuthKey);
    
    // Sign with HMAC-SHA256
    const encoder = new TextEncoder();
    const keyData = encoder.encode(authKeyDecoded);
    const messageData = encoder.encode(signingInput);
    
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
    console.log('  - Path:', '/api/transaction/create');
    console.log('  - Query param: spaceId=' + postfinanceSpaceId);
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
      const errorText = await postfinanceResponse.text();
      const responseHeaders = Object.fromEntries(postfinanceResponse.headers.entries());
      const requestDuration = Date.now() - requestStartTime;
      
      console.error('\n=== ❌ POSTFINANCE API ERROR ===');
      console.error('Request ID:', requestId);
      console.error('Timestamp:', new Date().toISOString());
      console.error('Duration:', requestDuration, 'ms');
      console.error('\nHTTP Response:');
      console.error('  - Status Code:', postfinanceResponse.status);
      console.error('  - Status Text:', postfinanceResponse.statusText);
      console.error('  - Response Type:', postfinanceResponse.type);
      
      console.error('\nResponse Headers:');
      Object.entries(responseHeaders).forEach(([key, value]) => {
        console.error(`  ${key}: ${value}`);
      });
      
      console.error('\nResponse Body (raw):');
      console.error(errorText);
      
      // Parse structured error if available
      let structuredError = null;
      try {
        structuredError = JSON.parse(errorText);
        console.error('\nParsed Error Object:');
        console.error(JSON.stringify(structuredError, null, 2));
        
        // Check for specific error patterns
        if (structuredError.message?.includes('Anonymous')) {
          console.error('\n⚠️ AUTHENTICATION ISSUE DETECTED:');
          console.error('  - Error indicates anonymous/unauthenticated user');
          console.error('  - PostFinance is NOT recognizing the JWT authentication');
          console.error('  - User ID sent:', postfinanceUserId);
          console.error('  - Space ID sent:', postfinanceSpaceId);
          console.error('  - JWT Timestamp (iat):', iat);
          console.error('\n🔍 JWT Authentication Debugging:');
          console.error('  1. Verify JWT signature calculation uses HS256 with decoded auth key');
          console.error('  2. Check if JWT payload includes all required fields');
          console.error('  3. Confirm authentication key is base64-encoded and decoded correctly');
          console.error('  4. Verify User ID has permission for Space', postfinanceSpaceId);
          console.error('  5. Try regenerating authentication key in PostFinance dashboard');
        }
      } catch {
        console.error('\nError response is not valid JSON');
      }
      
      console.error('\n📤 Original Request Details:');
      console.error('  - URL:', apiUrl);
      console.error('  - Method: POST');
      console.error('  - Space ID:', postfinanceSpaceId);
      console.error('  - User ID:', postfinanceUserId);
      console.error('  - Auth Key length:', postfinanceAuthKey?.length);
      console.error('  - Environment:', postfinanceEnvironment);
      console.error('  - Auth format: JWT (JSON Web Token with HS256)');
      console.error('  - Body size:', requestBody.length, 'bytes');
      console.error('=== END ERROR RESPONSE ===\n');
      
      return new Response(
        JSON.stringify({
          error: 'PostFinance API Error',
          request_id: requestId,
          status: postfinanceResponse.status,
          statusText: postfinanceResponse.statusText,
          details: structuredError || errorText,
          response_headers: responseHeaders,
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

    const transactionData = await postfinanceResponse.json();
    const sessionId = transactionData.id?.toString();
    const paymentPageUrl = transactionData.paymentPageUrl;
    
    console.log('\n=== ✅ SUCCESS RESPONSE ===');
    console.log('Request ID:', requestId);
    console.log('Duration:', Date.now() - requestStartTime, 'ms');
    console.log('Transaction ID:', sessionId);
    console.log('Payment URL:', paymentPageUrl);
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
      console.error('Failed to create payment record:', paymentError);
      throw paymentError;
    }

    console.log('Payment record created:', payment.id);

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
    console.error('Payment link creation failed:', error);
    
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to create payment link',
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
