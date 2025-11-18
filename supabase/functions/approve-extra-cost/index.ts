import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { token, document_id } = await req.json();

    if (!token || !document_id) {
      throw new Error('Missing required fields: token and document_id');
    }

    console.log('Approving extra cost for document:', document_id);

    // Validate token and get booking_id
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('booking_access_tokens')
      .select('booking_id, expires_at')
      .eq('token', token)
      .single();

    if (tokenError || !tokenData) {
      throw new Error('Invalid or expired token');
    }

    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      throw new Error('Token has expired');
    }

    // Check if already approved
    const { data: existing, error: existingError } = await supabaseClient
      .from('extra_cost_approvals')
      .select('id')
      .eq('booking_document_id', document_id)
      .maybeSingle();

    if (existingError) {
      console.error('Error checking existing approval:', existingError);
      throw new Error('Failed to check approval status');
    }

    if (existing) {
      throw new Error('Extra cost has already been approved');
    }

    // Verify document exists and belongs to the booking
    const { data: document, error: docError } = await supabaseClient
      .from('booking_documents')
      .select('booking_id, extra_cost_amount')
      .eq('id', document_id)
      .single();

    if (docError || !document) {
      throw new Error('Document not found');
    }

    if (document.booking_id !== tokenData.booking_id) {
      throw new Error('Document does not belong to this booking');
    }

    // Get client IP
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

    // Create approval record
    const { error: insertError } = await supabaseClient
      .from('extra_cost_approvals')
      .insert({
        booking_document_id: document_id,
        booking_id: tokenData.booking_id,
        approved_via_token: token,
        approved_via_ip: clientIp,
        is_locked: true,
      });

    if (insertError) {
      console.error('Error creating approval:', insertError);
      throw new Error('Failed to create approval record');
    }

    console.log('Extra cost approved successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Extra cost approved successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error approving extra cost:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});