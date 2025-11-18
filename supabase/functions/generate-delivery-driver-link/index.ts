import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { booking_id, purpose, expires_in_hours = 24 } = await req.json();

    if (!booking_id || !purpose) {
      throw new Error('Missing required fields: booking_id and purpose');
    }

    console.log('Generating delivery driver link for booking:', booking_id);

    // Verify booking exists
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select('id, reference_code')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      throw new Error('Booking not found');
    }

    // Generate secure token
    const token = generateSecureToken();
    const expiresAt = new Date(Date.now() + expires_in_hours * 60 * 60 * 1000);

    // Create access token
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('booking_access_tokens')
      .insert({
        booking_id,
        token,
        expires_at: expiresAt.toISOString(),
        permission_level: 'delivery_driver_edit',
        description: `Delivery driver - ${purpose}`,
      })
      .select()
      .single();

    if (tokenError) {
      console.error('Error creating token:', tokenError);
      throw new Error('Failed to create access token');
    }

    const appDomain = Deno.env.get('APP_DOMAIN') || 'https://lbvaghmqwhsawvxyiemw.lovableproject.com';
    const link = `${appDomain}/driver-portal/${token}`;

    console.log('Delivery driver link generated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        link,
        token: tokenData.token,
        expires_at: tokenData.expires_at,
        purpose,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error generating delivery driver link:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});