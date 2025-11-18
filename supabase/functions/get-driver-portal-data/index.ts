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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { token } = await req.json();

    if (!token) {
      throw new Error('Token is required');
    }

    console.log('Fetching driver portal data for token:', token.substring(0, 8) + '...');

    // Validate token and get booking ID
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('booking_access_tokens')
      .select('booking_id, expires_at, permission_level, access_count')
      .eq('token', token)
      .single();

    if (tokenError || !tokenData) {
      console.error('Token not found:', tokenError);
      throw new Error('Invalid or expired booking link');
    }

    // Verify permission level is delivery_driver_edit
    if (tokenData.permission_level !== 'delivery_driver_edit') {
      console.error('Invalid permission level:', tokenData.permission_level);
      throw new Error('Invalid access token for driver portal');
    }

    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      console.error('Token expired:', tokenData.expires_at);
      throw new Error('This booking link has expired');
    }

    // Track access
    await supabaseClient.rpc('track_token_access', { p_token: token });

    // Get minimal booking details (no client personal or financial info)
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select('id, reference_code, car_model, car_plate, delivery_datetime, collection_datetime, delivery_location, collection_location')
      .eq('id', tokenData.booking_id)
      .is('deleted_at', null)
      .single();

    if (bookingError || !booking) {
      console.error('Booking not found:', bookingError);
      throw new Error('Booking not found');
    }

    // Get only rental-related documents
    const { data: documents, error: docsError } = await supabaseClient
      .from('booking_documents')
      .select('*')
      .eq('booking_id', tokenData.booking_id)
      .in('document_type', [
        'rental_contract_delivery',
        'rental_contract_collection',
        'car_condition_delivery_photo',
        'car_condition_delivery_video',
        'car_condition_collection_photo',
        'car_condition_collection_video'
      ])
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (docsError) {
      console.error('Error fetching documents:', docsError);
    }

    console.log('Driver portal data fetched successfully for:', booking.reference_code);

    return new Response(
      JSON.stringify({
        booking,
        documents: documents || [],
        permission_level: tokenData.permission_level,
        token: {
          expires_at: tokenData.expires_at,
          access_count: tokenData.access_count + 1,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in get-driver-portal-data:', error);
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
