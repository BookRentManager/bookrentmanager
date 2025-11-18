import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

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

    // Get available payment methods
    const { data: paymentMethods, error: pmError } = await supabaseClient
      .from('payment_methods')
      .select('*')
      .eq('is_enabled', true)
      .order('sort_order');

    if (pmError) {
      console.error('Error fetching payment methods:', pmError);
    }

    console.log('Booking fetched successfully:', booking.reference_code);

    return new Response(
      JSON.stringify({
        booking: booking,
        terms_and_conditions: terms,
        payment_methods: paymentMethods || [],
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
