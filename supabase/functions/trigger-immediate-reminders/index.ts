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
    const { booking_id } = await req.json();

    if (!booking_id) {
      return new Response(
        JSON.stringify({ error: 'booking_id is required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`⏰ Checking if immediate reminders needed for booking ${booking_id}...`);

    // Get booking details
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .single();

    if (fetchError || !booking) {
      console.error('Error fetching booking:', fetchError);
      throw new Error('Booking not found');
    }

    // Skip agency bookings
    if (booking.booking_type === 'agency') {
      console.log(`Skipping agency booking ${booking.reference_code}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Agency booking - skipped',
          booking_reference: booking.reference_code 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log(`Booking ${booking.reference_code} delivery at ${booking.delivery_datetime}`);

    // Check if delivery is within 48 hours
    const deliveryTime = new Date(booking.delivery_datetime);
    const now = new Date();
    const hoursUntilDelivery = (deliveryTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    console.log(`Hours until delivery: ${hoursUntilDelivery.toFixed(2)}`);

    if (hoursUntilDelivery > 48) {
      console.log('Delivery is more than 48 hours away, skipping immediate reminders');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No immediate reminders needed - delivery > 48h away',
          hours_until_delivery: hoursUntilDelivery 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Check if client email exists
    if (!booking.client_email) {
      console.log('No client email, skipping reminders');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No client email - skipped',
          booking_reference: booking.reference_code 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // NOTE: We removed the 5-minute delay that was causing Edge Function timeouts.
    // The booking confirmation email is already sent by a separate database trigger,
    // so we can send reminders immediately for short-notice bookings.
    console.log('⏰ Triggering immediate reminders for short-notice booking (no delay)...');

    // Call send-payment-reminders function for this specific booking with immediate trigger
    const { data: reminderData, error: reminderError } = await supabase.functions.invoke(
      'send-payment-reminders',
      {
        body: {
          trigger: 'immediate',
          booking_id: booking_id,
        },
      }
    );

    if (reminderError) {
      console.error('Error sending immediate reminders:', reminderError);
      throw reminderError;
    }

    console.log('✅ Immediate reminders triggered successfully:', reminderData);

    // Log to audit trail
    await supabase.from('audit_logs').insert({
      entity: 'booking',
      entity_id: booking_id,
      action: 'immediate_reminders_triggered',
      payload_snapshot: {
        hours_until_delivery: hoursUntilDelivery,
        reminder_triggered_at: new Date().toISOString(),
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Immediate reminders triggered',
        booking_reference: booking.reference_code,
        hours_until_delivery: hoursUntilDelivery,
        reminder_result: reminderData,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in trigger-immediate-reminders:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
