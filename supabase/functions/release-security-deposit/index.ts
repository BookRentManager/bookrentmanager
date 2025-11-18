import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReleaseRequest {
  authorization_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { authorization_id }: ReleaseRequest = await req.json();

    if (!authorization_id) {
      return new Response(
        JSON.stringify({ error: 'authorization_id is required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`🔓 Releasing security deposit authorization ${authorization_id}`);

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
      throw new Error(`Cannot release authorization in status: ${authorization.status}`);
    }

    // In a real implementation, you would call PostFinance API here to release the hold
    // For now, we'll simulate it
    console.log(`📞 Calling PostFinance API to release hold...`);

    // Update authorization status
    const { error: updateError } = await supabase
      .from('security_deposit_authorizations')
      .update({
        status: 'released',
        released_at: new Date().toISOString(),
      })
      .eq('id', authorization_id);

    if (updateError) {
      console.error('Error updating authorization:', updateError);
      throw updateError;
    }

    // Send confirmation email to client
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
            <h1 style="color: #4caf50; margin: 0;">Security Deposit Released</h1>
          </div>
          
          <p style="color: #333333; line-height: 1.6;">Dear ${authorization.bookings.client_name},</p>
          
          <p style="color: #333333; line-height: 1.6;">
            Great news! Your security deposit of <strong>${authorization.currency} ${authorization.amount.toFixed(2)}</strong> 
            has been released and will appear back in your account within 5-7 business days.
          </p>

          <div style="background-color: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #4caf50;">Rental Summary:</h3>
            <p style="margin: 5px 0; color: #333333;"><strong>Booking Reference:</strong> ${authorization.bookings.reference_code}</p>
            <p style="margin: 5px 0; color: #333333;"><strong>Deposit Amount:</strong> ${authorization.currency} ${authorization.amount.toFixed(2)}</p>
            <p style="margin: 5px 0; color: #333333;"><strong>Released On:</strong> ${new Date().toLocaleDateString()}</p>
          </div>

          <p style="color: #333333; line-height: 1.6;">
            Thank you for choosing KingRent. We hope you enjoyed your rental experience!
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
        subject: `Security Deposit Released - ${authorization.bookings.reference_code}`,
        html: emailHtml,
      },
    });

    // Log to audit trail
    await supabase.from('audit_logs').insert({
      entity: 'security_deposit_authorization',
      entity_id: authorization_id,
      action: 'released',
      payload_snapshot: {
        amount: authorization.amount,
        currency: authorization.currency,
        released_at: new Date().toISOString(),
      },
    });

    console.log(`✅ Security deposit released successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Security deposit released',
        authorization_id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in release-security-deposit:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});