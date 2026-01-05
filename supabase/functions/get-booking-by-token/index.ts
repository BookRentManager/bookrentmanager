import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use service role key to bypass RLS - security is handled by token validation
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { token } = await req.json();

    if (!token) {
      throw new Error('Token is required');
    }

    console.log('Fetching booking for token:', token.substring(0, 8) + '...');

    // Get token and check expiry
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('booking_access_tokens')
      .select('booking_id, expires_at, access_count')
      .eq('token', token)
      .single();

    if (tokenError || !tokenData) {
      console.error('Token not found:', tokenError);
      throw new Error('Invalid or expired booking link');
    }

    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      console.error('Token expired:', tokenData.expires_at);
      throw new Error('This booking link has expired');
    }

    // Track access
    const { error: trackError } = await supabaseClient.rpc('track_token_access', { 
      p_token: token 
    });

    if (trackError) {
      console.error('Error tracking token access:', trackError);
    }

    // Update last accessed timestamp on booking
    await supabaseClient
      .from('bookings')
      .update({ booking_form_last_accessed_at: new Date().toISOString() })
      .eq('id', tokenData.booking_id);

    // Get booking details with related data (including rental_day_hour_tolerance)
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select(`
        *,
        client_invoices (
          id,
          invoice_number,
          total_amount,
          payment_status
        )
      `)
      .eq('id', tokenData.booking_id)
      .single();

    if (bookingError || !booking) {
      console.error('Booking not found:', bookingError);
      throw new Error('Booking not found');
    }

    // DEBUG: Log payment configuration
    console.log('Booking payment config:', {
      reference: booking.reference_code,
      payment_amount_option: booking.payment_amount_option,
      payment_amount_percent: booking.payment_amount_percent,
      typeOfOption: typeof booking.payment_amount_option,
    });

    // Get active terms and conditions
    const { data: activeTC, error: tcError } = await supabaseClient
      .from('terms_and_conditions')
      .select('id, version, content, pdf_url')
      .eq('is_active', true)
      .single();

    // Fallback to default terms if none are active
    const terms = activeTC || {
      id: 'default',
      version: '1.0',
      content: 'Please contact us for the current terms and conditions.',
      pdf_url: null
    };

    if (tcError) {
      console.error('Error fetching T&C:', tcError);
    }

    // Get available payment methods - filter based on booking's configured methods
    let { data: paymentMethods, error: pmError } = await supabaseClient
      .from('payment_methods')
      .select('*')
      .eq('is_enabled', true)
      .order('sort_order');

    if (pmError) {
      console.error('Error fetching payment methods:', pmError);
    }

    // Filter payment methods based on booking's available_payment_methods configuration
    let filteredPaymentMethods = paymentMethods || [];
    if (booking.available_payment_methods) {
      const allowedMethods = Array.isArray(booking.available_payment_methods) 
        ? booking.available_payment_methods 
        : JSON.parse(booking.available_payment_methods);
      
      // Filter to only methods configured for this booking
      filteredPaymentMethods = filteredPaymentMethods.filter(pm => 
        allowedMethods.includes(pm.method_type)
      );
      
      // Add manual payment method if configured for down payment
      if (allowedMethods.includes('manual') && booking.manual_payment_for_downpayment) {
        // Add a synthetic "manual" payment method if it's not already in the list
        const hasManual = filteredPaymentMethods.some(pm => pm.method_type === 'manual');
        if (!hasManual) {
          filteredPaymentMethods.push({
            id: 'manual-synthetic',
            method_type: 'manual',
            display_name: 'Manual/Cash/Crypto',
            description: booking.manual_instructions_downpayment || 'Pay via alternative method as instructed',
            fee_percentage: 0,
            currency: 'EUR',
            requires_conversion: false,
            is_enabled: true,
            admin_only: false,
            sort_order: 999
          });
        }
      }
    }

    // Build manual payment configuration object
    const manualPaymentConfig = {
      downpayment: {
        enabled: booking.manual_payment_for_downpayment || false,
        instructions: booking.manual_instructions_downpayment || null
      },
      balance: {
        enabled: booking.manual_payment_for_balance || false,
        instructions: booking.manual_instructions_balance || null
      },
      security_deposit: {
        enabled: booking.manual_payment_for_security_deposit || false,
        instructions: booking.manual_instructions_security_deposit || null
      }
    };

    console.log('Booking fetched successfully:', booking.reference_code);

    return new Response(
      JSON.stringify({
        booking: booking,
        terms_and_conditions: terms,
        payment_methods: filteredPaymentMethods,
        manual_payment_config: manualPaymentConfig,
        access_count: tokenData.access_count + 1,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in get-booking-by-token:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An unexpected error occurred',
        booking: null,
        terms_and_conditions: null,
        payment_methods: []
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
