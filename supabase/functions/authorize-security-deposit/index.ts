import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AuthorizationRequest {
  booking_id: string;
  amount: number;
  currency?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { booking_id, amount, currency = 'EUR' }: AuthorizationRequest = await req.json();

    if (!booking_id || !amount) {
      return new Response(
        JSON.stringify({ error: 'booking_id and amount are required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`🔒 Creating security deposit authorization for booking ${booking_id}`);

    // Get booking details
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('reference_code')
      .eq('id', booking_id)
      .single();

    if (fetchError || !booking) {
      throw new Error('Booking not found');
    }

    // Create PostFinance payment link in authorization mode
    const { data: paymentData, error: paymentError } = await supabase.functions.invoke(
      'create-postfinance-payment-link',
      {
        body: {
          booking_id,
          amount,
          payment_type: 'security_deposit_authorization',
          description: `Security deposit authorization for booking ${booking.reference_code}`,
          expiry_hours: 720, // 30 days
        },
      }
    );

    if (paymentError) {
      console.error('Error creating authorization link:', paymentError);
      throw paymentError;
    }

    // Create authorization record
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days from now

    const { data: authRecord, error: authError } = await supabase
      .from('security_deposit_authorizations')
      .insert({
        booking_id,
        authorization_id: paymentData.payment_id,
        amount,
        currency,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (authError) {
      console.error('Error creating authorization record:', authError);
      throw authError;
    }

    console.log(`✅ Authorization created: ${authRecord.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        authorization_id: authRecord.id,
        authorization_url: paymentData.payment_url,
        expires_at: expiresAt.toISOString(),
        amount,
        currency,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in authorize-security-deposit:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});