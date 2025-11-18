import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Free exchange rate API (no key required)
const EXCHANGE_RATE_API = 'https://api.exchangerate-api.com/v4/latest/EUR';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { rate, manual, fetch_from_api } = await req.json();

    let finalRate: number;
    let source: string;

    if (fetch_from_api) {
      console.log('Fetching latest exchange rate from API...');
      
      const response = await fetch(EXCHANGE_RATE_API);
      if (!response.ok) {
        throw new Error('Failed to fetch exchange rate from API');
      }

      const data = await response.json();
      
      if (!data.rates || !data.rates.CHF) {
        throw new Error('CHF rate not found in API response');
      }

      finalRate = data.rates.CHF;
      source = 'api';
      console.log('Fetched rate from API:', finalRate);
    } else if (manual && rate) {
      if (typeof rate !== 'number' || rate <= 0) {
        throw new Error('Invalid rate provided');
      }
      finalRate = rate;
      source = 'manual';
      console.log('Manual rate provided:', finalRate);
    } else {
      throw new Error('Either provide a rate or set fetch_from_api to true');
    }

    // Insert new conversion rate
    const { data: newRateRecord, error: insertError } = await supabaseClient
      .from('currency_conversion_rates')
      .insert({
        from_currency: 'EUR',
        to_currency: 'CHF',
        rate: finalRate,
        effective_date: new Date().toISOString().split('T')[0],
        source,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting conversion rate:', insertError);
      throw insertError;
    }

    console.log('Conversion rate updated successfully:', newRateRecord);

    // Log the change in audit logs
    const { error: auditError } = await supabaseClient
      .from('audit_logs')
      .insert({
        entity: 'currency_conversion',
        entity_id: newRateRecord.id,
        action: 'rate_updated',
        user_id: user.id,
        payload_snapshot: {
          from_currency: 'EUR',
          to_currency: 'CHF',
          rate: finalRate,
          source,
          effective_date: newRateRecord.effective_date,
        },
      });

    if (auditError) {
      console.error('Failed to create audit log:', auditError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        rate: finalRate,
        source,
        effective_date: newRateRecord.effective_date,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error updating conversion rate:', error);
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
