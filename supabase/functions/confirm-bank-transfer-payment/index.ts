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
    // Use service role key directly (no auth required)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { payment_id } = await req.json();

    if (!payment_id) {
      throw new Error('payment_id is required');
    }

    console.log('Admin confirming bank transfer payment:', payment_id);

    // Get payment details
    const { data: payment, error: paymentError } = await supabaseClient
      .from('payments')
      .select('*')
      .eq('id', payment_id)
      .single();

    if (paymentError || !payment) {
      throw new Error(`Payment not found: ${paymentError?.message}`);
    }

    if (payment.payment_link_status === 'paid') {
      throw new Error('Payment already confirmed');
    }

    // Update payment to paid status
    const { error: updateError } = await supabaseClient
      .from('payments')
      .update({
        payment_link_status: 'paid',
        paid_at: new Date().toISOString(),
        postfinance_transaction_id: `BANK_TRANSFER_${new Date().toISOString().split('T')[0]}`,
      })
      .eq('id', payment_id);

    if (updateError) {
      throw new Error(`Failed to update payment: ${updateError.message}`);
    }

    // Check if this is an initial payment
    const isInitialPayment = payment.payment_intent === 'client_payment' || 
                            payment.payment_intent === 'down_payment' ||
                            payment.payment_intent === 'full_payment' ||
                            (payment.payment_intent !== 'balance_payment' && 
                             payment.payment_intent !== 'final_payment' &&
                             payment.payment_intent !== 'security_deposit');

    if (isInitialPayment) {
      console.log('Initial payment detected - triggering balance and deposit link generation');
      
      try {
        const generateResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-balance-and-deposit-links`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({ booking_id: payment.booking_id }),
          }
        );
        
        if (generateResponse.ok) {
          const result = await generateResponse.json();
          console.log('Balance and deposit links generated successfully:', result);
        } else {
          const errorText = await generateResponse.text();
          console.error('Failed to generate balance and deposit links:', errorText);
        }
      } catch (genError) {
        console.error('Error calling generate-balance-and-deposit-links:', genError);
      }
    }

    console.log('Payment confirmed, generating receipt...');

    // Generate payment receipt PDF
    const { data: receiptData, error: receiptError } = await supabaseClient.functions.invoke(
      'generate-payment-receipt',
      {
        body: { payment_id },
      }
    );

    if (receiptError) {
      console.error('Failed to generate receipt:', receiptError);
      // Don't fail the whole operation if receipt generation fails
    } else {
      console.log('Receipt generated:', receiptData?.receipt_url);
    }

    console.log('Bank transfer payment confirmed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Payment confirmed successfully',
        receipt_url: receiptData?.receipt_url,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error confirming bank transfer payment:', error);
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
