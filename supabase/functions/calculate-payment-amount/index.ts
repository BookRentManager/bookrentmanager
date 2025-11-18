import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CalculatePaymentRequest {
  booking_id: string;
  payment_intent: 'client_payment' | 'balance_payment' | 'deposit';
  payment_method_type: string;
  amount_override?: number; // Optional: use this instead of calculating from booking
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const {
      booking_id,
      payment_intent,
      payment_method_type,
      amount_override,
    }: CalculatePaymentRequest = await req.json();

    if (!booking_id || !payment_intent || !payment_method_type) {
      throw new Error('Missing required fields');
    }

    console.log('Calculating payment amount for:', {
      booking_id,
      payment_intent,
      payment_method_type,
    });

    // Fetch booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('amount_total, amount_paid, payment_amount_percent, currency')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      throw new Error('Booking not found');
    }

    // Calculate base amount based on payment intent
    let originalAmount: number;
    
    if (amount_override) {
      originalAmount = amount_override;
    } else {
      switch (payment_intent) {
        case 'client_payment':
          // Down payment (percentage of total)
          if (booking.payment_amount_percent && booking.payment_amount_percent > 0) {
            originalAmount = (booking.amount_total * booking.payment_amount_percent) / 100;
          } else {
            originalAmount = booking.amount_total;
          }
          break;
        
        case 'balance_payment':
          // Remaining balance
          originalAmount = booking.amount_total - booking.amount_paid;
          break;
        
        case 'deposit':
          // Security deposit (should be passed via amount_override)
          throw new Error('Security deposit amount must be provided via amount_override');
        
        default:
          throw new Error('Invalid payment intent');
      }
    }

    // Fetch payment method configuration
    const { data: paymentMethod, error: pmError } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('method_type', payment_method_type)
      .eq('is_enabled', true)
      .single();

    if (pmError || !paymentMethod) {
      throw new Error('Payment method not found or disabled');
    }

    console.log('Payment method config:', paymentMethod);

    // Calculate fee
    const feeAmount = (originalAmount * paymentMethod.fee_percentage) / 100;
    const totalAmount = originalAmount + feeAmount;

    let convertedAmount = null;
    let conversionRate = null;
    let finalCurrency = booking.currency || 'EUR';

    // Handle currency conversion if required (e.g., AMEX in CHF)
    if (paymentMethod.requires_conversion && paymentMethod.currency !== finalCurrency) {
      const fromCurrency = finalCurrency;
      const toCurrency = paymentMethod.currency;

      console.log(`Conversion required: ${fromCurrency} → ${toCurrency}`);

      // Get latest conversion rate
      const { data: rateData, error: rateError } = await supabase
        .rpc('get_latest_conversion_rate', {
          p_from_currency: fromCurrency,
          p_to_currency: toCurrency,
        });

      if (rateError) {
        console.error('Conversion rate error:', rateError);
        throw new Error(`Conversion rate not available for ${fromCurrency} to ${toCurrency}`);
      }

      conversionRate = rateData;
      convertedAmount = totalAmount * conversionRate;
      finalCurrency = toCurrency;

      console.log(`Converted: ${totalAmount} ${fromCurrency} → ${convertedAmount} ${toCurrency} (rate: ${conversionRate})`);
    }

    const response = {
      booking_id,
      payment_intent,
      payment_method_type,
      original_amount: originalAmount,
      fee_percentage: paymentMethod.fee_percentage,
      fee_amount: feeAmount,
      total_amount: totalAmount,
      currency: booking.currency || 'EUR',
      converted_amount: convertedAmount,
      conversion_rate: conversionRate,
      final_currency: finalCurrency,
      payment_method_display_name: paymentMethod.display_name,
    };

    console.log('Calculation result:', response);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in calculate-payment-amount:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});