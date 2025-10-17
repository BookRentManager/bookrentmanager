import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PaymentLinkRequest {
  booking_id: string;
  amount: number;
  payment_type: 'deposit' | 'rental' | 'additional';
  payment_intent: 'down_payment' | 'final_payment' | 'additional_payment';
  expires_in_hours?: number;
  description?: string;
  send_email?: boolean;
}

serve(async (req) => {
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
      expires_in_hours = 48,
      description,
      send_email = false
    }: PaymentLinkRequest = await req.json();

    console.log('Creating payment link for booking:', booking_id);

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

    // Calculate expiry time
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expires_in_hours);

    // TODO: Integrate with actual PostFinance API
    // For now, create a mock payment link
    const mockSessionId = `pf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Redirect to our internal checkout page that simulates PostFinance
    const appDomain = Deno.env.get('APP_DOMAIN') || 'https://bookrentmanager.com';
    const mockPaymentUrl = `${appDomain}/payment/checkout?session_id=${mockSessionId}`;

    console.log('Generated payment link:', mockPaymentUrl);

    // Insert payment record
    const { data: payment, error: paymentError } = await supabaseClient
      .from('payments')
      .insert({
        booking_id,
        amount,
        type: payment_type,
        method: 'card',
        payment_link_id: mockSessionId,
        payment_link_url: mockPaymentUrl,
        payment_link_status: 'active',
        payment_link_expires_at: expiresAt.toISOString(),
        postfinance_session_id: mockSessionId,
        payment_intent,
        note: description || `${payment_intent.replace('_', ' ')} via PostFinance`,
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Payment insert error:', paymentError);
      throw paymentError;
    }

    console.log('Payment record created:', payment.id);

    // Optional: Send email to client
    if (send_email && booking.client_email) {
      console.log('Sending payment link email to:', booking.client_email);
      // TODO: Integrate with email service
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: payment.id,
        payment_link: mockPaymentUrl,
        expires_at: expiresAt.toISOString(),
        amount,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error creating payment link:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
