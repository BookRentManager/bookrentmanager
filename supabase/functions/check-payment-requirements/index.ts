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
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { booking_id } = await req.json();

    // Fetch booking details
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select('amount_total, amount_paid, payment_amount_percent, status')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      throw new Error('Booking not found');
    }

    // Calculate required down payment
    const requiredDownPayment = booking.payment_amount_percent
      ? (booking.amount_total * booking.payment_amount_percent) / 100
      : 0;

    const downPaymentMet = booking.amount_paid >= requiredDownPayment;
    const fullyPaid = booking.amount_paid >= booking.amount_total;
    const paymentProgressPercent = (booking.amount_paid / booking.amount_total) * 100;

    const canConfirm = booking.status === 'draft' && downPaymentMet;

    return new Response(
      JSON.stringify({
        can_confirm: canConfirm,
        amount_total: booking.amount_total,
        amount_paid: booking.amount_paid,
        required_down_payment: requiredDownPayment,
        down_payment_met: downPaymentMet,
        fully_paid: fullyPaid,
        payment_progress_percent: Math.round(paymentProgressPercent),
        remaining_amount: booking.amount_total - booking.amount_paid,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error checking payment requirements:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
