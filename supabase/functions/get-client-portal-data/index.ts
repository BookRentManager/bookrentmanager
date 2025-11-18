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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { token } = await req.json();

    if (!token) {
      throw new Error('Token is required');
    }

    console.log('Fetching client portal data for token:', token.substring(0, 8) + '...');

    // Validate token and get booking ID with permission level
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('booking_access_tokens')
      .select('booking_id, expires_at, permission_level')
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
    await supabaseClient.rpc('track_token_access', { p_token: token });

    // Get booking details
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select('*')
      .eq('id', tokenData.booking_id)
      .single();

    if (bookingError || !booking) {
      console.error('Booking not found:', bookingError);
      throw new Error('Booking not found');
    }

    // Get booking documents with extra cost approvals
    const { data: documents, error: docsError } = await supabaseClient
      .from('booking_documents')
      .select(`
        *,
        extra_cost_approval:extra_cost_approvals(id, approved_at)
      `)
      .eq('booking_id', tokenData.booking_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (docsError) {
      console.error('Error fetching documents:', docsError);
    }

    // Get payments and payment links
    let { data: payments, error: paymentsError } = await supabaseClient
      .from('payments')
      .select('*')
      .eq('booking_id', tokenData.booking_id)
      .order('created_at', { ascending: false });

    if (paymentsError) {
      console.error('Error fetching payments:', paymentsError);
    }

    // Get security deposit authorizations
    let { data: securityDeposits, error: sdError } = await supabaseClient
      .from('security_deposit_authorizations')
      .select('*')
      .eq('booking_id', tokenData.booking_id)
      .order('created_at', { ascending: false });

    if (sdError) {
      console.error('Error fetching security deposits:', sdError);
    }

    // Payment links are now generated on-demand by clients via payment method selection dialog

    // Get active terms and conditions
    const { data: activeTC, error: tcError } = await supabaseClient
      .from('terms_and_conditions')
      .select('id, version, content')
      .eq('is_active', true)
      .single();

    if (tcError) {
      console.error('Error fetching T&C:', tcError);
    }

    // Get payment methods
    const { data: paymentMethods, error: pmError } = await supabaseClient
      .from('payment_methods')
      .select('*')
      .eq('is_enabled', true)
      .order('sort_order');

    if (pmError) {
      console.error('Error fetching payment methods:', pmError);
    }

    // Get app settings
    const { data: appSettings, error: settingsError } = await supabaseClient
      .from('app_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      console.error('Error fetching app settings:', settingsError);
    }

    // Get rental policies
    const { data: rentalPolicies, error: policiesError } = await supabaseClient
      .from('rental_policies')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (policiesError) {
      console.error('Error fetching rental policies:', policiesError);
    }

    // Get delivery process steps
    const { data: deliverySteps, error: stepsError } = await supabaseClient
      .from('delivery_process_steps')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (stepsError) {
      console.error('Error fetching delivery steps:', stepsError);
    }

    console.log('Client portal data fetched successfully for:', booking.reference_code);

    return new Response(
      JSON.stringify({
        booking,
        documents: documents || [],
        payments: payments || [],
        security_deposits: securityDeposits || [],
        terms_and_conditions: activeTC || null,
        payment_methods: paymentMethods || [],
        app_settings: appSettings || null,
        rental_policies: rentalPolicies || [],
        delivery_steps: deliverySteps || [],
        permission_level: tokenData.permission_level || 'client_view_only',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in get-client-portal-data:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An unexpected error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
