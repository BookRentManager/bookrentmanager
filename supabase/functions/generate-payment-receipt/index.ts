import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { renderToBuffer } from "https://esm.sh/@react-pdf/renderer@3.1.14";
import { PaymentReceiptPDF } from "./PaymentReceiptPDF.tsx";
// @deno-types="https://esm.sh/react@18.2.0"
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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { payment_id } = await req.json();

    if (!payment_id) {
      throw new Error('payment_id is required');
    }

    console.log('Generating receipt for payment:', payment_id);

    // Fetch payment details
    const { data: payment, error: paymentError } = await supabaseClient
      .from('payments')
      .select('*')
      .eq('id', payment_id)
      .single();

    if (paymentError || !payment) {
      throw new Error(`Failed to fetch payment: ${paymentError?.message || 'Payment not found'}`);
    }

    // Fetch booking details
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select('*')
      .eq('id', payment.booking_id)
      .single();

    if (bookingError || !booking) {
      throw new Error(`Failed to fetch booking: ${bookingError?.message || 'Booking not found'}`);
    }

    // Fetch app settings
    const { data: appSettings } = await supabaseClient
      .from('app_settings')
      .select('*')
      .limit(1)
      .single();

    console.log('Rendering PDF...');

    // Render PDF using React.createElement
    const pdfElement = React.createElement(PaymentReceiptPDF, {
      payment,
      booking,
      appSettings: appSettings || undefined,
    });

    const pdfBuffer = await renderToBuffer(pdfElement as any);

    // Upload to storage
    const fileName = `receipt_${payment.id}_${Date.now()}.pdf`;
    const filePath = `${payment.booking_id}/${fileName}`;

    console.log('Uploading PDF to storage:', filePath);

    const { error: uploadError } = await supabaseClient.storage
      .from('payment-receipts')
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload PDF: ${uploadError.message}`);
    }

    // Get signed URL (valid for 1 year)
    const { data: signedUrlData } = await supabaseClient.storage
      .from('payment-receipts')
      .createSignedUrl(filePath, 31536000); // 1 year

    if (!signedUrlData?.signedUrl) {
      throw new Error('Failed to generate signed URL');
    }

    // Update payment record with receipt URL
    const { error: updateError } = await supabaseClient
      .from('payments')
      .update({ receipt_url: signedUrlData.signedUrl })
      .eq('id', payment_id);

    if (updateError) {
      console.error('Failed to update payment with receipt URL:', updateError);
    }

    console.log('Receipt generated successfully:', signedUrlData.signedUrl);

    return new Response(
      JSON.stringify({
        success: true,
        receipt_url: signedUrlData.signedUrl,
        file_path: filePath,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error generating receipt:', error);
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
