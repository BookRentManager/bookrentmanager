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
  client_name?: string;
  client_phone?: string;
  billing_address?: string;
  country?: string;
  company_name?: string;
  payment_choice?: 'down_payment' | 'full_payment';
  delivery_time?: string;
  collection_time?: string;
  delivery_notes?: string;
  collection_notes?: string;
  
  // Guest information
  guest_name?: string;
  guest_phone?: string;
  guest_billing_address?: string;
  guest_country?: string;
  guest_company_name?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const {
      token,
      tc_signature_data,
      tc_accepted_ip,
      selected_payment_methods,
      manual_payment_instructions,
      client_name,
      client_phone,
      billing_address,
      country,
      company_name,
      payment_choice,
      delivery_time,
      collection_time,
      delivery_notes,
      collection_notes,
      guest_name,
      guest_phone,
      guest_billing_address,
      guest_country,
      guest_company_name,
    }: BookingFormSubmission = await req.json();

    if (!token || !tc_signature_data || !selected_payment_methods?.length) {
      console.error('Missing required fields:', { 
        hasToken: !!token, 
        hasSignature: !!tc_signature_data, 
        hasPaymentMethods: !!selected_payment_methods?.length 
      });
      throw new Error('Missing required fields');
    }

    console.log('Processing booking form submission for token:', token.substring(0, 8) + '...', 'IP:', tc_accepted_ip);

    // Verify token is valid
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('booking_access_tokens')
      .select('booking_id, expires_at')
      .eq('token', token)
      .single();

    if (tokenError || !tokenData) {
      console.error('Invalid token:', tokenError?.message);
      throw new Error('Invalid booking link');
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      console.error('Token expired:', tokenData.expires_at, 'Current time:', new Date().toISOString());
      throw new Error('This booking link has expired');
    }

    console.log('Token validated for booking:', tokenData.booking_id);

    // Idempotency check - verify if already submitted
    const { data: existingBooking } = await supabaseClient
      .from('bookings')
      .select('tc_accepted_at, tc_signature_data, reference_code')
      .eq('id', tokenData.booking_id)
      .single();

    if (existingBooking?.tc_accepted_at && existingBooking?.tc_signature_data) {
      console.log('Booking form already submitted (idempotent):', existingBooking.reference_code);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Booking form already submitted',
          booking: existingBooking 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
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

    // Get existing booking data for fallback values and datetime reconstruction
    const { data: existingBookingData } = await supabaseClient
      .from('bookings')
      .select('client_name, client_phone, billing_address, country, company_name, delivery_datetime, collection_datetime, original_client_name')
      .eq('id', tokenData.booking_id)
      .single();

    // Prepare update data
    const updateData: any = {
      tc_accepted_at: new Date().toISOString(),
      tc_signature_data,
      tc_accepted_ip,
      tc_version_id: activeTC.id,
      available_payment_methods: JSON.stringify(selected_payment_methods),
      manual_payment_instructions: manual_payment_instructions || null,
      client_name: client_name || existingBookingData?.client_name,
      client_phone: client_phone || existingBookingData?.client_phone,
      billing_address: billing_address || existingBookingData?.billing_address,
      country: country || existingBookingData?.country,
      company_name: company_name || existingBookingData?.company_name,
      
      // Guest information
      guest_name: guest_name || null,
      guest_phone: guest_phone || null,
      guest_billing_address: guest_billing_address || null,
      guest_country: guest_country || null,
      guest_company_name: guest_company_name || null,
      
      updated_at: new Date().toISOString(),
    };

    // Set original_client_name only on first submission (if it's null)
    if (!existingBookingData?.original_client_name) {
      updateData.original_client_name = existingBookingData?.client_name;
    }

    // Update delivery/collection datetimes if times were changed
    if (delivery_time && existingBookingData?.delivery_datetime) {
      const deliveryDateTime = new Date(existingBookingData.delivery_datetime);
      const [hours, minutes] = delivery_time.split(':');
      deliveryDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      updateData.delivery_datetime = deliveryDateTime.toISOString();
    }

    if (collection_time && existingBookingData?.collection_datetime) {
      const collectionDateTime = new Date(existingBookingData.collection_datetime);
      const [hours, minutes] = collection_time.split(':');
      collectionDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      updateData.collection_datetime = collectionDateTime.toISOString();
    }

    // Update delivery/collection notes if provided
    if (delivery_notes !== undefined) {
      updateData.delivery_info = delivery_notes;
    }

    if (collection_notes !== undefined) {
      updateData.collection_info = collection_notes;
    }

    // Update booking with T&C acceptance and payment methods
    const { data: updatedBooking, error: updateError } = await supabaseClient
      .from('bookings')
      .update(updateData)
      .eq('id', tokenData.booking_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating booking:', updateError);
      throw new Error('Failed to save booking form');
    }

    console.log('Booking form submitted successfully:', updatedBooking.reference_code);

    // Log audit trail
    const { error: auditError } = await supabaseClient
      .from('audit_logs')
      .insert({
        entity: 'booking',
        entity_id: tokenData.booking_id,
        action: 'update',
        payload_snapshot: {
          action_type: 'tc_accepted',
          tc_version: activeTC.version,
          ip: tc_accepted_ip,
          payment_methods: selected_payment_methods,
          timestamp: new Date().toISOString(),
        },
      });

    if (auditError) {
      console.error('Failed to log audit trail:', auditError);
      // Don't fail the request, just log the error
    }

    // Handle bank transfer payment method
    if (selected_payment_methods.includes('bank_transfer')) {
      console.log('Bank transfer payment method selected, creating payment record...');
      
      // Calculate payment amount based on payment_choice
      const booking_amount = updatedBooking.amount_total || 0;
      const down_payment_percent = updatedBooking.payment_amount_percent || 0;
      const payment_amount = payment_choice === 'full_payment' 
        ? booking_amount 
        : (booking_amount * down_payment_percent) / 100;

      console.log('Calculated payment amount:', payment_amount, 'for choice:', payment_choice);

      // Create bank transfer payment record
      const { data: bankTransferData, error: bankTransferError } = await supabaseClient.functions.invoke(
        'create-bank-transfer-payment',
        {
          body: {
            booking_id: tokenData.booking_id,
            amount: payment_amount,
            payment_type: payment_choice === 'full_payment' ? 'full' : 'deposit',
            payment_intent: payment_choice === 'full_payment' ? 'final_payment' : 'down_payment',
          },
        }
      );

      // CRITICAL FIX: Throw error instead of silently continuing
      if (bankTransferError) {
        console.error('Error creating bank transfer payment:', bankTransferError);
        throw new Error(`Failed to create bank transfer payment: ${bankTransferError.message || 'Unknown error'}`);
      }
      
      if (!bankTransferData || !bankTransferData.payment_link_url) {
        console.error('Bank transfer payment created but no payment_link_url returned:', bankTransferData);
        throw new Error('Bank transfer payment link not generated');
      }

      console.log('Bank transfer payment created successfully:', bankTransferData.payment_id);
      
      // Update booking status to confirmed for bank transfers
      const { error: statusError } = await supabaseClient
        .from('bookings')
        .update({ status: 'confirmed' })
        .eq('id', tokenData.booking_id);

      if (statusError) {
        console.error('Error updating booking status:', statusError);
        // Log but don't fail - payment is created
      }

      console.log('Booking status updated to confirmed');

      // Return with redirect to bank transfer instructions page
      return new Response(
        JSON.stringify({
          success: true,
          booking: updatedBooking,
          redirect_url: `${bankTransferData.payment_link_url}&token=${token}`,
          payment_id: bankTransferData.payment_id,
          message: 'Booking form submitted successfully. Please complete bank transfer payment.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        booking: updatedBooking,
        message: 'Booking form submitted successfully. Confirmation email will be sent.',
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
