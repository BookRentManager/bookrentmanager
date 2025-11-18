import { createClient } from 'npm:@supabase/supabase-js@2';
import { encodeBase64, decodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

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

    console.log('Creating PostFinance transaction:', {
      amount: finalAmount,
      currency: finalCurrency,
      booking: booking.reference_code,
    });

    // Generate MAC authentication headers (HMAC-SHA512)
    const timestamp = Date.now().toString();
    const macVersion = '1';
    
    // Create the data to sign: METHOD|PATH|TIMESTAMP
    const method = 'POST';
    const path = `/api/transaction/create?spaceId=${postfinanceSpaceId}`;
    const dataToSign = `${method}|${path}|${timestamp}`;
    
    console.log('Creating MAC signature for:', dataToSign);
    
    // Sign with HMAC-SHA512
    const encoder = new TextEncoder();
    // Decode the base64-encoded PostFinance authentication key
    const keyData = Uint8Array.from(atob(postfinanceAuthKey), c => c.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      encoder.encode(dataToSign)
    );
    
    const macValue = encodeBase64(new Uint8Array(signature));
    
    console.log('Generated MAC authentication headers');

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
    let postfinanceResponse;
    try {
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
    } catch (fetchError) {
      const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
      console.error('Network error calling PostFinance API:', {
        error: errorMessage,
        url: apiUrl,
        spaceId: postfinanceSpaceId
      });
      return new Response(
        JSON.stringify({ 
          error: 'Network error connecting to PostFinance',
          details: errorMessage,
          suggestion: 'Check if PostFinance API is accessible and credentials are correct'
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!postfinanceResponse.ok) {
      const errorText = await postfinanceResponse.text();
      console.error('PostFinance API Error Response:', {
        status: postfinanceResponse.status,
        statusText: postfinanceResponse.statusText,
        body: errorText,
        headers: Object.fromEntries(postfinanceResponse.headers.entries()),
        requestUrl: apiUrl,
        spaceId: postfinanceSpaceId,
        userId: postfinanceUserId
      });
      
      let errorMessage = `PostFinance API error: ${postfinanceResponse.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error || errorText;
      } catch {
        errorMessage = errorText || postfinanceResponse.statusText;
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'PostFinance API rejected the request',
          status: postfinanceResponse.status,
          details: errorMessage,
          suggestion: 'Check PostFinance credentials and space configuration'
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
