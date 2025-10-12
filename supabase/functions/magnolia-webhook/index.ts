import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

interface MagnoliaBookingPayload {
  booking_id: string;
  client_name: string;
  email?: string;
  phone?: string;
  car_brand?: string;
  car_model: string;
  car_plate?: string;
  pickup_location: string;
  delivery_location: string;
  pickup_date: string;
  return_date: string;
  flight_number?: string;
  special_requests?: string;
  price_total: string;
  currency?: string;
  supplier_price?: string;
  vat_rate?: string;
  security_deposit?: string;
  km_included?: string;
  extra_km_cost?: string;
  created_at?: string;
  form_source?: string;
  webhook_id?: string;
  timestamp?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Webhook received from Magnolia');

    // Get authorization header to check if request is from authenticated user
    const authHeader = req.headers.get('authorization');
    const isAuthenticatedUser = authHeader && authHeader.startsWith('Bearer ');

    // Verify webhook secret (skip for authenticated internal users)
    const webhookSecret = req.headers.get('x-webhook-secret');
    const expectedSecret = Deno.env.get('MAGNOLIA_WEBHOOK_SECRET');

    if (!isAuthenticatedUser) {
      // For external calls (Magnolia), require webhook secret
      if (!webhookSecret || webhookSecret !== expectedSecret) {
        console.error('Invalid webhook secret');
        return new Response(
          JSON.stringify({ error: 'Unauthorized - Invalid webhook secret' }),
          {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    } else {
      console.log('Request from authenticated user - skipping webhook secret check');
    }

    // Parse the payload
    let payload: MagnoliaBookingPayload;
    try {
      const body = await req.json();
      // Support both direct payload and wrapped payload with webhook metadata
      payload = body.data || body;
      console.log('Parsed payload:', JSON.stringify(payload, null, 2));
    } catch (error) {
      console.error('Failed to parse JSON payload:', error);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate required fields
    const requiredFields = ['booking_id', 'client_name', 'car_model', 'pickup_location', 'delivery_location', 'pickup_date', 'return_date', 'price_total'];
    const missingFields = requiredFields.filter(field => !payload[field as keyof MagnoliaBookingPayload]);
    
    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields);
      return new Response(
        JSON.stringify({ error: 'Missing required fields', missing: missingFields }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Supabase client with service role key for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if booking with this reference code already exists
    const { data: existingBooking } = await supabase
      .from('bookings')
      .select('id, reference_code, status')
      .eq('reference_code', payload.booking_id)
      .maybeSingle();

    // Map Magnolia payload to bookings table structure
    const vatRate = payload.vat_rate ? parseFloat(payload.vat_rate) : 0;
    const rentalPriceGross = parseFloat(payload.price_total);
    const supplierPrice = payload.supplier_price ? parseFloat(payload.supplier_price) : 0;
    const securityDeposit = payload.security_deposit ? parseFloat(payload.security_deposit) : 0;
    const kmIncluded = payload.km_included ? parseInt(payload.km_included) : null;
    const extraKmCost = payload.extra_km_cost ? parseFloat(payload.extra_km_cost) : null;

    const bookingData = {
      reference_code: payload.booking_id,
      client_name: payload.client_name,
      client_email: payload.email || null,
      client_phone: payload.phone || null,
      billing_address: null,
      car_model: payload.car_brand ? `${payload.car_brand} ${payload.car_model}` : payload.car_model,
      car_plate: payload.car_plate || '',
      delivery_location: payload.delivery_location,
      delivery_info: payload.flight_number ? `Flight: ${payload.flight_number}${payload.special_requests ? '\n' + payload.special_requests : ''}` : payload.special_requests || null,
      delivery_datetime: payload.pickup_date,
      collection_location: payload.pickup_location,
      collection_info: null,
      collection_datetime: payload.return_date,
      km_included: kmIncluded,
      extra_km_cost: extraKmCost,
      security_deposit_amount: securityDeposit,
      rental_price_gross: rentalPriceGross,
      supplier_price: supplierPrice,
      other_costs_total: 0,
      vat_rate: vatRate,
      amount_total: rentalPriceGross,
      currency: payload.currency || 'EUR',
    };

    if (existingBooking) {
      // Update existing booking instead of creating duplicate
      console.log('Updating existing booking:', existingBooking.reference_code);

      const { data: updatedBooking, error: updateError } = await supabase
        .from('bookings')
        .update(bookingData)
        .eq('id', existingBooking.id)
        .select()
        .single();

      if (updateError) {
        console.error('Failed to update booking:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update booking', details: updateError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      console.log('Booking updated successfully:', updatedBooking.id);

      return new Response(
        JSON.stringify({ 
          message: 'Booking updated successfully',
          booking_id: updatedBooking.id,
          reference_code: updatedBooking.reference_code,
          action: 'updated'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // If booking doesn't exist, create new one
    const newBookingData = {
      ...bookingData,
      status: 'to_be_confirmed',
      amount_paid: 0,
    };

    console.log('Creating new booking:', JSON.stringify(newBookingData, null, 2));

    // Insert the new booking
    const { data: newBooking, error: insertError } = await supabase
      .from('bookings')
      .insert(newBookingData)
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create booking:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create booking', details: insertError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Booking created successfully:', newBooking.id);

    return new Response(
      JSON.stringify({ 
        message: 'Booking created successfully',
        booking_id: newBooking.id,
        reference_code: newBooking.reference_code,
        action: 'created'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Webhook processing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
