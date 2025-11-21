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
    
    // Helper function to generate JWT token for PostFinance API
    const generateJWT = async (
      requestPath: string,
      requestMethod: string,
      userId: string,
      authKey: string
    ): Promise<string> => {
      const currentTimestamp = Math.floor(Date.now() / 1000); // UNIX timestamp in seconds
      
      // JWT Header
      const jwtHeader = {
        alg: 'HS256',
        type: 'JWT',
        ver: 1
      };
      
      // JWT Payload
      const jwtPayload = {
        sub: userId,
        iat: currentTimestamp,
        requestPath: requestPath,
        requestMethod: requestMethod
      };
      
      // Base64 URL encode (without padding)
      const base64UrlEncode = (obj: any): string => {
        const json = JSON.stringify(obj);
        const base64 = btoa(json);
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      };
      
      const encodedHeader = base64UrlEncode(jwtHeader);
      const encodedPayload = base64UrlEncode(jwtPayload);
      const dataToSign = `${encodedHeader}.${encodedPayload}`;
      
      // Decode the base64-encoded authentication key
      const decodedAuthKey = Uint8Array.from(atob(authKey), c => c.charCodeAt(0));
      
      // Sign with HMAC-SHA256
      const encoder = new TextEncoder();
      const data = encoder.encode(dataToSign);
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        decodedAuthKey,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
      
      // Convert signature to base64url
      const signatureArray = new Uint8Array(signature);
      const signatureBase64 = btoa(String.fromCharCode(...signatureArray));
      const signatureBase64Url = signatureBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      
      // Complete JWT token
      const jwtToken = `${encodedHeader}.${encodedPayload}.${signatureBase64Url}`;
      
      console.log('JWT token generated for user:', userId, 'at timestamp:', currentTimestamp);
      
      return jwtToken;
    };
    
    // Generate JWT token for transaction creation endpoint
    const jwtToken = await generateJWT(
      '/api/v2.0/payment/transactions',
      'POST',
      postfinanceUserId,
      postfinanceAuthKey
    );
    
    // Construct the transaction creation URL (v2.0 endpoint)
    const apiUrl = `https://checkout.postfinance.ch/api/v2.0/payment/transactions`;
    
    console.log('Creating transaction:', {
      url: apiUrl,
      booking: booking.reference_code,
      amount_cents: Math.round(finalAmount * 100)
    });

    // Call PostFinance API
    const requestStartTime = Date.now();
    const requestBody = JSON.stringify(transactionPayload);
    
    let postfinanceResponse;
    try {
      postfinanceResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${jwtToken}`,
          'space': postfinanceSpaceId,
        },
        body: requestBody,
      });
      
      console.log('PostFinance responded:', postfinanceResponse.status, 'in', Date.now() - requestStartTime, 'ms');
      
    } catch (fetchError) {
      console.error('Network error:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to connect to PostFinance' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!postfinanceResponse.ok) {
      let errorBody: any = null;
      
      try {
        errorBody = await postfinanceResponse.json();
      } catch (e) {
        console.error('Could not parse error response');
      }
      
      console.error('PostFinance API error:', {
        status: postfinanceResponse.status,
        body: errorBody
      });
      
      return new Response(
        JSON.stringify({
          error: 'PostFinance API Error',
          status: postfinanceResponse.status,
          details: errorBody,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SUCCESS: Extract transaction details from response
    const transactionData = await postfinanceResponse.json();
    
    // Extract transaction ID from creation response
    const transactionId = transactionData.id?.toString();
    
    if (!transactionId) {
      console.error('Missing transaction ID in response:', JSON.stringify(transactionData, null, 2));
      throw new Error('PostFinance response missing transaction ID');
    }
    
    console.log('Transaction created with ID:', transactionId);
    
    // Make second API call to get payment page URL using correct v2.0 endpoint
    const paymentPageUrl = `https://checkout.postfinance.ch/api/v2.0/payment/transactions/${transactionId}/payment-page-url`;
    
    console.log('Fetching payment page URL for transaction:', transactionId);
    console.log('Space ID being sent:', { value: postfinanceSpaceId, type: typeof postfinanceSpaceId });
    
    // Generate NEW JWT token specifically for the payment-page-url endpoint
    const paymentPageJWT = await generateJWT(
      `/api/v2.0/payment/transactions/${transactionId}/payment-page-url`,
      'GET',
      postfinanceUserId,
      postfinanceAuthKey
    );
    
    console.log('Generated payment page URL JWT for transaction:', transactionId);
    
    const paymentPageResponse = await fetch(paymentPageUrl, {
      method: 'GET',
      headers: {
        'Accept': '*/*', // Accept any content type
        'Authorization': `Bearer ${paymentPageJWT}`, // Use NEW endpoint-specific JWT
        'space': postfinanceSpaceId, // Space ID as header (env vars are already strings)
      },
    });
    
    console.log('Payment page URL response status:', paymentPageResponse.status);
    
    if (!paymentPageResponse.ok) {
      const errorText = await paymentPageResponse.text();
      console.error('Failed to fetch payment page URL:', {
        status: paymentPageResponse.status,
        body: errorText
      });
      throw new Error('Failed to retrieve payment page URL from PostFinance');
    }
    
    // Try to get the response - it might be JSON or plain text
    const contentType = paymentPageResponse.headers.get('content-type');
    let paymentPageData;
    
    if (contentType?.includes('application/json')) {
      paymentPageData = await paymentPageResponse.json();
    } else {
      // Might be plain text URL
      paymentPageData = await paymentPageResponse.text();
    }
    
    console.log('Payment page response:', { contentType, dataType: typeof paymentPageData, data: paymentPageData });
    
    // Extract URL flexibly - might be a string directly or an object with a URL property
    const paymentRedirectUrl = typeof paymentPageData === 'string' 
      ? paymentPageData 
      : paymentPageData.paymentPageUrl || paymentPageData.url || paymentPageData;
    
    if (!paymentRedirectUrl) {
      console.error('Missing paymentPageUrl in response:', JSON.stringify(paymentPageData, null, 2));
      throw new Error('PostFinance response missing payment page URL');
    }
    
    console.log('Payment page URL retrieved successfully:', {
      transaction_id: transactionId,
      redirect_url: paymentRedirectUrl
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
