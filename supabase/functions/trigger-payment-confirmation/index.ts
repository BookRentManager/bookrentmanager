import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  payment_id: string;
  booking_update_type?: 'initial_confirmation' | 'additional_payment' | 'test';
}

// Helper to format additional services for display (for admin email)
function formatAdditionalServices(additionalServices: any): string {
  if (!additionalServices || typeof additionalServices !== 'object') {
    return '';
  }

  const services: string[] = [];
  
  if (additionalServices.infant_seat && additionalServices.infant_seat > 0) {
    services.push(`<div class="detail-row"><span class="label">Infant Seat:</span><span class="value">${additionalServices.infant_seat}</span></div>`);
  }
  if (additionalServices.booster_seat && additionalServices.booster_seat > 0) {
    services.push(`<div class="detail-row"><span class="label">Booster Seat:</span><span class="value">${additionalServices.booster_seat}</span></div>`);
  }
  if (additionalServices.child_seat && additionalServices.child_seat > 0) {
    services.push(`<div class="detail-row"><span class="label">Child Seat:</span><span class="value">${additionalServices.child_seat}</span></div>`);
  }
  if (additionalServices.additional_driver_1) {
    services.push(`<div class="detail-row"><span class="label">Additional Driver 1:</span><span class="value">${additionalServices.additional_driver_1}</span></div>`);
  }
  if (additionalServices.additional_driver_2) {
    services.push(`<div class="detail-row"><span class="label">Additional Driver 2:</span><span class="value">${additionalServices.additional_driver_2}</span></div>`);
  }
  if (additionalServices.excess_reduction) {
    services.push(`<div class="detail-row"><span class="label">Excess Reduction:</span><span class="value">Yes</span></div>`);
  }

  return services.join('');
}

// Build admin "DEAL!!!" email HTML (for initial confirmation only)
function buildAdminEmailHtml(booking: any, appSettings: any): string {
  const logoUrl = 'https://bookrentmanager.lovable.app/king-rent-logo.png';
  const bookingUrl = `https://bookrentmanager.com/bookings/${booking.id}`;
  
  // Format dates
  const deliveryDate = new Date(booking.delivery_datetime).toLocaleString('en-US', { 
    dateStyle: 'full', 
    timeStyle: 'short' 
  });
  const collectionDate = new Date(booking.collection_datetime).toLocaleString('en-US', { 
    dateStyle: 'full', 
    timeStyle: 'short' 
  });

  // Guest section (only if guest info exists)
  const hasGuest = booking.guest_name || booking.guest_phone || booking.guest_country;
  const guestSection = hasGuest ? `
    <div class="booking-details">
      <h3 style="margin-top: 0; color: #000; font-family: 'Playfair Display', serif;">👤 GUEST INFORMATION</h3>
      ${booking.guest_name ? `<div class="detail-row"><span class="label">Name:</span><span class="value">${booking.guest_name}</span></div>` : ''}
      ${booking.guest_phone ? `<div class="detail-row"><span class="label">Phone:</span><span class="value">${booking.guest_phone}</span></div>` : ''}
      ${booking.guest_country ? `<div class="detail-row"><span class="label">Country:</span><span class="value">${booking.guest_country}</span></div>` : ''}
      ${booking.guest_company_name ? `<div class="detail-row"><span class="label">Company:</span><span class="value">${booking.guest_company_name}</span></div>` : ''}
      ${booking.guest_billing_address ? `<div class="detail-row" style="border-bottom: none;"><span class="label">Billing Address:</span><span class="value">${booking.guest_billing_address}</span></div>` : ''}
    </div>
  ` : '';

  // Additional services section
  const additionalServicesHtml = formatAdditionalServices(booking.additional_services);
  const additionalServicesSection = additionalServicesHtml ? `
    <div class="booking-details">
      <h3 style="margin-top: 0; color: #000; font-family: 'Playfair Display', serif;">🎁 ADDITIONAL SERVICES</h3>
      ${additionalServicesHtml}
    </div>
  ` : '';

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet">
    <style>
      body { font-family: 'Georgia', serif; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
      .container { max-width: 700px; margin: 0 auto; background-color: #ffffff; }
      .header { background-color: #000000; color: #C5A572; padding: 40px 20px; text-align: center; border-bottom: 3px solid #C5A572; }
      .header h1 { font-family: 'Playfair Display', serif; font-size: 28px; margin: 20px 0 10px; color: #C5A572; }
      .deal-banner { background: linear-gradient(135deg, #C5A572, #8B7355); color: #000; padding: 20px; text-align: center; }
      .deal-banner h2 { margin: 0; font-size: 24px; font-weight: bold; }
      .content { padding: 30px 25px; background: #fff; }
      .gold-divider { height: 2px; background: linear-gradient(to right, transparent, #C5A572, transparent); margin: 25px 0; }
      .booking-details { background: #f9f9f9; border-left: 4px solid #C5A572; padding: 20px; margin: 15px 0; }
      .booking-details h3 { margin-top: 0; color: #000; font-family: 'Playfair Display', serif; font-size: 16px; border-bottom: 1px solid #C5A572; padding-bottom: 10px; }
      .detail-row { padding: 8px 0; border-bottom: 1px solid #e0e0e0; font-size: 14px; }
      .detail-row:last-child { border-bottom: none; }
      .label { font-weight: bold; color: #666; display: inline-block; width: 45%; }
      .value { color: #000; display: inline-block; width: 53%; }
      .notes-box { background: #fffef0; border: 1px solid #C5A572; padding: 10px 15px; margin-top: 10px; font-size: 13px; font-style: italic; }
      .cta-button { display: inline-block; background-color: #C5A572; color: #000; padding: 15px 35px; font-size: 16px; font-weight: bold; text-decoration: none; margin: 20px 0; border: none; }
      .footer { background: #f5f5f5; padding: 25px 20px; text-align: center; border-top: 3px solid #C5A572; }
      .reference-badge { background: #000; color: #C5A572; font-size: 18px; font-weight: bold; padding: 10px 25px; display: inline-block; margin: 10px 0; }
      @media only screen and (min-width: 481px) {
        .header img { max-width: 140px !important; width: 140px !important; }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <img src="${logoUrl}" alt="King Rent Logo" width="140" style="max-width: 140px; height: auto; display: block; margin: 0 auto 10px auto; object-fit: contain; background: transparent;" />
        <h1>🎉 NEW BOOKING CONFIRMED!</h1>
      </div>
      
      <div class="deal-banner">
        <h2>DEAL!!! 🏆</h2>
        <p style="margin: 5px 0 0 0; font-size: 14px;">Payment Received - Booking Confirmed</p>
      </div>
      
      <div class="content">
        <div style="text-align: center; margin-bottom: 20px;">
          <span class="reference-badge">${booking.reference_code}</span>
        </div>

        <!-- CLIENT INFORMATION -->
        <div class="booking-details">
          <h3>👤 CLIENT INFORMATION</h3>
          <div class="detail-row"><span class="label">Name:</span><span class="value">${booking.client_name}</span></div>
          ${booking.client_email ? `<div class="detail-row"><span class="label">Email:</span><span class="value">${booking.client_email}</span></div>` : ''}
          ${booking.client_phone ? `<div class="detail-row"><span class="label">Phone:</span><span class="value">${booking.client_phone}</span></div>` : ''}
          ${booking.country ? `<div class="detail-row"><span class="label">Country:</span><span class="value">${booking.country}</span></div>` : ''}
          ${booking.billing_address ? `<div class="detail-row"><span class="label">Billing Address:</span><span class="value">${booking.billing_address}</span></div>` : ''}
          ${booking.company_name ? `<div class="detail-row"><span class="label">Company:</span><span class="value">${booking.company_name}</span></div>` : ''}
        </div>

        <!-- GUEST INFORMATION (if applicable) -->
        ${guestSection}

        <!-- VEHICLE DETAILS -->
        <div class="booking-details">
          <h3>🚗 VEHICLE DETAILS</h3>
          <div class="detail-row"><span class="label">Car Model:</span><span class="value">${booking.car_model}</span></div>
          <div class="detail-row"><span class="label">Car Plate:</span><span class="value">${booking.car_plate || 'TBD'}</span></div>
          <div class="detail-row"><span class="label">Total Km Included:</span><span class="value">${booking.km_included ? `${booking.km_included} km` : 'Unlimited'}</span></div>
          <div class="detail-row"><span class="label">Extra Km Cost:</span><span class="value">${booking.extra_km_cost ? `${booking.currency} ${booking.extra_km_cost.toFixed(2)}/km` : 'N/A'}</span></div>
          <div class="detail-row"><span class="label">Security Deposit:</span><span class="value">${booking.currency} ${(booking.security_deposit_amount || 0).toFixed(2)}</span></div>
        </div>

        <!-- ADDITIONAL SERVICES (if any) -->
        ${additionalServicesSection}

        <!-- RENTAL PERIOD -->
        <div class="booking-details">
          <h3>📅 RENTAL PERIOD</h3>
          <div class="detail-row"><span class="label">Delivery Date:</span><span class="value">${deliveryDate}</span></div>
          <div class="detail-row"><span class="label">Delivery Location:</span><span class="value">${booking.delivery_location}</span></div>
          ${booking.delivery_info ? `<div class="notes-box"><strong>Delivery Notes:</strong> ${booking.delivery_info}</div>` : ''}
          
          <div style="margin-top: 15px;"></div>
          
          <div class="detail-row"><span class="label">Collection Date:</span><span class="value">${collectionDate}</span></div>
          <div class="detail-row"><span class="label">Collection Location:</span><span class="value">${booking.collection_location}</span></div>
          ${booking.collection_info ? `<div class="notes-box"><strong>Collection Notes:</strong> ${booking.collection_info}</div>` : ''}
        </div>

        <!-- PAYMENT SUMMARY -->
        <div class="booking-details">
          <h3>💰 PAYMENT SUMMARY</h3>
          <div class="detail-row"><span class="label">Total Amount:</span><span class="value" style="font-weight: bold;">${booking.currency} ${booking.amount_total.toFixed(2)}</span></div>
          <div class="detail-row"><span class="label">Amount Paid:</span><span class="value" style="color: #16a34a; font-weight: bold;">${booking.currency} ${booking.amount_paid.toFixed(2)}</span></div>
          <div class="detail-row"><span class="label">Balance Due:</span><span class="value" style="color: ${(booking.amount_total - booking.amount_paid) > 0 ? '#dc2626' : '#16a34a'}; font-weight: bold;">${booking.currency} ${(booking.amount_total - booking.amount_paid).toFixed(2)}</span></div>
        </div>

        <!-- SUPPLIER INFORMATION -->
        <div class="booking-details">
          <h3>🏢 SUPPLIER INFORMATION</h3>
          <div class="detail-row"><span class="label">Supplier Name:</span><span class="value">${booking.supplier_name || 'Not assigned'}</span></div>
          <div class="detail-row"><span class="label">Supplier Price:</span><span class="value">${booking.currency} ${(booking.supplier_price || 0).toFixed(2)}</span></div>
        </div>

        <div class="gold-divider"></div>

        <div style="text-align: center;">
          <a href="${bookingUrl}" class="cta-button">📋 View Booking in Dashboard</a>
        </div>
      </div>
      
      <div class="footer">
        <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">
          ${appSettings?.company_name || 'King Rent'}<br>
          <span style="font-size: 12px; color: #999;">Your Trusted Luxury Car Rental Agency in Europe & Dubai</span>
        </p>
        <p style="margin: 10px 0 0 0; font-size: 11px; color: #aaa;">
          🔒 Secure Payment | ⭐ Verified Service | 🚗 Premium Fleet
        </p>
      </div>
    </div>
  </body>
  </html>
  `;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { payment_id, booking_update_type = 'additional_payment' }: RequestBody = await req.json();

    if (!payment_id) {
      throw new Error('payment_id is required');
    }

    console.log('Processing payment confirmation for:', payment_id, 'Type:', booking_update_type);

    // Fetch payment details
    const { data: payment, error: paymentError } = await supabaseClient
      .from('payments')
      .select('*')
      .eq('id', payment_id)
      .single();

    if (paymentError || !payment) {
      throw new Error(`Failed to fetch payment: ${paymentError?.message || 'Payment not found'}`);
    }

    // IDEMPOTENCY CHECK: Skip if confirmation email already sent (unless test mode)
    if (payment.confirmation_email_sent_at && booking_update_type !== 'test') {
      console.log('Payment confirmation email already sent at:', payment.confirmation_email_sent_at);
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Payment confirmation email already sent',
          already_sent: true,
          sent_at: payment.confirmation_email_sent_at,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
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

    // Skip imported bookings - they are for consultation only
    if (booking.imported_from_email === true) {
      console.log('Skipping imported booking - no payment confirmation email sent:', booking.reference_code);
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Imported booking - email skipped',
          booking_reference: booking.reference_code
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // IDEMPOTENCY CHECK: For initial confirmations, skip if booking confirmation PDF already sent
    if (booking_update_type === 'initial_confirmation' && booking.booking_confirmation_pdf_sent_at) {
      console.log('Booking confirmation already sent at:', booking.booking_confirmation_pdf_sent_at);
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Booking confirmation already sent',
          already_sent: true,
          sent_at: booking.booking_confirmation_pdf_sent_at,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Fetch app settings for admin email
    const { data: appSettings } = await supabaseClient
      .from('app_settings')
      .select('*')
      .limit(1)
      .single();

    // Fetch email template from database
    const { data: emailTemplate } = await supabaseClient
      .from('email_templates')
      .select('*')
      .eq('template_type', 'payment_confirmation')
      .eq('is_active', true)
      .single();

    // Fetch booking creator email for admin notifications (only for initial confirmation)
    let creatorEmail: string | null = null;
    if (booking_update_type === 'initial_confirmation' && booking.created_by) {
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('email')
        .eq('id', booking.created_by)
        .single();
      
      creatorEmail = profile?.email || null;
      console.log('Booking creator email:', creatorEmail);
    }

    // Generate or get existing access token for client portal
    const { data: existingToken } = await supabaseClient
      .from('booking_access_tokens')
      .select('token')
      .eq('booking_id', booking.id)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let accessToken = existingToken?.token;
    if (!accessToken) {
      const { data: tokenData } = await supabaseClient.rpc('generate_booking_token', {
        p_booking_id: booking.id
      });
      accessToken = tokenData;
    }

    const appDomain = Deno.env.get('APP_DOMAIN') || 'https://bookrentmanager.com';
    const portalUrl = `${appDomain}/client-portal/${accessToken}`;
    
    console.log('Portal URL generated:', portalUrl);

    // Generate PDFs server-side before sending email
    let receiptUrl = payment.receipt_url || '';
    let confirmationUrl = booking.confirmation_pdf_url || '';
    
    console.log('Checking for existing PDFs - Receipt:', !!receiptUrl, 'Confirmation:', !!confirmationUrl);
    
    // Generate payment receipt PDF if not already available
    if (!receiptUrl) {
      console.log('Generating payment receipt PDF...');
      try {
        const receiptResponse = await supabaseClient.functions.invoke('generate-payment-receipt', {
          body: { payment_id: payment.id }
        });
        
        if (receiptResponse.error) {
          console.error('Failed to generate receipt PDF:', receiptResponse.error);
        } else if (receiptResponse.data?.receipt_url) {
          receiptUrl = receiptResponse.data.receipt_url;
          console.log('Receipt PDF generated successfully:', receiptUrl);
        }
      } catch (error) {
        console.error('Error calling generate-payment-receipt:', error);
      }
    }
    
    // Generate booking confirmation PDF if not already available
    if (!confirmationUrl) {
      console.log('Generating booking confirmation PDF...');
      try {
        const confirmationResponse = await supabaseClient.functions.invoke('generate-booking-confirmation', {
          body: { booking_id: booking.id }
        });
        
        if (confirmationResponse.error) {
          console.error('Failed to generate confirmation PDF:', confirmationResponse.error);
        } else if (confirmationResponse.data?.confirmation_url) {
          confirmationUrl = confirmationResponse.data.confirmation_url;
          console.log('Booking confirmation PDF generated successfully:', confirmationUrl);
        }
      } catch (error) {
        console.error('Error calling generate-booking-confirmation:', error);
      }
    }
    
    console.log('Final PDF URLs - Receipt:', !!receiptUrl, 'Confirmation:', !!confirmationUrl);

    // Format email content
    const isInitialConfirmation = booking_update_type === 'initial_confirmation';
    const logoUrl = 'https://bookrentmanager.lovable.app/king-rent-logo.png';

    let emailSubject = isInitialConfirmation
      ? `Booking Confirmed - ${booking.reference_code}`
      : `Payment Received - ${booking.reference_code}`;

    let emailHtml = '';

    if (emailTemplate?.html_content) {
      console.log('Using custom payment confirmation template from database');
      
      // Build conditional content in code
      const emailTitle = isInitialConfirmation ? 'Booking Confirmed!' : 'Payment Received';
      const emailSubtitle = isInitialConfirmation ? 'Your luxury vehicle awaits' : 'Thank you for your payment';
      const greeting = isInitialConfirmation ? '✨ Congratulations,' : 'Thank you,';
      const mainMessage = isInitialConfirmation 
        ? 'Your booking with King Rent has been confirmed! We have received your payment and everything is perfectly set for your premium rental experience. Your dream vehicle is reserved and waiting just for you.'
        : 'We have successfully received your payment. Thank you for completing this transaction with King Rent.';
      const closingMessage = isInitialConfirmation 
        ? '🎉 <strong>You are all set!</strong> Your luxury experience begins soon. We are here to ensure every moment exceeds your expectations. Should you have any questions or special requests, our dedicated team is at your service.'
        : '✅ Your payment has been processed successfully. If you have any questions or need assistance, please do not hesitate to reach out to us.';
      
      const pdfButtons = (receiptUrl && confirmationUrl)
        ? `<div style="text-align: center; margin: 20px 0;">
            <a href="${receiptUrl}" class="cta-button" style="background: #C5A572; color: #000; border-color: #C5A572;">📄 Payment Receipt</a>
            <a href="${confirmationUrl}" class="cta-button" style="background: #C5A572; color: #000; border-color: #C5A572;">📋 Booking Confirmation</a>
          </div>`
        : '';

      emailSubject = emailTemplate.subject_line
        .replace(/\{\{email_title\}\}/g, emailTitle)
        .replace(/\{\{reference_code\}\}/g, booking.reference_code);

      // Replace all placeholders
      emailHtml = emailTemplate.html_content
        .replace(/\{\{logoUrl\}\}/g, logoUrl)
        .replace(/\{\{email_title\}\}/g, emailTitle)
        .replace(/\{\{email_subtitle\}\}/g, emailSubtitle)
        .replace(/\{\{greeting\}\}/g, greeting)
        .replace(/\{\{client_name\}\}/g, booking.client_name)
        .replace(/\{\{main_message\}\}/g, mainMessage)
        .replace(/\{\{reference_code\}\}/g, booking.reference_code)
        .replace(/\{\{car_model\}\}/g, booking.car_model)
        .replace(/\{\{car_plate\}\}/g, booking.car_plate)
        .replace(/\{\{pickup_date\}\}/g, new Date(booking.delivery_datetime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }))
        .replace(/\{\{return_date\}\}/g, new Date(booking.collection_datetime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }))
        .replace(/\{\{payment_currency\}\}/g, payment.currency)
        .replace(/\{\{payment_amount\}\}/g, (payment.total_amount || payment.amount).toFixed(2))
        .replace(/\{\{payment_method\}\}/g, payment.method)
        .replace(/\{\{currency\}\}/g, booking.currency)
        .replace(/\{\{amount_total\}\}/g, booking.amount_total.toFixed(2))
        .replace(/\{\{amount_paid\}\}/g, booking.amount_paid.toFixed(2))
        .replace(/\{\{balance_amount\}\}/g, (booking.amount_total - booking.amount_paid).toFixed(2))
        .replace(/\{\{portal_url\}\}/g, portalUrl)
        .replace(/\{\{pdf_buttons\}\}/g, pdfButtons)
        .replace(/\{\{closing_message\}\}/g, closingMessage)
        .replace(/\{\{company_name\}\}/g, appSettings?.company_name || 'King Rent')
        .replace(/\{\{company_email\}\}/g, appSettings?.company_email || '')
        .replace(/\{\{company_phone\}\}/g, appSettings?.company_phone || '');
    } else {
      console.log('Using default hardcoded payment confirmation template (fallback)');
      // Fallback to hardcoded HTML
      const defaultEmailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Georgia', serif; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
          .header { background-color: #000000; color: #C5A572; padding: 40px 20px; text-align: center; border-bottom: 3px solid #C5A572; }
          .header h1 { font-family: 'Playfair Display', serif; font-size: 32px; margin: 20px 0 10px; color: #C5A572; }
          .celebration { font-size: 18px; color: #C5A572; font-weight: bold; margin-bottom: 20px; text-align: center; }
          .content { padding: 40px 30px; background: #fff; }
          .gold-divider { height: 2px; background: linear-gradient(to right, transparent, #C5A572, transparent); margin: 30px 0; }
          .booking-details { background: #f9f9f9; border-left: 4px solid #C5A572; padding: 25px; margin: 20px 0; }
          .detail-row { padding: 10px 0; border-bottom: 1px solid #e0e0e0; }
          .label { font-weight: bold; color: #666; display: inline-block; width: 40%; }
          .value { color: #000; display: inline-block; width: 58%; }
          .cta-button { display: inline-block; background-color: #000000; color: #C5A572; padding: 15px 35px; border: 2px solid #C5A572; font-size: 16px; font-weight: bold; text-decoration: none; margin: 10px; }
          .footer { background: #f5f5f5; padding: 30px 20px; text-align: center; border-top: 3px solid #C5A572; }
        @media only screen and (min-width: 481px) {
          .header img { max-width: 150px !important; width: 150px !important; }
        }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${logoUrl}" alt="King Rent Logo" width="150" style="max-width: 150px; height: auto; display: block; margin: 0 auto 15px auto; object-fit: contain; background: transparent;" />
            <h1>${isInitialConfirmation ? 'Booking Confirmed' : 'Payment Received'}</h1>
            <p style="margin: 5px 0; opacity: 0.9; font-style: italic; font-size: 12px;">
              ${isInitialConfirmation ? 'Your Luxury Vehicle Awaits' : 'Thank you for your payment'}
            </p>
            <p style="margin: 10px 0 0 0; opacity: 0.9; font-weight: 500;">Booking Reference: ${booking.reference_code}</p>
          </div>
          
          <div class="content">
            <p class="celebration">
              ${isInitialConfirmation ? '✨ Congratulations, ' : '✅ Thank you, '} ${booking.client_name}!
            </p>
            
              <p style="font-size: 16px; line-height: 1.8;">
                ${isInitialConfirmation 
                  ? `Your payment is received, and your reservation is confirmed.<br><br>
                     You can access your Booking Portal at any time to view the current payment status, and manage your payments and security deposit securely.<br><br>
                     Your Luxury Car Rental is reserved for you — we look forward to delivering it to you!`
                  : `Thank you for completing your balance payment. Your rental is now fully paid!<br><br>
                     You can access your Booking Portal at any time to view your booking details and manage your security deposit securely.<br><br>
                     Everything is set for your upcoming luxury experience — we look forward to delivering your vehicle!`
                }
              </p>
            
            <div class="gold-divider"></div>
            
            <div class="booking-details">
              <h3 style="margin-top: 0; color: #000; font-family: 'Playfair Display', serif;">🚗 Booking Information</h3>
              <div class="detail-row">
                <span class="label">Reference:</span>
                <span class="value" style="font-weight: bold;">${booking.reference_code}</span>
              </div>
              <div class="detail-row">
                <span class="label">Vehicle:</span>
                <span class="value">${booking.car_model}</span>
              </div>
              <div class="detail-row">
                <span class="label">Delivery:</span>
                <span class="value">${new Date(booking.delivery_datetime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>
              <div class="detail-row">
                <span class="label">Delivery Location:</span>
                <span class="value">${booking.delivery_location}</span>
              </div>
              <div class="detail-row">
                <span class="label">Collection:</span>
                <span class="value">${new Date(booking.collection_datetime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>
              <div class="detail-row" style="border-bottom: none;">
                <span class="label">Collection Location:</span>
                <span class="value">${booking.collection_location}</span>
              </div>
            </div>

            <div class="booking-details">
              <h3 style="margin-top: 0; color: #000; font-family: 'Playfair Display', serif;">💳 Payment Summary</h3>
            <div class="detail-row">
              <span class="label">Amount Paid (incl. fees):</span>
              <span class="value" style="color: #16a34a; font-weight: bold; font-size: 18px;">
                ${payment.currency} ${(payment.total_amount || payment.amount).toFixed(2)}
                <span style="font-size: 12px; color: #666; font-weight: normal; margin-left: 8px;">via ${payment.method}</span>
              </span>
            </div>
            <div class="detail-row">
              <span class="label">Total Amount:</span>
              <span class="value" style="color: #000; font-weight: bold;">${booking.currency} ${booking.amount_total.toFixed(2)}</span>
            </div>
            <div class="detail-row">
              <span class="label">Paid:</span>
              <span class="value" style="color: #16a34a; font-weight: bold;">${booking.currency} ${booking.amount_paid.toFixed(2)}</span>
            </div>
            <div class="detail-row">
              <span class="label">To be Paid:</span>
              <span class="value" style="color: #dc2626; font-weight: bold;">
                ${booking.currency} ${(booking.amount_total - booking.amount_paid).toFixed(2)}
              </span>
            </div>
              <div class="detail-row" style="border-bottom: none;">
                <span class="label">Security Deposit:</span>
                <span class="value" style="font-weight: bold;">
                  ${booking.currency} ${(booking.security_deposit_amount || 0).toFixed(2)} <em style="font-size: 12px; color: #666;">(to pre-authorize)</em>
                </span>
              </div>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${portalUrl}" class="cta-button">🔐 Access Your Client Portal</a>
            </div>

            ${receiptUrl && confirmationUrl
              ? `<div style="text-align: center; margin: 20px 0;">
                  <a href="${receiptUrl}" class="cta-button" style="background: #C5A572; color: #000; border-color: #C5A572;">📄 Payment Receipt</a>
                  <a href="${confirmationUrl}" class="cta-button" style="background: #C5A572; color: #000; border-color: #C5A572;">📋 Booking Confirmation</a>
                </div>`
              : ''
            }
            
            <div class="gold-divider"></div>
            
            <p style="font-size: 15px; line-height: 1.8;">
              Your Luxury Car Rental Experience is waiting for you. We are here to ensure every moment exceeds your expectations. Should you have any questions or requests, our dedicated team is at your service.<br><br>
              <strong>Do not reply to this email. Kindly use our official contacts.</strong>
            </p>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              With gratitude,<br>
              <strong style="color: #000;">${appSettings?.company_name || 'King Rent'}</strong>
            </p>
          </div>
          
          <div class="footer">
            <p style="margin: 0 0 10px 0; font-style: italic; font-size: 13px; color: #C5A572;">Your Trusted Luxury Car Rental Agency in Europe & Dubai</p>
            <p style="margin: 0; font-size: 14px;">
              ${appSettings?.company_name || 'King Rent'}<br>
              ${appSettings?.company_email || ''} | ${appSettings?.company_phone || ''}
            </p>
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(197, 165, 114, 0.3); font-size: 11px; opacity: 0.8;">
              🔒 Secure Payment | ⭐ Verified Service | 🚗 Premium Fleet
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
      emailHtml = defaultEmailHtml;
    }

    // Build admin email fields (ONLY for initial_confirmation)
    let adminEmailFields = {
      admin_email: appSettings?.company_email || '',
      admin_email_subject: '',
      admin_email_html: ''
    };

    if (booking_update_type === 'initial_confirmation') {
      // Build admin email recipients list
      const adminEmails: string[] = [];
      if (creatorEmail) {
        adminEmails.push(creatorEmail);
      }
      adminEmails.push('info@kingrent.com');
      
      adminEmailFields = {
        admin_email: adminEmails.join(','),
        admin_email_subject: `DEAL!!! BOOKING FORM ${booking.reference_code} - ${booking.client_name}`,
        admin_email_html: buildAdminEmailHtml(booking, appSettings)
      };
      
      console.log('Admin DEAL notification will be sent to:', adminEmailFields.admin_email);
    } else {
      console.log('Balance payment - no admin DEAL notification');
    }

    // Send webhook to Zapier
    const webhookUrl = Deno.env.get('ZAPIER_PAYMENT_CONFIRMATION_WEBHOOK_URL');
    if (!webhookUrl) {
      throw new Error('ZAPIER_PAYMENT_CONFIRMATION_WEBHOOK_URL not configured');
    }

    console.log('Sending webhook to Zapier...');

    const webhookPayload = {
      // Email recipients
      client_email: booking.client_email,
      client_name: booking.client_name,
      
      // Client email content
      email_subject: emailSubject,
      email_html: emailHtml,
      
      // Admin email content (only populated for initial_confirmation)
      admin_email: adminEmailFields.admin_email,
      admin_email_subject: adminEmailFields.admin_email_subject,
      admin_email_html: adminEmailFields.admin_email_html,
      
      // PDF attachments
      payment_receipt_url: receiptUrl,
      booking_confirmation_url: confirmationUrl,
      
      // Portal
      portal_url: portalUrl,
      
      // Booking information (flattened)
      booking_reference: booking.reference_code,
      booking_car_model: booking.car_model,
      booking_car_plate: booking.car_plate,
      booking_delivery_datetime: booking.delivery_datetime,
      booking_collection_datetime: booking.collection_datetime,
      booking_delivery_location: booking.delivery_location,
      booking_collection_location: booking.collection_location,
      booking_amount_total: booking.amount_total,
      booking_amount_paid: booking.amount_paid,
      booking_currency: booking.currency,
      
      // Payment information (flattened)
      payment_amount: payment.amount,
      payment_total_amount: payment.total_amount || payment.amount,
      payment_currency: payment.currency,
      payment_method: payment.method,
      payment_method_type: payment.payment_method_type,
      payment_paid_at: payment.paid_at,
      
      // Metadata
      booking_update_type,
      timestamp: new Date().toISOString(),
    };

    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload),
    });

    if (!webhookResponse.ok) {
      console.error('Zapier webhook failed:', await webhookResponse.text());
      throw new Error('Failed to send webhook to Zapier');
    }

    console.log('Zapier webhook sent successfully');

    // Update database records (skip in test mode)
    if (booking_update_type !== 'test') {
      // Update payment record to mark confirmation email as sent
      const { error: updateError } = await supabaseClient
        .from('payments')
        .update({ 
          confirmation_email_sent_at: new Date().toISOString(),
          receipt_sent_at: new Date().toISOString(),
        })
        .eq('id', payment_id);

      if (updateError) {
        console.error('Failed to update payment confirmation timestamp:', updateError);
      }

      // Update booking record with PDF URL
      const { error: bookingUpdateError } = await supabaseClient
        .from('bookings')
        .update({ 
          booking_confirmation_pdf_sent_at: new Date().toISOString(),
          confirmation_pdf_url: confirmationUrl,
        })
        .eq('id', booking.id);

      if (bookingUpdateError) {
        console.error('Failed to update booking confirmation timestamp:', bookingUpdateError);
      }

      console.log('Payment confirmation process completed successfully');
    } else {
      console.log('Test mode: skipping database timestamp updates');
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: booking_update_type === 'test' 
          ? 'Test webhook sent successfully (no database updates)'
          : 'Payment confirmation sent successfully',
        receipt_url: receiptUrl,
        confirmation_url: confirmationUrl,
        test_mode: booking_update_type === 'test',
        admin_email_sent: booking_update_type === 'initial_confirmation',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in payment confirmation:', error);
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
