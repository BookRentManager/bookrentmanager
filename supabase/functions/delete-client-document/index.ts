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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { token, document_id, booking_id, admin_delete } = await req.json();

    if (!document_id) {
      throw new Error('document_id is required');
    }

    console.log('Document deletion request:', { document_id, admin_delete: !!admin_delete });

    let targetBookingId: string;

    // Check if this is an admin deletion (authenticated user from webapp)
    if (admin_delete && booking_id) {
      // Verify the user is authenticated by checking the Authorization header
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        throw new Error('Authorization required for admin deletion');
      }

      // Verify the JWT token
      const jwt = authHeader.replace('Bearer ', '');
      const { data: userData, error: userError } = await supabaseClient.auth.getUser(jwt);
      
      if (userError || !userData.user) {
        throw new Error('Invalid or expired authentication');
      }

      // Check if user has staff or admin role
      const { data: roleData } = await supabaseClient
        .from('user_roles')
        .select('role')
        .eq('user_id', userData.user.id)
        .in('role', ['admin', 'staff'])
        .maybeSingle();

      if (!roleData) {
        throw new Error('Insufficient permissions');
      }

      targetBookingId = booking_id;
      console.log('Admin deletion by user:', userData.user.id);
    } else if (token) {
      // Token-based deletion (client/driver portal)
      const { data: tokenData, error: tokenError } = await supabaseClient
        .from('booking_access_tokens')
        .select('booking_id, expires_at')
        .eq('token', token)
        .single();

      if (tokenError || !tokenData) {
        throw new Error('Invalid or expired booking link');
      }

      if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
        throw new Error('This booking link has expired');
      }

      targetBookingId = tokenData.booking_id;
      console.log('Client deletion for token:', token.substring(0, 8) + '...');
    } else {
      throw new Error('Either token or admin_delete with booking_id is required');
    }

    // Get document details
    const { data: document, error: docError } = await supabaseClient
      .from('booking_documents')
      .select('*')
      .eq('id', document_id)
      .eq('booking_id', targetBookingId)
      .is('deleted_at', null)
      .single();

    if (docError || !document) {
      throw new Error('Document not found or not authorized to delete');
    }

    // Soft delete the document
    const { error: updateError } = await supabaseClient
      .from('booking_documents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', document_id);

    if (updateError) {
      console.error('Error deleting document:', updateError);
      throw new Error('Failed to delete document');
    }

    // Delete from storage
    const { error: storageError } = await supabaseClient.storage
      .from('client-documents')
      .remove([document.file_path]);

    if (storageError) {
      console.error('Storage deletion error:', storageError);
      // Continue anyway - soft delete was successful
    }

    console.log('Document deleted successfully:', document_id);

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in delete-client-document:', error);
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
