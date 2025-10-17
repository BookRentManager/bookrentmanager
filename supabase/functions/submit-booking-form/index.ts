import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BookingFormSubmission {
  token: string;
  tc_signature_data: string;
  tc_accepted_ip: string;
  selected_payment_methods: string[];
  manual_payment_instructions?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    const {
      token,
      tc_signature_data,
      tc_accepted_ip,
      selected_payment_methods,
      manual_payment_instructions,
    }: BookingFormSubmission = await req.json();

    if (!token || !tc_signature_data || !selected_payment_methods?.length) {
      throw new Error('Missing required fields');
    }

    console.log('Processing booking form submission for token:', token.substring(0, 8) + '...');

    // Verify token is valid
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('booking_access_tokens')
      .select('booking_id, expires_at')
      .eq('token', token)
      .single();

    if (tokenError || !tokenData) {
      console.error('Invalid token:', tokenError);
      throw new Error('Invalid booking link');
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      throw new Error('This booking link has expired');
    }

    // Get active T&C version
    const { data: activeTC, error: tcError } = await supabaseClient
      .from('terms_and_conditions')
      .select('id, version')
      .eq('is_active', true)
      .single();

    if (tcError || !activeTC) {
      console.error('No active T&C found:', tcError);
      throw new Error('Terms and conditions not available');
    }

    // Update booking with T&C acceptance and payment methods
    const { data: updatedBooking, error: updateError } = await supabaseClient
      .from('bookings')
      .update({
        tc_accepted_at: new Date().toISOString(),
        tc_signature_data,
        tc_accepted_ip,
        tc_version_id: activeTC.id,
        available_payment_methods: JSON.stringify(selected_payment_methods),
        manual_payment_instructions: manual_payment_instructions || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tokenData.booking_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating booking:', updateError);
      throw new Error('Failed to save booking form');
    }

    console.log('Booking form submitted successfully:', updatedBooking.reference_code);

    // Log audit trail
    await supabaseClient
      .from('audit_logs')
      .insert({
        entity: 'booking',
        entity_id: tokenData.booking_id,
        action: 'tc_accepted',
        payload_snapshot: {
          tc_version: activeTC.version,
          ip: tc_accepted_ip,
          payment_methods: selected_payment_methods,
          timestamp: new Date().toISOString(),
        },
      });

    return new Response(
      JSON.stringify({
        success: true,
        booking: updatedBooking,
        message: 'Booking form submitted successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in submit-booking-form:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
