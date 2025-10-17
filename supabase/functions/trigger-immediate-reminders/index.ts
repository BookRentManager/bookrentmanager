import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

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

    console.log(`⏰ Scheduling immediate reminders for booking ${booking_id}...`);

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
          message: 'No immediate reminders needed',
          hours_until_delivery: hoursUntilDelivery 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Schedule reminders to be sent in 15 minutes
    const reminderDelay = 15 * 60 * 1000; // 15 minutes in milliseconds
    
    console.log('⏱️  Waiting 15 minutes before sending reminders...');

    // Use setTimeout for the delay
    await new Promise(resolve => setTimeout(resolve, reminderDelay));

    console.log('📧 Sending immediate reminders now...');

    // Call send-payment-reminders function for this specific booking
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

    console.log('✅ Immediate reminders sent successfully');

    // Log to audit trail
    await supabase.from('audit_logs').insert({
      entity: 'booking',
      entity_id: booking_id,
      action: 'immediate_reminders_triggered',
      payload_snapshot: {
        hours_until_delivery: hoursUntilDelivery,
        reminder_sent_at: new Date().toISOString(),
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Immediate reminders sent',
        booking_reference: booking.reference_code,
        hours_until_delivery: hoursUntilDelivery,
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