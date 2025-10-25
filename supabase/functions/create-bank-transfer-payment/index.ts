import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { booking_id, amount, payment_type, payment_intent } = await req.json();

    if (!booking_id || !amount) {
      throw new Error('booking_id and amount are required');
    }

    console.log('Creating bank transfer payment for booking:', booking_id, 'amount:', amount);

    // Verify booking exists and is not cancelled
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      throw new Error(`Booking not found: ${bookingError?.message}`);
    }

    if (booking.status === 'cancelled') {
      throw new Error('Cannot create payment for cancelled booking');
    }

    // Get payment method config for bank_transfer
    const { data: paymentMethod } = await supabaseClient
      .from('payment_methods')
      .select('*')
      .eq('method_type', 'bank_transfer')
      .eq('is_enabled', true)
      .single();

    const feePercentage = paymentMethod?.fee_percentage || 0;
    const feeAmount = (amount * feePercentage) / 100;
    const totalAmount = amount + feeAmount;

    // Create payment record
    const { data: payment, error: paymentError } = await supabaseClient
      .from('payments')
      .insert({
        booking_id,
        type: payment_type || 'rental',
        method: 'wire',
        payment_method_type: 'bank_transfer',
        amount: amount,
        fee_percentage: feePercentage,
        fee_amount: feeAmount,
        total_amount: totalAmount,
        currency: booking.currency || 'EUR',
        payment_intent: payment_intent || 'client_payment',
        payment_link_status: 'pending',
        payment_link_id: `bank_transfer_${Date.now()}`,
        payment_link_url: '',
      })
      .select()
      .single();

    if (paymentError || !payment) {
      throw new Error(`Failed to create payment: ${paymentError?.message}`);
    }

    // Update payment_link_url with actual payment ID
    const paymentLinkUrl = `/payment/bank-transfer?payment_id=${payment.id}`;
    await supabaseClient
      .from('payments')
      .update({ payment_link_url: paymentLinkUrl })
      .eq('id', payment.id);

    console.log('Bank transfer payment created successfully:', payment.id);

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: payment.id,
        payment_link_url: paymentLinkUrl,
        amount: totalAmount,
        currency: booking.currency || 'EUR',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error creating bank transfer payment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
