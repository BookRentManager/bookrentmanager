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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { booking_id } = await req.json();

    if (!booking_id) {
      throw new Error('booking_id is required');
    }

    console.log('Generating balance and deposit links for booking:', booking_id);

    // Fetch booking details
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      throw new Error(`Booking not found: ${bookingError?.message}`);
    }

    // Fetch enabled payment methods
    const { data: paymentMethods, error: pmError } = await supabaseClient
      .from('payment_methods')
      .select('*')
      .eq('is_enabled', true);

    if (pmError) {
      throw new Error(`Failed to fetch payment methods: ${pmError.message}`);
    }

    // Calculate amounts
    const actualAmountPaid = Number(booking.amount_paid || 0);
    const balanceAmount = Number(booking.amount_total) - actualAmountPaid;
    const securityDepositAmount = Number(booking.security_deposit_amount || 0);

    const createdLinks: string[] = [];
    const skippedLinks: string[] = [];
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Time window for checking recent links - 24 hours
    // This prevents re-creation of links after refunds while allowing intentional re-creation later
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // --- GENERATE BALANCE PAYMENT LINKS ---
    if (balanceAmount > 0) {
      console.log('Generating balance payment links for amount:', balanceAmount);

      // Check ALL payment links for this booking (including cancelled/paid) within the last 24 hours
      // This prevents re-creating links after a refund
      const { data: existingBalanceLinks } = await supabaseClient
        .from('payments')
        .select('id, payment_method_type, payment_link_status, created_at')
        .eq('booking_id', booking_id)
        .in('payment_intent', ['balance_payment', 'final_payment'])
        .gte('created_at', twentyFourHoursAgo);

      const existingBalanceMethods = new Set(
        (existingBalanceLinks || []).map(l => l.payment_method_type)
      );
      console.log('Existing balance payment methods (last 24h):', Array.from(existingBalanceMethods));
      console.log('Existing balance links details:', existingBalanceLinks?.map(l => ({
        method: l.payment_method_type,
        status: l.payment_link_status,
        created: l.created_at
      })));

      // Generate Bank Transfer balance link only (credit card links are created on-demand)
      // This prevents PostFinance transaction timeout issues since bank transfers don't expire
      const bankTransferMethod = paymentMethods?.find(pm => pm.method_type === 'bank_transfer');
      if (bankTransferMethod && !existingBalanceMethods.has('bank_transfer')) {
        try {
          const response = await fetch(
            `${supabaseUrl}/functions/v1/create-bank-transfer-payment`,
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
              }),
            }
          );

          if (response.ok) {
            const data = await response.json();
            createdLinks.push(data.payment_id);
            console.log('Created bank transfer balance payment link:', data.payment_id);
          } else {
            const errorData = await response.json();
            console.error('Failed to create bank transfer balance payment link:', errorData);
          }
        } catch (error) {
          console.error('Error creating bank transfer balance payment link:', error);
        }
      } else if (existingBalanceMethods.has('bank_transfer')) {
        console.log('Bank transfer balance link already exists in last 24h, skipping');
        skippedLinks.push('bank_transfer_balance');
      }
      
      // Note: Visa/MC and Amex links are now created on-demand when client clicks button
      // This avoids PostFinance transaction timeout (35-40 min) issues
      console.log('Skipping pre-generation of Visa/MC and Amex links (on-demand creation)');
    }

    // --- GENERATE SECURITY DEPOSIT AUTHORIZATION LINKS ---
    if (securityDepositAmount > 0) {
      console.log('Generating security deposit authorization links for amount:', securityDepositAmount);

      // Check ALL deposit links for this booking (including cancelled/paid) within the last 24 hours
      const { data: existingDepositLinks } = await supabaseClient
        .from('payments')
        .select('id, payment_method_type, payment_link_status, created_at')
        .eq('booking_id', booking_id)
        .eq('payment_intent', 'security_deposit')
        .gte('created_at', twentyFourHoursAgo);

      const existingDepositMethods = new Set(
        (existingDepositLinks || []).map(l => l.payment_method_type)
      );
      console.log('Existing security deposit payment methods (last 24h):', Array.from(existingDepositMethods));
      console.log('Existing deposit links details:', existingDepositLinks?.map(l => ({
        method: l.payment_method_type,
        status: l.payment_link_status,
        created: l.created_at
      })));

      // Note: Visa/MC and Amex security deposit links are now created on-demand when client clicks button
      // This avoids PostFinance transaction timeout (35-40 min) issues
      console.log('Skipping pre-generation of security deposit Visa/MC and Amex links (on-demand creation)');
    }

    console.log('Balance and deposit link generation completed.');
    console.log('Created links:', createdLinks.length);
    console.log('Skipped links (recent duplicates):', skippedLinks.length);

    return new Response(
      JSON.stringify({
        success: true,
        created_links: createdLinks,
        skipped_links: skippedLinks,
        balance_amount: balanceAmount,
        security_deposit_amount: securityDepositAmount,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error generating balance and deposit links:', error);
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
