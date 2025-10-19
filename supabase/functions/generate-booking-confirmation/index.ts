import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { renderToBuffer } from "https://esm.sh/@react-pdf/renderer@3.1.14";
import { SignedBookingPDF } from "./SignedBookingPDF.tsx";
import React from "https://esm.sh/react@18.2.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const { booking_id } = await req.json();

    if (!booking_id) {
      throw new Error('booking_id is required');
    }

    console.log('Generating booking confirmation PDF for booking:', booking_id);

    // Fetch booking details with all related data including signature
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select(`
        *,
        tc_signature_data,
        tc_accepted_at,
        tc_accepted_ip,
        tc_version_id,
        suppliers (name, email),
        booking_services (
          id,
          service_name,
          service_price,
          quantity
        )
      `)
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      throw new Error(`Failed to fetch booking: ${bookingError?.message}`);
    }

    // Fetch app settings for company information
    const { data: appSettings } = await supabaseClient
      .from('app_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    // Generate PDF
    console.log('Rendering PDF...');
    const pdfElement = React.createElement(SignedBookingPDF, {
      booking,
      appSettings,
    });
    const pdfBuffer = await renderToBuffer(pdfElement as any);

    // Upload to Supabase Storage
    const fileName = `booking-${booking.reference_code}-confirmation.pdf`;
    const filePath = `${booking_id}/${fileName}`;

    console.log('Uploading PDF to storage:', filePath);

    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('booking-confirmations')
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(`Failed to upload PDF: ${uploadError.message}`);
    }

    // Generate signed URL (valid for 1 year)
    const { data: signedUrlData } = await supabaseClient.storage
      .from('booking-confirmations')
      .createSignedUrl(filePath, 31536000); // 1 year in seconds

    if (!signedUrlData?.signedUrl) {
      throw new Error('Failed to generate signed URL');
    }

    console.log('PDF generated successfully:', signedUrlData.signedUrl);

    // Update booking with confirmation PDF URL
    await supabaseClient
      .from('bookings')
      .update({ 
        confirmation_pdf_url: signedUrlData.signedUrl,
      })
      .eq('id', booking_id);

    return new Response(
      JSON.stringify({
        success: true,
        confirmation_url: signedUrlData.signedUrl,
        file_path: filePath,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error generating booking confirmation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
