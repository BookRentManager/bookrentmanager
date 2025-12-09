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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    // Create client with user's JWT to verify their role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } }
    });

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid or expired token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Use service role client to check user role (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify user has admin or staff role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'staff'])
      .maybeSingle();

    if (roleError || !roleData) {
      console.log('Role check failed for user:', user.id, roleError?.message);
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin or staff role required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    console.log('User', user.id, 'with role', roleData.role, 'confirming bank transfer payment');

    const { payment_id } = await req.json();

    if (!payment_id) {
      throw new Error('payment_id is required');
    }

    console.log('Admin confirming bank transfer payment:', payment_id);

    // Get payment details using admin client
    const { data: payment, error: paymentError } = await supabaseAdmin
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
    const { error: updateError } = await supabaseAdmin
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
          `${supabaseUrl}/functions/v1/generate-balance-and-deposit-links`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
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
    const { data: receiptData, error: receiptError } = await supabaseAdmin.functions.invoke(
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

    console.log('Bank transfer payment confirmed successfully by user:', user.id);

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
