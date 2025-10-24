// Email template library - now fetches from database
// Provides dynamic HTML email templates with customizable content

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

interface BookingDetails {
  reference_code: string;
  client_name: string;
  car_model: string;
  pickup_date: string;
  return_date: string;
  pickup_location: string;
  return_location: string;
  amount_total: number;
  amount_paid?: number;
  currency?: string;
}

interface PaymentDetails {
  amount: number;
  payment_method: string;
  transaction_id: string;
  payment_date: string;
  remaining_balance?: number;
}

interface BankDetails {
  accountName: string;
  iban: string;
  bic: string;
  bankName: string;
  reference: string;
}

// Helper function to create Supabase client
function getSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, supabaseKey);
}

// Helper function to fetch template from database
async function fetchTemplate(templateType: string): Promise<{ subject: string; html: string } | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('email_templates')
    .select('subject_line, html_content')
    .eq('template_type', templateType)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    console.error(`Failed to fetch template ${templateType}:`, error);
    return null;
  }

  return {
    subject: data.subject_line,
    html: data.html_content
  };
}

// Helper function to replace placeholders in template
function replacePlaceholders(
  template: string,
  replacements: Record<string, string | number>
): string {
  let result = template;
  
  for (const [key, value] of Object.entries(replacements)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, String(value));
  }
  
  return result;
}

// Booking Confirmation Email
export async function getBookingConfirmationEmail(
  booking: BookingDetails,
  formUrl: string,
  appSettings?: any
): Promise<{ subject: string; html: string }> {
  const template = await fetchTemplate('booking_confirmation');
  
  if (!template) {
    // Fallback to hardcoded template if database fetch fails
    return {
      subject: `Complete Your Booking Form - ${booking.reference_code}`,
      html: getFallbackBookingConfirmation(booking, formUrl, appSettings)
    };
  }

  const replacements = {
    reference_code: booking.reference_code,
    client_name: booking.client_name,
    car_model: booking.car_model,
    pickup_date: booking.pickup_date,
    return_date: booking.return_date,
    pickup_location: booking.pickup_location || 'To be confirmed',
    return_location: booking.return_location || 'To be confirmed',
    form_url: formUrl,
    company_name: appSettings?.company_name || 'KingRent',
    company_email: appSettings?.company_email || 'info@kingrent.com',
    company_phone: appSettings?.company_phone || '+41 79 123 45 67'
  };

  return {
    subject: replacePlaceholders(template.subject, replacements),
    html: replacePlaceholders(template.html, replacements)
  };
}

// Payment Confirmation Email
export async function getPaymentConfirmationEmail(
  booking: BookingDetails,
  payment: PaymentDetails,
  appSettings?: any
): Promise<{ subject: string; html: string }> {
  const template = await fetchTemplate('payment_confirmation');
  
  if (!template) {
    return {
      subject: `Payment Received - ${booking.reference_code}`,
      html: getFallbackPaymentConfirmation(booking, payment, appSettings)
    };
  }

  const replacements = {
    reference_code: booking.reference_code,
    client_name: booking.client_name,
    car_model: booking.car_model,
    pickup_date: booking.pickup_date,
    return_date: booking.return_date,
    pickup_location: booking.pickup_location || 'To be confirmed',
    return_location: booking.return_location || 'To be confirmed',
    amount_paid: payment.amount,
    currency: booking.currency || 'EUR',
    payment_method: payment.payment_method,
    payment_date: payment.payment_date,
    company_name: appSettings?.company_name || 'KingRent',
    company_email: appSettings?.company_email || 'info@kingrent.com',
    company_phone: appSettings?.company_phone || '+41 79 123 45 67'
  };

  return {
    subject: replacePlaceholders(template.subject, replacements),
    html: replacePlaceholders(template.html, replacements)
  };
}

// Balance Payment Reminder Email
export async function getBalancePaymentReminderEmail(
  booking: BookingDetails,
  remainingAmount: number,
  paymentUrl: string,
  appSettings?: any
): Promise<{ subject: string; html: string }> {
  const template = await fetchTemplate('balance_reminder');
  
  if (!template) {
    return {
      subject: `Balance Payment Reminder - ${booking.reference_code}`,
      html: getFallbackBalanceReminder(booking, remainingAmount, paymentUrl, appSettings)
    };
  }

  const replacements = {
    reference_code: booking.reference_code,
    client_name: booking.client_name,
    car_model: booking.car_model,
    pickup_date: booking.pickup_date,
    return_date: booking.return_date,
    remaining_amount: remainingAmount,
    currency: booking.currency || 'EUR',
    payment_url: paymentUrl,
    company_name: appSettings?.company_name || 'KingRent',
    company_email: appSettings?.company_email || 'info@kingrent.com',
    company_phone: appSettings?.company_phone || '+41 79 123 45 67'
  };

  return {
    subject: replacePlaceholders(template.subject, replacements),
    html: replacePlaceholders(template.html, replacements)
  };
}

// Bank Transfer Instructions Email
export async function getBankTransferInstructionsEmail(
  booking: BookingDetails,
  amount: number,
  bankDetails: BankDetails,
  appSettings?: any
): Promise<{ subject: string; html: string }> {
  const template = await fetchTemplate('bank_transfer');
  
  if (!template) {
    return {
      subject: `Bank Transfer Instructions - ${booking.reference_code}`,
      html: getFallbackBankTransfer(booking, amount, bankDetails, appSettings)
    };
  }

  const replacements = {
    reference_code: booking.reference_code,
    client_name: booking.client_name,
    car_model: booking.car_model,
    pickup_date: booking.pickup_date,
    return_date: booking.return_date,
    amount: amount,
    currency: booking.currency || 'EUR',
    account_name: bankDetails.accountName,
    iban: bankDetails.iban,
    bic: bankDetails.bic,
    bank_name: bankDetails.bankName,
    reference: bankDetails.reference,
    company_name: appSettings?.company_name || 'KingRent',
    company_email: appSettings?.company_email || 'info@kingrent.com',
    company_phone: appSettings?.company_phone || '+41 79 123 45 67'
  };

  return {
    subject: replacePlaceholders(template.subject, replacements),
    html: replacePlaceholders(template.html, replacements)
  };
}

// Booking Confirmed Email (kept as is, not in database)
export function getBookingConfirmedEmail(
  booking: BookingDetails,
  portalUrl: string,
  appSettings?: any
): string {
  const companyName = appSettings?.company_name || 'KingRent';
  const companyEmail = appSettings?.company_email || 'info@kingrent.com';
  const companyPhone = appSettings?.company_phone || '+41 79 123 45 67';
  
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a1a1a; color: #d4af37; padding: 20px; text-align: center; }
    .content { background: #fff; padding: 20px; }
    .button { display: inline-block; padding: 12px 24px; background: #d4af37; color: #1a1a1a; text-decoration: none; border-radius: 4px; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Booking Confirmed!</h1>
    </div>
    <div class="content">
      <p>Dear ${booking.client_name},</p>
      <p>Your booking is now confirmed! Reference: <strong>${booking.reference_code}</strong></p>
      <p>You can access your booking portal anytime to view details and documents:</p>
      <p style="text-align: center;">
        <a href="${portalUrl}" class="button">Access Booking Portal</a>
      </p>
    </div>
    <div class="footer">
      <p>${companyName}<br>${companyEmail} | ${companyPhone}</p>
    </div>
  </div>
</body>
</html>`;
}

// Fallback templates (simple versions if database fetch fails)
function getFallbackBookingConfirmation(booking: BookingDetails, formUrl: string, appSettings?: any): string {
  return `<!DOCTYPE html><html><body><h1>Complete Your Booking</h1><p>Dear ${booking.client_name},</p><p>Reference: ${booking.reference_code}</p><p><a href="${formUrl}">Complete Booking Form</a></p></body></html>`;
}

function getFallbackPaymentConfirmation(booking: BookingDetails, payment: PaymentDetails, appSettings?: any): string {
  return `<!DOCTYPE html><html><body><h1>Payment Received</h1><p>Dear ${booking.client_name},</p><p>Reference: ${booking.reference_code}</p><p>Amount: ${payment.amount} ${booking.currency || 'EUR'}</p></body></html>`;
}

function getFallbackBalanceReminder(booking: BookingDetails, remainingAmount: number, paymentUrl: string, appSettings?: any): string {
  return `<!DOCTYPE html><html><body><h1>Balance Payment Reminder</h1><p>Dear ${booking.client_name},</p><p>Reference: ${booking.reference_code}</p><p>Outstanding: ${remainingAmount} ${booking.currency || 'EUR'}</p><p><a href="${paymentUrl}">Pay Now</a></p></body></html>`;
}

function getFallbackBankTransfer(booking: BookingDetails, amount: number, bankDetails: BankDetails, appSettings?: any): string {
  return `<!DOCTYPE html><html><body><h1>Bank Transfer Instructions</h1><p>Dear ${booking.client_name},</p><p>IBAN: ${bankDetails.iban}</p><p>Amount: ${amount} ${booking.currency || 'EUR'}</p><p>Reference: ${bankDetails.reference}</p></body></html>`;
}

// Email subject helper
export function getEmailSubject(
  type: 'booking_confirmation' | 'payment_confirmation' | 'balance_reminder' | 'bank_transfer' | 'booking_confirmed',
  referenceCode: string
): string {
  const subjects = {
    booking_confirmation: `Complete Your Booking Form - ${referenceCode}`,
    payment_confirmation: `Payment Received - ${referenceCode}`,
    balance_reminder: `Balance Payment Reminder - ${referenceCode}`,
    bank_transfer: `Bank Transfer Instructions - ${referenceCode}`,
    booking_confirmed: `Booking Confirmed - ${referenceCode}`
  };
  
  return subjects[type];
}
