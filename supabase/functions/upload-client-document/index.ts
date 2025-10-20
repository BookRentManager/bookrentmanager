import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    );

    const formData = await req.formData();
    const token = formData.get('token') as string;
    const file = formData.get('file') as File;
    const documentType = formData.get('document_type') as string;
    const clientName = formData.get('client_name') as string;

    if (!token || !file || !documentType) {
      throw new Error('Token, file, and document_type are required');
    }

    console.log('Client document upload for token:', token.substring(0, 8) + '...');

    // Validate token
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('booking_access_tokens')
      .select('booking_id, expires_at')
      .eq('token', token)
      .single();

    if (tokenError || !tokenData) {
      throw new Error('Invalid or expired booking link');
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      throw new Error('This booking link has expired');
    }

    // Get booking details
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select('reference_code, client_email')
      .eq('id', tokenData.booking_id)
      .single();

    if (bookingError || !booking) {
      throw new Error('Booking not found');
    }

    // Upload file to storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `${tokenData.booking_id}/${fileName}`;

    const { error: uploadError } = await supabaseClient.storage
      .from('client-documents')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error('Failed to upload file');
    }

    // Create document record
    const { data: document, error: docError } = await supabaseClient
      .from('booking_documents')
      .insert({
        booking_id: tokenData.booking_id,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type,
        document_type: documentType,
        uploaded_by_type: 'client',
        uploaded_by_client_name: clientName || booking.client_email
      })
      .select()
      .single();

    if (docError) {
      console.error('Error creating document record:', docError);
      // Clean up uploaded file
      await supabaseClient.storage
        .from('client-documents')
        .remove([filePath]);
      throw new Error('Failed to save document record');
    }

    console.log('Client document uploaded successfully:', document.id);

    // TODO: Send notification email to admin
    // This would be implemented in a separate edge function

    return new Response(
      JSON.stringify({ 
        success: true,
        document
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in upload-client-document:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An unexpected error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
