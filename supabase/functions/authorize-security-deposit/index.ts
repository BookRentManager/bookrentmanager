import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AuthorizationRequest {
  booking_id: string;
  amount: number;
  currency?: string;
  expires_in_hours?: number;
  payment_method_type?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { booking_id, amount, currency = 'EUR', expires_in_hours = 8760, payment_method_type = 'visa_mastercard' } = await req.json() as AuthorizationRequest;

    if (!booking_id || !amount) {
      throw new Error('booking_id and amount are required');
    }

    console.log('Creating security deposit authorization for booking:', booking_id);

    // Get booking details
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select('reference_code')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      throw new Error('Booking not found');
    }

    // Check if authorization record already exists for this booking
    const { data: existingAuth } = await supabaseClient
      .from('security_deposit_authorizations')
      .select('id, authorization_id, status, expires_at')
      .eq('booking_id', booking_id)
      .in('status', ['pending', 'authorized'])
      .maybeSingle();

    let authorizationRecord: any = null;
    let isReusingAuth = false;

    // If authorization exists and is still valid, reuse it for different payment method
    if (existingAuth && (!existingAuth.expires_at || new Date(existingAuth.expires_at) > new Date())) {
      console.log('Reusing existing security deposit authorization:', existingAuth.id);
      authorizationRecord = existingAuth;
      isReusingAuth = true;
    }

    // Only create new authorization record if we're not reusing an existing one
    if (!isReusingAuth) {
      // Create payment link for security deposit authorization
      const paymentLinkResult = await supabaseClient.functions.invoke('create-postfinance-payment-link', {
        body: {
          booking_id,
          amount,
          currency,
          payment_type: 'deposit',
          payment_intent: 'security_deposit',
          payment_method_type: payment_method_type,
          expires_in_hours,
          description: `Security deposit authorization for booking ${booking.reference_code}`,
          send_email: false, // Don't send email for security deposit (will be included in booking confirmation)
        },
      });

      if (paymentLinkResult.error) {
        throw paymentLinkResult.error;
      }

      const { payment_id, redirectUrl } = paymentLinkResult.data;

      // Create authorization record
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expires_in_hours);

      const { data: authRecord, error: authError } = await supabaseClient
        .from('security_deposit_authorizations')
        .insert({
          booking_id,
          authorization_id: payment_id,
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

      authorizationRecord = authRecord;
      console.log('Security deposit authorization created successfully:', authRecord.id);

      // Return response with redirect URL for new authorization
      return new Response(
        JSON.stringify({
          authorization_id: authorizationRecord.id,
          redirectUrl: redirectUrl,
          payment_id: payment_id,
          expires_at: authorizationRecord.expires_at,
          amount,
          currency,
          reused_existing: false,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } else {
      // Create additional payment link for different payment method using existing authorization
      const paymentLinkResult = await supabaseClient.functions.invoke('create-postfinance-payment-link', {
        body: {
          booking_id,
          amount,
          currency,
          payment_type: 'deposit',
          payment_intent: 'security_deposit',
          payment_method_type: payment_method_type,
          expires_in_hours,
          description: `Security deposit authorization for booking ${booking.reference_code}`,
          send_email: false,
        },
      });

      if (paymentLinkResult.error) {
        throw paymentLinkResult.error;
      }

      const { redirectUrl, payment_id } = paymentLinkResult.data;

      console.log('Created additional payment method link for existing authorization:', authorizationRecord.id);

      // Return response with redirect URL for reused authorization
      return new Response(
        JSON.stringify({
          authorization_id: authorizationRecord.id,
          redirectUrl: redirectUrl,
          payment_id: payment_id,
          expires_at: authorizationRecord.expires_at,
          amount,
          currency,
          reused_existing: true,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }
  } catch (error: any) {
    console.error('Error in authorize-security-deposit:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An unexpected error occurred' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
