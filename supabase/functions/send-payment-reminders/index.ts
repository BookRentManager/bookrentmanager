import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { 
  getBalancePaymentReminderEmail, 
  getSecurityDepositReminderEmail,
  getEmailSubject 
} from "../_shared/email-templates.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReminderRequest {
  trigger: 'scheduled' | 'immediate';
  booking_id?: string;
}

interface BookingDetails {
  id: string;
  reference_code: string;
  client_name: string;
  client_email: string;
  car_model: string;
  delivery_datetime: string;
  amount_total: number;
  amount_paid: number;
  currency: string;
  security_deposit_amount: number;
  balance_payment_reminder_sent_at: string | null;
  security_deposit_reminder_sent_at: string | null;
  security_deposit_authorized_at: string | null;
  balance_due_date: string | null;
  payment_amount_option: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { trigger, booking_id }: ReminderRequest = await req.json();
    
    const isImmediateTrigger = trigger === 'immediate';
    console.log(`Processing payment reminders (trigger: ${trigger}, immediate: ${isImmediateTrigger})`);

    // Query bookings needing reminders (exclude agency bookings and imported bookings)
    let query = supabaseClient
      .from('bookings')
      .select('*')
      .eq('status', 'confirmed')
      .neq('booking_type', 'agency')
      .neq('imported_from_email', true)
      .gt('delivery_datetime', new Date().toISOString())
      .not('client_email', 'is', null);

    if (booking_id) {
      query = query.eq('id', booking_id);
    }

    const { data: bookings, error: bookingsError } = await query;

    if (bookingsError) {
      throw bookingsError;
    }

    // Get app settings for email branding
    const { data: appSettings } = await supabaseClient
      .from('app_settings')
      .select('*')
      .single();

    const webhookUrl = Deno.env.get('ZAPIER_PAYMENT_REMINDER_WEBHOOK_URL');
    if (!webhookUrl) {
      throw new Error('ZAPIER_PAYMENT_REMINDER_WEBHOOK_URL not configured');
    }

    let remindersSent = 0;
    const results = [];

    for (const booking of bookings as BookingDetails[]) {
      const daysUntilDelivery = Math.ceil(
        (new Date(booking.delivery_datetime).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );

      // Check Balance Payment Reminder
      const balanceAmount = booking.amount_total - booking.amount_paid;
      if (await shouldSendBalanceReminder(booking, balanceAmount, daysUntilDelivery, isImmediateTrigger)) {
        await sendBalanceReminder(
          supabaseClient, 
          booking, 
          balanceAmount, 
          daysUntilDelivery, 
          webhookUrl, 
          appSettings,
          isImmediateTrigger
        );
        remindersSent++;
        results.push({ booking_id: booking.id, type: 'balance_payment', sent: true });
      }

      // Check Security Deposit Reminder
      if (await shouldSendDepositReminder(booking, daysUntilDelivery, isImmediateTrigger)) {
        await sendDepositReminder(
          supabaseClient, 
          booking, 
          daysUntilDelivery, 
          webhookUrl, 
          appSettings,
          isImmediateTrigger
        );
        remindersSent++;
        results.push({ booking_id: booking.id, type: 'security_deposit', sent: true });
      }
    }

    console.log(`Payment reminders completed: ${remindersSent} sent`);

    return new Response(
      JSON.stringify({ success: true, reminders_sent: remindersSent, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-payment-reminders:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function shouldSendBalanceReminder(
  booking: BookingDetails, 
  balanceAmount: number, 
  daysUntilDelivery: number,
  isImmediateTrigger: boolean = false
): Promise<boolean> {
  if (balanceAmount <= 0) return false;

  const lastSent = booking.balance_payment_reminder_sent_at 
    ? new Date(booking.balance_payment_reminder_sent_at) 
    : null;
  const now = new Date();

  // For immediate triggers (short-notice bookings < 48h), bypass day-based checks
  // Send reminder if balance is due and no reminder was sent in the last 2 hours
  if (isImmediateTrigger) {
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    if (!lastSent || lastSent < twoHoursAgo) {
      console.log(`[IMMEDIATE] Balance reminder will be sent for ${booking.reference_code} (balance: ${balanceAmount})`);
      return true;
    }
    console.log(`[IMMEDIATE] Balance reminder skipped - already sent within 2 hours for ${booking.reference_code}`);
    return false;
  }

  // If balance_due_date is set and payment option is down_payment_only,
  // check if we should send reminder based on the due date
  if (booking.balance_due_date && booking.payment_amount_option === 'down_payment_only') {
    const dueDate = new Date(booking.balance_due_date);
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    // Send on the due date (day of or 1 day before)
    if (daysUntilDue <= 1 && daysUntilDue >= 0) {
      // Only send if not sent today
      if (!lastSent || (now.getTime() - lastSent.getTime()) > (1000 * 60 * 60 * 12)) {
        return true;
      }
    }
    
    // Also send 3 days before due date as a first reminder
    if (daysUntilDue <= 3 && daysUntilDue > 1 && !lastSent) {
      return true;
    }
    
    return false;
  }

  // Fallback to delivery-date based logic for other payment options
  // 7 days before - first reminder
  if (daysUntilDelivery <= 7 && !lastSent) {
    return true;
  }

  // 3 days before - second reminder (if last sent > 4 days ago)
  if (daysUntilDelivery <= 3 && lastSent) {
    const daysSinceLastSent = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastSent > 4) {
      return true;
    }
  }

  // 1 day before - final reminder (if last sent > 2 days ago)
  if (daysUntilDelivery <= 1 && lastSent) {
    const daysSinceLastSent = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastSent > 2) {
      return true;
    }
  }

  return false;
}

async function shouldSendDepositReminder(
  booking: BookingDetails, 
  daysUntilDelivery: number,
  isImmediateTrigger: boolean = false
): Promise<boolean> {
  if (booking.security_deposit_amount <= 0) return false;
  if (booking.security_deposit_authorized_at) return false;

  const lastSent = booking.security_deposit_reminder_sent_at 
    ? new Date(booking.security_deposit_reminder_sent_at) 
    : null;
  const now = new Date();

  // For immediate triggers (short-notice bookings < 48h), bypass day-based checks
  // Send reminder if deposit is required and no reminder was sent in the last 2 hours
  if (isImmediateTrigger) {
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    if (!lastSent || lastSent < twoHoursAgo) {
      console.log(`[IMMEDIATE] Deposit reminder will be sent for ${booking.reference_code} (amount: ${booking.security_deposit_amount})`);
      return true;
    }
    console.log(`[IMMEDIATE] Deposit reminder skipped - already sent within 2 hours for ${booking.reference_code}`);
    return false;
  }

  // 3 days before - first reminder
  if (daysUntilDelivery <= 3 && !lastSent) {
    return true;
  }

  // 1 day before - final reminder (if last sent > 2 days ago)
  if (daysUntilDelivery <= 1 && lastSent) {
    const daysSinceLastSent = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastSent > 2) {
      return true;
    }
  }

  return false;
}

async function sendBalanceReminder(
  supabaseClient: any,
  booking: BookingDetails,
  balanceAmount: number,
  daysUntilDelivery: number,
  webhookUrl: string,
  appSettings: any,
  isImmediateTrigger: boolean = false
) {
  console.log(`Sending balance reminder for booking ${booking.reference_code} (immediate: ${isImmediateTrigger})`);

  // Get booking token for portal URL
  const { data: tokenData } = await supabaseClient
    .from('booking_access_tokens')
    .select('token')
    .eq('booking_id', booking.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const portalUrl = tokenData?.token 
    ? `${Deno.env.get('APP_DOMAIN')}/booking-form/${tokenData.token}`
    : `${Deno.env.get('APP_DOMAIN')}`;

  // Check for custom template in database
  const { data: customTemplate } = await supabaseClient
    .from('email_templates')
    .select('subject_line, html_content')
    .eq('template_type', 'balance_reminder')
    .eq('is_active', true)
    .maybeSingle();

  let emailHtml: string;
  let emailSubject: string;

  if (customTemplate) {
    // Use custom template with placeholder replacement
    emailSubject = customTemplate.subject_line
      .replace(/\{\{reference_code\}\}/g, booking.reference_code);
    
    emailHtml = customTemplate.html_content
      .replace(/\{\{client_name\}\}/g, booking.client_name)
      .replace(/\{\{reference_code\}\}/g, booking.reference_code)
      .replace(/\{\{balance_amount\}\}/g, balanceAmount.toFixed(2))
      .replace(/\{\{currency\}\}/g, booking.currency)
      .replace(/\{\{portalUrl\}\}/g, portalUrl)
      .replace(/\{\{company_name\}\}/g, appSettings?.company_name || 'KingRent')
      .replace(/\{\{logoUrl\}\}/g, appSettings?.logo_url || '/king-rent-logo.png')
      .replace(/\{\{days_until_delivery\}\}/g, daysUntilDelivery.toString())
      .replace(/\{\{balance_due_date\}\}/g, booking.balance_due_date 
        ? new Date(booking.balance_due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) 
        : '');
  } else {
    // Fallback to hardcoded template
    emailHtml = getBalancePaymentReminderEmail(
      booking as any,
      balanceAmount,
      portalUrl,
      daysUntilDelivery,
      appSettings
    );
    emailSubject = getEmailSubject('balance_reminder', booking.reference_code);
  }

  // Prepare webhook payload
  const webhookPayload = {
    to_email: booking.client_email,
    to_name: booking.client_name,
    email_subject: emailSubject,
    email_html: emailHtml,
    booking_reference: booking.reference_code,
    booking_car_model: booking.car_model,
    booking_delivery_datetime: booking.delivery_datetime,
    balance_amount: balanceAmount,
    days_until_delivery: daysUntilDelivery,
    reminder_type: isImmediateTrigger ? 'balance_payment_immediate' : 'balance_payment',
    timestamp: new Date().toISOString(),
  };

  // Send to Zapier webhook
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(webhookPayload),
  });

  if (!response.ok) {
    throw new Error(`Zapier webhook failed: ${response.statusText}`);
  }

  // Update reminder timestamp
  await supabaseClient
    .from('bookings')
    .update({ balance_payment_reminder_sent_at: new Date().toISOString() })
    .eq('id', booking.id);

  // Create audit log
  await supabaseClient.from('audit_logs').insert({
    entity: 'booking',
    entity_id: booking.id,
    action: 'reminder_sent',
    payload_snapshot: {
      reminder_type: isImmediateTrigger ? 'balance_payment_immediate' : 'balance_payment',
      days_until_delivery: daysUntilDelivery,
      balance_amount: balanceAmount,
      is_immediate: isImmediateTrigger,
    },
  });

  console.log(`Balance reminder sent successfully for ${booking.reference_code}`);
}

async function sendDepositReminder(
  supabaseClient: any,
  booking: BookingDetails,
  daysUntilDelivery: number,
  webhookUrl: string,
  appSettings: any,
  isImmediateTrigger: boolean = false
) {
  console.log(`Sending deposit reminder for booking ${booking.reference_code} (immediate: ${isImmediateTrigger})`);

  // Get booking token for portal URL
  const { data: tokenData } = await supabaseClient
    .from('booking_access_tokens')
    .select('token')
    .eq('booking_id', booking.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const portalUrl = tokenData?.token 
    ? `${Deno.env.get('APP_DOMAIN')}/booking-form/${tokenData.token}`
    : `${Deno.env.get('APP_DOMAIN')}`;

  // Check for custom template in database
  const { data: customTemplate } = await supabaseClient
    .from('email_templates')
    .select('subject_line, html_content')
    .eq('template_type', 'security_deposit_reminder')
    .eq('is_active', true)
    .maybeSingle();

  let emailHtml: string;
  let emailSubject: string;

  if (customTemplate) {
    // Use custom template with placeholder replacement
    emailSubject = customTemplate.subject_line
      .replace(/\{\{reference_code\}\}/g, booking.reference_code);
    
    emailHtml = customTemplate.html_content
      .replace(/\{\{client_name\}\}/g, booking.client_name)
      .replace(/\{\{reference_code\}\}/g, booking.reference_code)
      .replace(/\{\{deposit_amount\}\}/g, booking.security_deposit_amount.toFixed(2))
      .replace(/\{\{currency\}\}/g, booking.currency)
      .replace(/\{\{portalUrl\}\}/g, portalUrl)
      .replace(/\{\{company_name\}\}/g, appSettings?.company_name || 'KingRent')
      .replace(/\{\{logoUrl\}\}/g, appSettings?.logo_url || '/king-rent-logo.png')
      .replace(/\{\{days_until_delivery\}\}/g, daysUntilDelivery.toString());
  } else {
    // Fallback to hardcoded template
    emailHtml = getSecurityDepositReminderEmail(
      booking as any,
      booking.security_deposit_amount,
      portalUrl,
      daysUntilDelivery,
      appSettings
    );
    emailSubject = getEmailSubject('security_deposit_reminder', booking.reference_code);
  }

  // Prepare webhook payload
  const webhookPayload = {
    to_email: booking.client_email,
    to_name: booking.client_name,
    email_subject: emailSubject,
    email_html: emailHtml,
    booking_reference: booking.reference_code,
    booking_car_model: booking.car_model,
    booking_delivery_datetime: booking.delivery_datetime,
    security_deposit_amount: booking.security_deposit_amount,
    days_until_delivery: daysUntilDelivery,
    reminder_type: isImmediateTrigger ? 'security_deposit_immediate' : 'security_deposit',
    timestamp: new Date().toISOString(),
  };

  // Send to Zapier webhook
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(webhookPayload),
  });

  if (!response.ok) {
    throw new Error(`Zapier webhook failed: ${response.statusText}`);
  }

  // Update reminder timestamp
  await supabaseClient
    .from('bookings')
    .update({ security_deposit_reminder_sent_at: new Date().toISOString() })
    .eq('id', booking.id);

  // Create audit log
  await supabaseClient.from('audit_logs').insert({
    entity: 'booking',
    entity_id: booking.id,
    action: 'reminder_sent',
    payload_snapshot: {
      reminder_type: isImmediateTrigger ? 'security_deposit_immediate' : 'security_deposit',
      days_until_delivery: daysUntilDelivery,
      security_deposit_amount: booking.security_deposit_amount,
      is_immediate: isImmediateTrigger,
    },
  });

  console.log(`Deposit reminder sent successfully for ${booking.reference_code}`);
}
