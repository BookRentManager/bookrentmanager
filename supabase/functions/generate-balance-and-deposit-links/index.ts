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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // --- GENERATE BALANCE PAYMENT LINKS ---
    if (balanceAmount > 0) {
      console.log('Generating balance payment links for amount:', balanceAmount);

      // Check which payment method types already have active links
      const { data: existingBalanceLinks } = await supabaseClient
        .from('payments')
        .select('id, payment_method_type')
        .eq('booking_id', booking_id)
        .in('payment_intent', ['balance_payment', 'final_payment'])
        .in('payment_link_status', ['pending', 'active']);

      const existingBalanceMethods = new Set(
        (existingBalanceLinks || []).map(l => l.payment_method_type)
      );
      console.log('Existing balance payment methods:', Array.from(existingBalanceMethods));

      {
        // Generate Visa/Mastercard balance link (only if doesn't exist)
        const visaMCMethod = paymentMethods?.find(pm => pm.method_type === 'visa_mastercard');
        if (visaMCMethod && !existingBalanceMethods.has('visa_mastercard')) {
          try {
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
                  payment_method_type: 'visa_mastercard',
                  send_email: false,
                }),
              }
            );

            if (response.ok) {
              const data = await response.json();
              createdLinks.push(data.payment_id);
              console.log('Created Visa/MC balance payment link:', data.payment_id);
            } else {
              const errorData = await response.json();
              console.error('Failed to create Visa/MC balance payment link:', errorData);
            }
          } catch (error) {
            console.error('Error creating Visa/MC balance payment link:', error);
          }
        } else if (existingBalanceMethods.has('visa_mastercard')) {
          console.log('Visa/MC balance link already exists, skipping');
        }

        // Generate Amex balance link (only if doesn't exist)
        const amexMethod = paymentMethods?.find(pm => pm.method_type === 'amex');
        if (amexMethod && !existingBalanceMethods.has('amex')) {
          try {
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
                  payment_method_type: 'amex',
                  send_email: false,
                }),
              }
            );

            if (response.ok) {
              const data = await response.json();
              createdLinks.push(data.payment_id);
              console.log('Created Amex balance payment link:', data.payment_id);
            } else {
              const errorData = await response.json();
              console.error('Failed to create Amex balance payment link:', errorData);
            }
          } catch (error) {
            console.error('Error creating Amex balance payment link:', error);
          }
        } else if (existingBalanceMethods.has('amex')) {
          console.log('Amex balance link already exists, skipping');
        }

        // Generate Bank Transfer balance link (only if doesn't exist)
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
          console.log('Bank transfer balance link already exists, skipping');
        }
      }
    }

    // --- GENERATE SECURITY DEPOSIT AUTHORIZATION LINKS ---
    if (securityDepositAmount > 0) {
      console.log('Generating security deposit authorization links for amount:', securityDepositAmount);

      // Check which payment method types already have active deposit links
      const { data: existingDepositLinks } = await supabaseClient
        .from('payments')
        .select('id, payment_method_type')
        .eq('booking_id', booking_id)
        .eq('payment_intent', 'security_deposit')
        .in('payment_link_status', ['pending', 'active']);

      const existingDepositMethods = new Set(
        (existingDepositLinks || []).map(l => l.payment_method_type)
      );
      console.log('Existing security deposit payment methods:', Array.from(existingDepositMethods));

      {
        // Generate Visa/MC deposit authorization link (only if doesn't exist)
        const visaMCMethod = paymentMethods?.find(pm => pm.method_type === 'visa_mastercard');
        if (visaMCMethod && !existingDepositMethods.has('visa_mastercard')) {
          try {
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
                  payment_method_type: 'visa_mastercard',
                }),
              }
            );

            if (response.ok) {
              const data = await response.json();
              createdLinks.push(data.authorization_id);
              console.log('Created Visa/MC security deposit link:', data.authorization_id);
            } else {
              const errorData = await response.json();
              console.error('Failed to create Visa/MC security deposit link:', errorData);
            }
          } catch (error) {
            console.error('Error creating Visa/MC security deposit link:', error);
          }
        } else if (existingDepositMethods.has('visa_mastercard')) {
          console.log('Visa/MC security deposit link already exists, skipping');
        }

        // Generate Amex deposit authorization link (only if doesn't exist)
        const amexMethod = paymentMethods?.find(pm => pm.method_type === 'amex');
        if (amexMethod && !existingDepositMethods.has('amex')) {
          try {
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
                  payment_method_type: 'amex',
                }),
              }
            );

            if (response.ok) {
              const data = await response.json();
              createdLinks.push(data.authorization_id);
              console.log('Created Amex security deposit link:', data.authorization_id);
            } else {
              const errorData = await response.json();
              console.error('Failed to create Amex security deposit link:', errorData);
            }
          } catch (error) {
            console.error('Error creating Amex security deposit link:', error);
          }
        } else if (existingDepositMethods.has('amex')) {
          console.log('Amex security deposit link already exists, skipping');
        }
      }
    }

    console.log('Balance and deposit link generation completed. Created links:', createdLinks.length);

    return new Response(
      JSON.stringify({
        success: true,
        created_links: createdLinks,
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
