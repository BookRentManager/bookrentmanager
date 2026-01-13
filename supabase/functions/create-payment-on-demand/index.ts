import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * On-Demand Payment Link Creation
 * 
 * Creates PostFinance payment links when client clicks the payment button.
 * This avoids the ~35-40 minute transaction timeout issue by creating links
 * just-in-time rather than pre-generating them.
 * 
 * Accepts:
 * - booking_id: The booking UUID
 * - payment_type: 'balance' or 'security_deposit'
 * - payment_method_type: 'visa_mastercard' or 'amex'
 * 
 * Returns:
 * - success: true/false
 * - redirect_url: The PostFinance checkout URL
 */

interface OnDemandRequest {
  booking_id: string;
  payment_type: 'balance' | 'security_deposit';
  payment_method_type: 'visa_mastercard' | 'amex';
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

    const { booking_id, payment_type, payment_method_type }: OnDemandRequest = await req.json();

    // Validate required fields
    if (!booking_id) {
      throw new Error('booking_id is required');
    }
    if (!payment_type || !['balance', 'security_deposit'].includes(payment_type)) {
      throw new Error('payment_type must be "balance" or "security_deposit"');
    }
    if (!payment_method_type || !['visa_mastercard', 'amex'].includes(payment_method_type)) {
      throw new Error('payment_method_type must be "visa_mastercard" or "amex"');
    }

    console.log(`Creating on-demand ${payment_type} payment link for booking ${booking_id} with method ${payment_method_type}`);

    // Fetch booking details
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      throw new Error(`Booking not found: ${bookingError?.message}`);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    let redirectUrl: string;
    let paymentId: string;

    if (payment_type === 'balance') {
      // Calculate balance amount
      const actualAmountPaid = Number(booking.amount_paid || 0);
      const balanceAmount = Number(booking.amount_total) - actualAmountPaid;

      if (balanceAmount <= 0) {
        throw new Error('Balance is already fully paid');
      }

      console.log(`Creating balance payment link for amount: ${balanceAmount}`);

      // Check for existing active link for this exact method to prevent duplicates
      const { data: existingLink } = await supabaseClient
        .from('payments')
        .select('id, payment_link_url, payment_link_status')
        .eq('booking_id', booking_id)
        .in('payment_intent', ['balance_payment', 'final_payment'])
        .eq('payment_method_type', payment_method_type)
        .eq('payment_link_status', 'active')
        .maybeSingle();

      if (existingLink?.payment_link_url) {
        console.log(`Found existing active ${payment_method_type} balance link, reusing`);
        return new Response(
          JSON.stringify({
            success: true,
            redirect_url: existingLink.payment_link_url,
            payment_id: existingLink.id,
            reused: true,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }

      // Call the existing create-postfinance-payment-link function
      // This preserves all AMEX CHF conversion, fee calculation, etc.
      const response = await fetch(
        `${supabaseUrl}/functions/v1/create-postfinance-payment-link`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            booking_id,
            amount: balanceAmount,
            payment_type: 'balance',
            payment_intent: 'balance_payment',
            payment_method_type,
            send_email: false,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to create balance payment link:', errorData);
        throw new Error(errorData.error || 'Failed to create payment link');
      }

      const data = await response.json();
      redirectUrl = data.redirectUrl;
      paymentId = data.payment_id;
      console.log(`Created ${payment_method_type} balance payment link: ${paymentId}`);

    } else if (payment_type === 'security_deposit') {
      const securityDepositAmount = Number(booking.security_deposit_amount || 0);

      if (securityDepositAmount <= 0) {
        throw new Error('No security deposit required for this booking');
      }

      // Check if already authorized
      if (booking.security_deposit_authorized_at) {
        throw new Error('Security deposit is already authorized');
      }

      console.log(`Creating security deposit authorization link for amount: ${securityDepositAmount}`);

      // Check for existing active link for this exact method to prevent duplicates
      const { data: existingLink } = await supabaseClient
        .from('payments')
        .select('id, payment_link_url, payment_link_status')
        .eq('booking_id', booking_id)
        .eq('payment_intent', 'security_deposit')
        .eq('payment_method_type', payment_method_type)
        .eq('payment_link_status', 'active')
        .maybeSingle();

      if (existingLink?.payment_link_url) {
        console.log(`Found existing active ${payment_method_type} deposit link, reusing`);
        return new Response(
          JSON.stringify({
            success: true,
            redirect_url: existingLink.payment_link_url,
            payment_id: existingLink.id,
            reused: true,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }

      // Call the existing authorize-security-deposit function
      // This preserves all authorization logic (COMPLETE_DEFERRED)
      const response = await fetch(
        `${supabaseUrl}/functions/v1/authorize-security-deposit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            booking_id,
            amount: securityDepositAmount,
            payment_method_type,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to create security deposit authorization link:', errorData);
        throw new Error(errorData.error || 'Failed to create authorization link');
      }

      const data = await response.json();
      redirectUrl = data.redirectUrl;
      paymentId = data.authorization_id || data.payment_id;
      console.log(`Created ${payment_method_type} security deposit authorization link: ${paymentId}`);
    } else {
      throw new Error('Invalid payment_type');
    }

    return new Response(
      JSON.stringify({
        success: true,
        redirect_url: redirectUrl,
        payment_id: paymentId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error creating on-demand payment link:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
