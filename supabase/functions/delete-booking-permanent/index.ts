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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: isAdmin, error: roleError } = await supabase
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });

    if (roleError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { bookingId } = await req.json();

    if (!bookingId) {
      return new Response(
        JSON.stringify({ error: 'Booking ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Permanently deleting booking ${bookingId}...`);

    // Delete in correct order to respect foreign key constraints
    const deletions = {
      chat_unread_messages: 0,
      chat_notifications: 0,
      chat_messages: 0,
      extra_cost_approvals: 0,
      booking_documents: 0,
      security_deposit_authorizations: 0,
      payments: 0,
      expenses: 0,
      client_invoices: 0,
      supplier_invoices: 0,
      fines: 0,
      booking: 0,
    };

    // Get message IDs related to this booking first
    const { data: messages } = await supabase
      .from('chat_messages')
      .select('id')
      .eq('entity_type', 'booking')
      .eq('entity_id', bookingId);

    const messageIds = messages?.map(m => m.id) || [];

    // Delete chat_unread_messages
    if (messageIds.length > 0) {
      const { error: unreadError, count } = await supabase
        .from('chat_unread_messages')
        .delete({ count: 'exact' })
        .in('message_id', messageIds);
      
      if (!unreadError) deletions.chat_unread_messages = count || 0;
    }

    // Delete chat_notifications
    if (messageIds.length > 0) {
      const { error: notifError, count } = await supabase
        .from('chat_notifications')
        .delete({ count: 'exact' })
        .in('message_id', messageIds);
      
      if (!notifError) deletions.chat_notifications = count || 0;
    }

    // Delete chat_messages
    const { error: chatError, count: chatCount } = await supabase
      .from('chat_messages')
      .delete({ count: 'exact' })
      .eq('entity_type', 'booking')
      .eq('entity_id', bookingId);
    
    if (!chatError) deletions.chat_messages = chatCount || 0;

    // Delete extra_cost_approvals
    const { error: approvalError, count: approvalCount } = await supabase
      .from('extra_cost_approvals')
      .delete({ count: 'exact' })
      .eq('booking_id', bookingId);
    
    if (!approvalError) deletions.extra_cost_approvals = approvalCount || 0;

    // Delete booking_documents
    const { error: docsError, count: docsCount } = await supabase
      .from('booking_documents')
      .delete({ count: 'exact' })
      .eq('booking_id', bookingId);
    
    if (!docsError) deletions.booking_documents = docsCount || 0;

    // Delete security_deposit_authorizations
    const { error: depositError, count: depositCount } = await supabase
      .from('security_deposit_authorizations')
      .delete({ count: 'exact' })
      .eq('booking_id', bookingId);
    
    if (!depositError) deletions.security_deposit_authorizations = depositCount || 0;

    // Delete payments
    const { error: paymentsError, count: paymentsCount } = await supabase
      .from('payments')
      .delete({ count: 'exact' })
      .eq('booking_id', bookingId);
    
    if (!paymentsError) deletions.payments = paymentsCount || 0;

    // Delete expenses
    const { error: expensesError, count: expensesCount } = await supabase
      .from('expenses')
      .delete({ count: 'exact' })
      .eq('booking_id', bookingId);
    
    if (!expensesError) deletions.expenses = expensesCount || 0;

    // Delete client_invoices
    const { error: clientInvError, count: clientInvCount } = await supabase
      .from('client_invoices')
      .delete({ count: 'exact' })
      .eq('booking_id', bookingId);
    
    if (!clientInvError) deletions.client_invoices = clientInvCount || 0;

    // Delete supplier_invoices
    const { error: supplierInvError, count: supplierInvCount } = await supabase
      .from('supplier_invoices')
      .delete({ count: 'exact' })
      .eq('booking_id', bookingId);
    
    if (!supplierInvError) deletions.supplier_invoices = supplierInvCount || 0;

    // Delete fines
    const { error: finesError, count: finesCount } = await supabase
      .from('fines')
      .delete({ count: 'exact' })
      .eq('booking_id', bookingId);
    
    if (!finesError) deletions.fines = finesCount || 0;

    // Finally, delete the booking itself
    const { error: bookingError, count: bookingCount } = await supabase
      .from('bookings')
      .delete({ count: 'exact' })
      .eq('id', bookingId);

    if (bookingError) {
      console.error('Error deleting booking:', bookingError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete booking: ' + bookingError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    deletions.booking = bookingCount || 0;

    console.log('Deletion summary:', deletions);

    return new Response(
      JSON.stringify({ 
        success: true, 
        bookingId,
        deletions 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in delete-booking-permanent:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
