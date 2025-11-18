import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { getBalancePaymentReminderEmail, getSecurityDepositReminderEmail, getEmailSubject } from "../_shared/email-templates.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { template_type } = await req.json();

    if (!template_type || !['balance_reminder', 'security_deposit_reminder', 'booking_form'].includes(template_type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid template_type. Must be balance_reminder, security_deposit_reminder, or booking_form' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sample booking data for generating the template
    const sampleBooking = {
      reference_code: "KR009999",
      client_name: "John Doe",
      client_email: "john.doe@example.com",
      car_model: "Tesla Model 3",
      delivery_datetime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      collection_datetime: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
      pickup_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      return_date: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
      pickup_location: "Geneva Airport",
      return_location: "Geneva Airport",
      amount_total: 1200,
      currency: "EUR",
      security_deposit_amount: 500,
    };

    const samplePortalUrl = "https://example.com/booking-form/sample-token";
    const sampleAppSettings = {
      company_name: "KingRent",
      logo_url: "/king-rent-logo.png",
    };

    let htmlContent: string;
    let subjectLine: string;

    if (template_type === 'balance_reminder') {
      const remainingAmount = 450;
      const daysUntilDelivery = 5;
      
      htmlContent = getBalancePaymentReminderEmail(
        sampleBooking,
        remainingAmount,
        samplePortalUrl,
        daysUntilDelivery,
        sampleAppSettings
      );
      
      subjectLine = getEmailSubject('balance_reminder', sampleBooking.reference_code);
      
    } else if (template_type === 'security_deposit_reminder') {
      const depositAmount = 500;
      const daysUntilDelivery = 3;
      
      htmlContent = getSecurityDepositReminderEmail(
        sampleBooking,
        depositAmount,
        samplePortalUrl,
        daysUntilDelivery,
        sampleAppSettings
      );
      
      subjectLine = getEmailSubject('security_deposit_reminder', sampleBooking.reference_code);
      
    } else {
      // booking_form template
      const { getBookingConfirmationEmail } = await import('../_shared/email-templates.ts');
      const formUrl = `${samplePortalUrl}`;
      htmlContent = getBookingConfirmationEmail(sampleBooking, formUrl, sampleAppSettings);
      subjectLine = 'Complete Your Booking - {{reference_code}}';
    }

    // Convert the actual values back to placeholders for editing
    const placeholderMap: Record<string, string> = {
      [sampleBooking.reference_code]: '{{reference_code}}',
      [sampleBooking.client_name]: '{{client_name}}',
      [sampleBooking.car_model]: '{{car_model}}',
      [samplePortalUrl]: '{{portalUrl}}',
      [sampleAppSettings.company_name]: '{{company_name}}',
      [sampleAppSettings.logo_url]: '{{logoUrl}}',
      '450.00': '{{balance_amount}}',
      '500.00': '{{deposit_amount}}',
      'EUR': '{{currency}}',
      '5': '{{days_until_delivery}}',
      '3': '{{days_until_delivery}}',
    };

    // Replace actual values with placeholders
    let templateHtml = htmlContent;
    let templateSubject = subjectLine;
    
    for (const [actual, placeholder] of Object.entries(placeholderMap)) {
      const regex = new RegExp(actual.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      templateHtml = templateHtml.replace(regex, placeholder);
      templateSubject = templateSubject.replace(regex, placeholder);
    }

    return new Response(
      JSON.stringify({
        html_content: templateHtml,
        subject_line: templateSubject,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating default template:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
