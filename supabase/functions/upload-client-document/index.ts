import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const documentUploadSchema = z.object({
  token: z.string().min(10).max(100),
  documentType: z.enum([
    // Original types
    'id_card', 'drivers_license', 'proof_of_address', 'insurance', 'other',
    // Front/back variants for ID documents
    'id_card_front', 'id_card_back',
    'drivers_license_front', 'drivers_license_back',
    // Additional drivers
    'driver2_license_front', 'driver2_license_back',
    'driver3_license_front', 'driver3_license_back',
    // Selfie with ID
    'selfie_with_id',
    // Admin upload types
    'rental_contract', 'car_condition_photo', 'car_condition_video',
    'extra_km_invoice', 'fuel_balance_invoice', 'damage_invoice', 'fine_document'
  ]),
  clientName: z.string().max(200).optional(),
  extraCostAmount: z.string().regex(/^\d+\.?\d{0,2}$/).optional(),
  extraCostNotes: z.string().max(1000).optional(),
});

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
    const file = formData.get('file') as File;
    
    if (!file) {
      throw new Error('File is required');
    }
    
    // Validate input fields
    const validation = documentUploadSchema.safeParse({
      token: formData.get('token') || formData.get('booking_token'),
      documentType: formData.get('document_type'),
      clientName: formData.get('client_name') || undefined,
      extraCostAmount: formData.get('extra_cost_amount') || undefined,
      extraCostNotes: formData.get('extra_cost_notes') || undefined,
    });
    
    if (!validation.success) {
      console.error('Validation failed:', validation.error.errors);
      throw new Error(`Invalid input: ${validation.error.errors[0].message}`);
    }
    
    const { token, documentType, clientName, extraCostAmount, extraCostNotes } = validation.data;

    // Validate file type
    const allowedMimeTypes = [
      'image/jpeg', 'image/png', 'image/jpg', 'image/heic',
      'application/pdf',
      'video/mp4', 'video/quicktime', 'video/avi', 'video/x-msvideo'
    ];
    
    if (!allowedMimeTypes.includes(file.type)) {
      throw new Error('Invalid file type. Only PDF, images (JPG, PNG), and videos (MP4, MOV) are supported');
    }

    // Validate file size
    const maxSize = file.type.startsWith('video/') ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      const maxSizeMB = file.type.startsWith('video/') ? 50 : 10;
      throw new Error(`File too large. Maximum ${maxSizeMB}MB for ${file.type.startsWith('video/') ? 'videos' : 'images/PDFs'}`);
    }

    console.log('Client document upload for token:', String(token).substring(0, 8) + '...');

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
    const insertData: any = {
      booking_id: tokenData.booking_id,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.type,
      document_type: documentType,
      uploaded_by_type: 'client',
      uploaded_by_client_name: clientName || booking.client_email
    };

    // Add optional extras fields
    if (extraCostAmount) {
      insertData.extra_cost_amount = parseFloat(extraCostAmount);
    }
    if (extraCostNotes) {
      insertData.extra_cost_notes = extraCostNotes;
    }

    const { data: document, error: docError } = await supabaseClient
      .from('booking_documents')
      .insert(insertData)
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
