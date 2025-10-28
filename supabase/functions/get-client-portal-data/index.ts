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

    const { token } = await req.json();

    if (!token) {
      throw new Error('Token is required');
    }

    console.log('Fetching client portal data for token:', token.substring(0, 8) + '...');

    // Validate token and get booking ID with permission level
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('booking_access_tokens')
      .select('booking_id, expires_at, permission_level')
      .eq('token', token)
      .single();

    if (tokenError || !tokenData) {
      console.error('Token not found:', tokenError);
      throw new Error('Invalid or expired booking link');
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      console.error('Token expired:', tokenData.expires_at);
      throw new Error('This booking link has expired');
    }

    // Track access
    await supabaseClient.rpc('track_token_access', { p_token: token });

    // Get booking details
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select('*')
      .eq('id', tokenData.booking_id)
      .single();

    if (bookingError || !booking) {
      console.error('Booking not found:', bookingError);
      throw new Error('Booking not found');
    }

    // Get booking documents with extra cost approvals
    const { data: documents, error: docsError } = await supabaseClient
      .from('booking_documents')
      .select(`
        *,
        extra_cost_approval:extra_cost_approvals(id, approved_at)
      `)
      .eq('booking_id', tokenData.booking_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (docsError) {
      console.error('Error fetching documents:', docsError);
    }

    // Get payments and payment links
    let { data: payments, error: paymentsError } = await supabaseClient
      .from('payments')
      .select('*')
      .eq('booking_id', tokenData.booking_id)
      .order('created_at', { ascending: false });

    if (paymentsError) {
      console.error('Error fetching payments:', paymentsError);
    }

    // Get security deposit authorizations
    let { data: securityDeposits, error: sdError } = await supabaseClient
      .from('security_deposit_authorizations')
      .select('*')
      .eq('booking_id', tokenData.booking_id)
      .order('created_at', { ascending: false });

    if (sdError) {
      console.error('Error fetching security deposits:', sdError);
    }

    // Auto-generate payment links if booking is confirmed
    if (booking.status === 'confirmed') {
      // CRITICAL FIX: Exclude security deposits from paid amount calculation
      // Security deposits are authorizations, NOT payments
      const paidAmount = payments?.reduce((sum, p) => {
        if (p.paid_at && p.payment_intent !== 'security_deposit') {
          return sum + p.amount;
        }
        return sum;
      }, 0) || 0;

      const balanceDue = booking.amount_total - paidAmount;

      // 1. Auto-generate BALANCE PAYMENT link if needed
      if (balanceDue > 0) {
        // CRITICAL FIX: Support both naming conventions and use correct operator
        const hasActiveBalanceLink = payments?.some(p => 
          (p.payment_intent === 'balance_payment' || p.payment_intent === 'final_payment') && 
          ['pending', 'active'].includes(p.payment_link_status) &&
          p.payment_link_expires_at &&
          new Date(p.payment_link_expires_at) > new Date()
        );

        if (!hasActiveBalanceLink) {
          console.log('Auto-generating balance payment link for:', booking.reference_code);
          
          try {
            await supabaseClient.functions.invoke('create-postfinance-payment-link', {
              body: {
                booking_id: booking.id,
                amount: balanceDue,
                payment_type: 'balance',
                payment_intent: 'balance_payment',
                payment_method_type: 'visa_mastercard',
                expires_in_hours: 8760, // 1 year
                description: `Balance payment for booking ${booking.reference_code}`,
                send_email: false,
              },
            });

            // Refresh payments after creation
            const { data: updatedPayments } = await supabaseClient
              .from('payments')
              .select('*')
              .eq('booking_id', booking.id)
              .order('created_at', { ascending: false });

            payments = updatedPayments;
          } catch (error) {
            console.error('Failed to auto-generate balance payment link:', error);
          }
        }
      }

      // 2. Auto-generate SECURITY DEPOSIT authorization link if needed
      if (booking.security_deposit_amount > 0) {
        // CRITICAL FIX: Use correct includes() method instead of 'in' operator
        const hasActiveDeposit = securityDeposits?.some(sd => 
          ['pending', 'authorized'].includes(sd.status) &&
          (!sd.expires_at || new Date(sd.expires_at) > new Date())
        );

        // Extra safety: Check if payment link already exists for this booking
        // CRITICAL: Check for !p.paid_at to ensure deposits aren't incorrectly marked as paid
        // CRITICAL: Prevent duplicates by checking for ANY active security deposit payment
        const hasSecurityDepositPaymentLink = payments?.some(p =>
          p.payment_intent === 'security_deposit' &&
          !p.paid_at && // NOT paid (authorizations shouldn't be marked as paid)
          ['pending', 'active'].includes(p.payment_link_status) &&
          p.payment_link_expires_at &&
          new Date(p.payment_link_expires_at) > new Date()
        );

        // Additional check: Count total security deposit payment records (active or not)
        const totalSecurityDepositPayments = payments?.filter(p => 
          p.payment_intent === 'security_deposit'
        ).length || 0;

        // Only create if NO active deposit AND NO existing security deposit payment links
        if (!hasActiveDeposit && !hasSecurityDepositPaymentLink && totalSecurityDepositPayments === 0) {
          console.log('Auto-generating security deposit link for:', booking.reference_code);
          
          try {
            // Calculate expiration based on collection date + 30 days buffer
            const collectionDate = new Date(booking.collection_datetime);
            const expirationDate = new Date(collectionDate);
            expirationDate.setDate(expirationDate.getDate() + 30);
            const hoursUntilExpiration = Math.max(
              48, // Minimum 48 hours
              Math.floor((expirationDate.getTime() - Date.now()) / (1000 * 60 * 60))
            );

            await supabaseClient.functions.invoke('authorize-security-deposit', {
              body: {
                booking_id: booking.id,
                amount: booking.security_deposit_amount,
                currency: booking.currency || 'EUR',
                expires_in_hours: hoursUntilExpiration,
              },
            });

            // Refresh security deposits and payments after creation
            const { data: updatedDeposits } = await supabaseClient
              .from('security_deposit_authorizations')
              .select('*')
              .eq('booking_id', booking.id)
              .order('created_at', { ascending: false });

            securityDeposits = updatedDeposits;

            const { data: updatedPayments } = await supabaseClient
              .from('payments')
              .select('*')
              .eq('booking_id', booking.id)
              .order('created_at', { ascending: false });

            payments = updatedPayments;
          } catch (error) {
            console.error('Failed to auto-generate security deposit link:', error);
          }
        }
      }
    }

    // Get active terms and conditions
    const { data: activeTC, error: tcError } = await supabaseClient
      .from('terms_and_conditions')
      .select('id, version, content')
      .eq('is_active', true)
      .single();

    if (tcError) {
      console.error('Error fetching T&C:', tcError);
    }

    // Get payment methods
    const { data: paymentMethods, error: pmError } = await supabaseClient
      .from('payment_methods')
      .select('*')
      .eq('is_enabled', true)
      .order('sort_order');

    if (pmError) {
      console.error('Error fetching payment methods:', pmError);
    }

    // Get app settings
    const { data: appSettings, error: settingsError } = await supabaseClient
      .from('app_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      console.error('Error fetching app settings:', settingsError);
    }

    // Get rental policies
    const { data: rentalPolicies, error: policiesError } = await supabaseClient
      .from('rental_policies')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (policiesError) {
      console.error('Error fetching rental policies:', policiesError);
    }

    // Get delivery process steps
    const { data: deliverySteps, error: stepsError } = await supabaseClient
      .from('delivery_process_steps')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (stepsError) {
      console.error('Error fetching delivery steps:', stepsError);
    }

    console.log('Client portal data fetched successfully for:', booking.reference_code);

    return new Response(
      JSON.stringify({
        booking,
        documents: documents || [],
        payments: payments || [],
        security_deposits: securityDeposits || [],
        terms_and_conditions: activeTC || null,
        payment_methods: paymentMethods || [],
        app_settings: appSettings || null,
        rental_policies: rentalPolicies || [],
        delivery_steps: deliverySteps || [],
        permission_level: tokenData.permission_level || 'client_view_only',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in get-client-portal-data:', error);
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
