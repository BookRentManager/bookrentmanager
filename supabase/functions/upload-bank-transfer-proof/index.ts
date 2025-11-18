import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const formData = await req.formData();
    const payment_id = formData.get('payment_id') as string;
    const file = formData.get('file') as File;

    if (!payment_id || !file) {
      throw new Error('payment_id and file are required');
    }

    console.log('Uploading bank transfer proof for payment:', payment_id);

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('File size exceeds 5MB limit');
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      throw new Error('Invalid file type. Only PDF and images are allowed');
    }

    // Get payment details
    const { data: payment, error: paymentError } = await supabaseClient
      .from('payments')
      .select('booking_id')
      .eq('id', payment_id)
      .single();

    if (paymentError || !payment) {
      throw new Error(`Payment not found: ${paymentError?.message}`);
    }

    // Upload file to storage
    const fileExt = file.name.split('.').pop();
    const fileName = `bank_transfer_proof_${payment_id}_${Date.now()}.${fileExt}`;
    const filePath = `${payment.booking_id}/${fileName}`;

    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabaseClient.storage
      .from('payment-receipts')
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload file: ${uploadError.message}`);
    }

    // Get signed URL (valid for 1 year)
    const { data: signedUrlData } = await supabaseClient.storage
      .from('payment-receipts')
      .createSignedUrl(filePath, 31536000);

    if (!signedUrlData?.signedUrl) {
      throw new Error('Failed to generate signed URL');
    }

    // Update payment record with proof URL and set status to pending
    const { error: updateError } = await supabaseClient
      .from('payments')
      .update({ 
        proof_url: signedUrlData.signedUrl,
        payment_link_status: 'pending' // Mark as pending confirmation
      })
      .eq('id', payment_id);

    if (updateError) {
      throw new Error(`Failed to update payment: ${updateError.message}`);
    }

    // Invalidate other payment methods for same intent
    const { data: currentPayment } = await supabaseClient
      .from('payments')
      .select('payment_intent, booking_id')
      .eq('id', payment_id)
      .single();

    if (currentPayment) {
      // Set other payment methods for same intent to 'cancelled'
      await supabaseClient
        .from('payments')
        .update({ payment_link_status: 'cancelled' })
        .eq('booking_id', currentPayment.booking_id)
        .eq('payment_intent', currentPayment.payment_intent)
        .neq('id', payment_id)
        .in('payment_link_status', ['active', 'pending']);
        
      console.log('Invalidated other payment methods for same intent');
    }

    console.log('Bank transfer proof uploaded successfully:', signedUrlData.signedUrl);

    return new Response(
      JSON.stringify({
        success: true,
        proof_url: signedUrlData.signedUrl,
        file_path: filePath,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error uploading bank transfer proof:', error);
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
