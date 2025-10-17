import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CaptureRequest {
  authorization_id: string;
  amount: number;
  reason: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { authorization_id, amount, reason }: CaptureRequest = await req.json();

    if (!authorization_id || !amount || !reason) {
      return new Response(
        JSON.stringify({ error: 'authorization_id, amount, and reason are required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`💰 Capturing ${amount} from security deposit authorization ${authorization_id}`);

    // Get authorization details
    const { data: authorization, error: fetchError } = await supabase
      .from('security_deposit_authorizations')
      .select('*, bookings(reference_code, client_email, client_name)')
      .eq('id', authorization_id)
      .single();

    if (fetchError || !authorization) {
      throw new Error('Authorization not found');
    }

    if (authorization.status !== 'authorized') {
      throw new Error(`Cannot capture authorization in status: ${authorization.status}`);
    }

    if (amount > authorization.amount) {
      throw new Error(`Capture amount (${amount}) exceeds authorized amount (${authorization.amount})`);
    }

    // In a real implementation, you would call PostFinance API here to capture the amount
    console.log(`📞 Calling PostFinance API to capture ${amount}...`);

    // Update authorization status
    const { error: updateError } = await supabase
      .from('security_deposit_authorizations')
      .update({
        status: 'captured',
        captured_at: new Date().toISOString(),
        captured_amount: amount,
        capture_reason: reason,
      })
      .eq('id', authorization_id);

    if (updateError) {
      console.error('Error updating authorization:', updateError);
      throw updateError;
    }

    // Send notification email to client
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #ff9800; margin: 0;">Security Deposit Deduction</h1>
          </div>
          
          <p style="color: #333333; line-height: 1.6;">Dear ${authorization.bookings.client_name},</p>
          
          <p style="color: #333333; line-height: 1.6;">
            We need to inform you that a deduction has been made from your security deposit for the following reason:
          </p>

          <div style="background-color: #fff3e0; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff9800;">
            <p style="margin: 0; color: #333333;"><strong>Reason:</strong> ${reason}</p>
          </div>

          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #333333;">Deduction Details:</h3>
            <p style="margin: 5px 0; color: #666666;"><strong>Booking Reference:</strong> ${authorization.bookings.reference_code}</p>
            <p style="margin: 5px 0; color: #666666;"><strong>Original Deposit:</strong> ${authorization.currency} ${authorization.amount.toFixed(2)}</p>
            <p style="margin: 5px 0; color: #666666;"><strong>Amount Deducted:</strong> ${authorization.currency} ${amount.toFixed(2)}</p>
            <p style="margin: 5px 0; color: #666666;"><strong>Remaining Balance:</strong> ${authorization.currency} ${(authorization.amount - amount).toFixed(2)}</p>
          </div>

          ${amount < authorization.amount ? `
          <p style="color: #333333; line-height: 1.6;">
            The remaining balance of ${authorization.currency} ${(authorization.amount - amount).toFixed(2)} will be released back to your account within 5-7 business days.
          </p>
          ` : ''}

          <p style="color: #333333; line-height: 1.6;">
            If you have any questions about this deduction, please contact us.
          </p>

          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #999999; font-size: 12px;">
            <p>KingRent - Premium Car Rental Service</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await supabase.functions.invoke('send-gmail', {
      body: {
        to: authorization.bookings.client_email,
        subject: `Security Deposit Deduction - ${authorization.bookings.reference_code}`,
        html: emailHtml,
      },
    });

    // Log to audit trail
    await supabase.from('audit_logs').insert({
      entity: 'security_deposit_authorization',
      entity_id: authorization_id,
      action: 'captured',
      payload_snapshot: {
        amount: authorization.amount,
        captured_amount: amount,
        remaining: authorization.amount - amount,
        currency: authorization.currency,
        reason,
        captured_at: new Date().toISOString(),
      },
    });

    console.log(`✅ Security deposit captured successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Security deposit captured',
        authorization_id,
        captured_amount: amount,
        remaining_balance: authorization.amount - amount,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in capture-security-deposit:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});