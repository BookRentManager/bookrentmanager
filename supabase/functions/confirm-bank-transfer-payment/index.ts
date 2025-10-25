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
