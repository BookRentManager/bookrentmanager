import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Complete interface matching all email fields
interface ParsedBookingEmail {
  // Main booking info
  booking_date: string;
  booking_reference: string;
  client_name: string;
  requested_car: string;
  
  // Delivery details
  delivery_date: string;
  delivery_address: string;
  delivery_time: string;
  pickup_info: string;
  
  // Collection/Drop-off details
  dropoff_date: string;
  dropoff_address: string;
  dropoff_time: string;
  dropoff_info: string;
  
  // Vehicle details
  km_allowance: number;
  extra_km_cost: number;
  
  // Additional services
  additional_services: {
    infant_seat: number;
    booster_seat: number;
    child_seat: number;
    additional_driver_1: number;
    additional_driver_2: number;
    excess_reduction: boolean;
  };
  
  // Customer payment details
  payment_full_name: string;
  payment_company: string;
  payment_address: string;
  payment_city: string;
  payment_zip_code: string;
  payment_phone: string;
  payment_email: string;
  
  // Security deposit details
  deposit_amount: number;
  deposit_full_name: string;
  deposit_address: string;
  deposit_city: string;
  deposit_zip_code: string;
  deposit_phone: string;
  deposit_email: string;
  
  // Payment details
  rental_price: number;
  total_rental_amount: string;
  security_deposit: number;
  payment_method: string;
  payment_amount_percent: number;
}

// Gmail API helpers
async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  
  const data = await response.json();
  if (!data.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

async function fetchUnreadEmails(accessToken: string, emailAddress: string) {
  const query = `to:${emailAddress} is:unread subject:"DEAL!!! BOOKING FORM"`;
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=10`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  
  const data = await response.json();
  console.log(`Gmail API response: Found ${data.messages?.length || 0} unread booking emails`);
  return data.messages || [];
}

async function getEmailContent(accessToken: string, emailId: string) {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  
  const data = await response.json();
  
  // Extract plain text body
  let body = '';
  if (data.payload.parts) {
    const textPart = data.payload.parts.find((part: any) => part.mimeType === 'text/plain');
    if (textPart?.body?.data) {
      body = atob(textPart.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    }
  } else if (data.payload.body?.data) {
    body = atob(data.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
  }
  
  const subject = data.payload.headers.find((h: any) => h.name === 'Subject')?.value || '';
  
  return { body, subject, id: emailId };
}

async function markEmailAsRead(accessToken: string, emailId: string) {
  await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}/modify`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
    }
  );
  console.log(`Marked email ${emailId} as read`);
}

// Email parsing function
function parseBookingEmail(emailBody: string): ParsedBookingEmail {
  const extractField = (pattern: RegExp): string => {
    const match = emailBody.match(pattern);
    const value = match ? match[1].trim() : '';
    return value;
  };
  
  const extractNumber = (pattern: RegExp): number => {
    const value = extractField(pattern);
    const cleaned = value.replace(/,/g, '');
    return cleaned ? parseFloat(cleaned) : 0;
  };
  
  const extractBoolean = (pattern: RegExp): boolean => {
    const value = extractField(pattern);
    return value.toLowerCase() === 'true';
  };
  
  return {
    booking_date: extractField(/BOOKING DATE:\s*([^\r\n]+)/i),
    booking_reference: extractField(/BOOKING REFERENCE:\s*([^\r\n]+)/i),
    client_name: extractField(/CLIENT NAME:\s*([^\r\n]+)/i),
    requested_car: extractField(/REQUESTED CAR:\s*([^\r\n]+)/i),
    
    delivery_date: extractField(/DELIVERY DATE:\s*([^\r\n]+)/i),
    delivery_address: extractField(/DELIVERY ADDRESS:\s*([^\r\n]+)/i),
    delivery_time: extractField(/DELIVERY TIME:\s*([^\r\n]+)/i),
    pickup_info: extractField(/PICK UP INFO:\s*([^\r\n]+)/i),
    
    dropoff_date: extractField(/DROP OFF DATE:\s*([^\r\n]+)/i),
    dropoff_address: extractField(/DROP OFF ADDRESS:\s*([^\r\n]+)/i),
    dropoff_time: extractField(/DROP OFF TIME:\s*([^\r\n]+)/i),
    dropoff_info: extractField(/DROP OFF INFO:\s*([^\r\n]+)/i),
    
    km_allowance: extractNumber(/TOT KM ALLOWANCE:\s*([^\r\n]+)/i),
    extra_km_cost: extractNumber(/EXTRA KM COST:\s*([^\r\n]+)/i),
    
    additional_services: {
      infant_seat: extractNumber(/INFANT SEAT:\s*([^\r\n]+)/i),
      booster_seat: extractNumber(/BOOSTER SEAT:\s*([^\r\n]+)/i),
      child_seat: extractNumber(/CHILD SEAT:\s*([^\r\n]+)/i),
      additional_driver_1: extractNumber(/ADDITIONAL DRIVER 1:\s*([^\r\n]+)/i),
      additional_driver_2: extractNumber(/ADDITIONAL DRIVER 2:\s*([^\r\n]+)/i),
      excess_reduction: extractBoolean(/EXCESS REDUCTION:\s*([^\r\n]+)/i),
    },
    
    payment_full_name: extractField(/Customer payment details[\s\S]*?FULL NAME:\s*([^\r\n]+)/i),
    payment_company: extractField(/Customer payment details[\s\S]*?COMPANY:\s*([^\r\n]+)/i),
    payment_address: extractField(/Customer payment details[\s\S]*?ADDRESS:\s*([^\r\n]+)/i),
    payment_city: extractField(/Customer payment details[\s\S]*?CITY:\s*([^\r\n]+)/i),
    payment_zip_code: extractField(/Customer payment details[\s\S]*?ZIP CODE:\s*([^\r\n]+)/i),
    payment_phone: extractField(/Customer payment details[\s\S]*?PHONE:\s*([^\r\n]+)/i),
    payment_email: extractField(/Customer payment details[\s\S]*?EMAIL:\s*([^\r\n]+)/i),
    
    deposit_amount: extractNumber(/DEPOSIT AMOUNT:\s*([^\r\n]+)/i),
    deposit_full_name: extractField(/Customer security deposit details[\s\S]*?FULL NAME:\s*([^\r\n]+)/i),
    deposit_address: extractField(/Customer security deposit details[\s\S]*?ADDRESS:\s*([^\r\n]+)/i),
    deposit_city: extractField(/Customer security deposit details[\s\S]*?CITY:\s*([^\r\n]+)/i),
    deposit_zip_code: extractField(/Customer security deposit details[\s\S]*?ZIP CODE:\s*([^\r\n]+)/i),
    deposit_phone: extractField(/Customer security deposit details[\s\S]*?PHONE:\s*([^\r\n]+)/i),
    deposit_email: extractField(/Customer security deposit details[\s\S]*?EMAIL:\s*([^\r\n]+)/i),
    
    rental_price: extractNumber(/RENTAL PRICE:\s*([^\r\n]+)/i),
    total_rental_amount: extractField(/TOTAL RENTAL AMOUNT[^:]*:\s*([^\r\n]+)/i),
    security_deposit: extractNumber(/SECURITY DEPOSIT:\s*([^\r\n]+)/i),
    payment_method: extractField(/PAYMENT METHOD:\s*([^\r\n]+)/i),
    payment_amount_percent: extractNumber(/PAYMENT AMOUNT %:\s*([^\r\n]+)/i),
  };
}

// DateTime parsing
function parseDateTime(dateStr: string, timeStr: string): string {
  if (!dateStr) return new Date().toISOString();
  
  // Clean and normalize time (e.g., "16:00" or "1600" -> "16:00")
  let cleanTime = timeStr && timeStr !== "0" ? timeStr.trim() : "00:00";
  
  if (!cleanTime.includes(':')) {
    // Convert "1600" to "16:00" or "900" to "09:00"
    if (cleanTime.length === 4) {
      cleanTime = `${cleanTime.substring(0, 2)}:${cleanTime.substring(2)}`;
    } else if (cleanTime.length === 3) {
      cleanTime = `0${cleanTime.substring(0, 1)}:${cleanTime.substring(1)}`;
    } else {
      cleanTime = "00:00";
    }
  }
  
  const [day, month, year] = dateStr.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${cleanTime}:00Z`;
}

// Country extraction
function extractCountry(address: string): string {
  if (!address) return '';
  const parts = address.split(',');
  return parts[parts.length - 1].trim();
}

// Database upsert logic
async function upsertBooking(supabase: any, parsed: ParsedBookingEmail, emailId: string, emailSubject: string) {
  if (!parsed.booking_reference) {
    throw new Error('No booking reference found in email');
  }

  const bookingData = {
    reference_code: parsed.booking_reference,
    booking_date: parsed.booking_date ? parsed.booking_date.split('/').reverse().join('-') : null,
    
    client_name: parsed.client_name || 'Unknown Client',
    client_email: parsed.payment_email || null,
    client_phone: parsed.payment_phone || null,
    billing_address: parsed.payment_address ? `${parsed.payment_address}, ${parsed.payment_city}, ${parsed.payment_zip_code}` : null,
    company_name: parsed.payment_company || null,
    
    car_model: parsed.requested_car || 'TBD',
    car_plate: "TBD",
    
    delivery_location: parsed.delivery_address || 'TBD',
    delivery_info: parsed.pickup_info || null,
    delivery_datetime: parseDateTime(parsed.delivery_date, parsed.delivery_time),
    
    collection_location: parsed.dropoff_address || 'TBD',
    collection_info: parsed.dropoff_info === "Same" ? parsed.pickup_info : parsed.dropoff_info,
    collection_datetime: parseDateTime(parsed.dropoff_date, parsed.dropoff_time),
    
    country: extractCountry(parsed.delivery_address),
    
    km_included: parsed.km_allowance || null,
    extra_km_cost: parsed.extra_km_cost || null,
    security_deposit_amount: parsed.security_deposit || parsed.deposit_amount || 0,
    
    rental_price_gross: parsed.rental_price || 0,
    total_rental_amount: parsed.total_rental_amount ? parseFloat(parsed.total_rental_amount.replace(/,/g, '')) : parsed.rental_price,
    
    supplier_name: "TBD",
    supplier_price: 0,
    
    additional_services: parsed.additional_services,
    payment_method: parsed.payment_method || null,
    payment_amount_percent: parsed.payment_amount_percent || null,
    
    other_costs_total: 0,
    vat_rate: 0,
    amount_total: (() => {
      const totalAmount = parsed.total_rental_amount ? parseFloat(parsed.total_rental_amount.replace(/,/g, '')) : null;
      return (totalAmount && !isNaN(totalAmount)) ? totalAmount : (parsed.rental_price || 0);
    })(),
    amount_paid: 0,
    currency: "EUR",
    
    status: "confirmed",
    imported_from_email: true,
    email_import_date: new Date().toISOString(),
  };
  
  console.log(`Processing booking ${parsed.booking_reference}...`);
  
  // Check if booking exists
  const { data: existingBooking } = await supabase
    .from('bookings')
    .select('*')
    .eq('reference_code', parsed.booking_reference)
    .maybeSingle();
  
  let action = 'skipped';
  let changesDetected: string[] = [];
  
  if (existingBooking) {
    // Detect changes
    const fieldsToCompare = [
      'client_name', 'client_email', 'client_phone', 'delivery_location',
      'collection_location', 'rental_price_gross', 'km_included', 'car_model',
      'delivery_datetime', 'collection_datetime', 'security_deposit_amount'
    ];
    
    changesDetected = fieldsToCompare.filter(field => {
      const existingValue = existingBooking[field];
      const newValue = bookingData[field as keyof typeof bookingData];
      return existingValue !== newValue;
    });
    
    if (changesDetected.length > 0) {
      const { error } = await supabase
        .from('bookings')
        .update({
          ...bookingData,
          last_email_update: new Date().toISOString(),
        })
        .eq('id', existingBooking.id);
      
      if (error) throw error;
      
      action = 'updated';
      console.log(`✓ Updated booking ${parsed.booking_reference}: ${changesDetected.join(', ')}`);
    } else {
      console.log(`→ No changes for booking ${parsed.booking_reference}`);
    }
  } else {
    // Create new booking
    const { error } = await supabase
      .from('bookings')
      .insert(bookingData);
    
    if (error) throw error;
    
    action = 'created';
    console.log(`✓ Created booking ${parsed.booking_reference}`);
  }
  
  // Log import
  await supabase
    .from('email_import_logs')
    .insert({
      email_id: emailId,
      email_subject: emailSubject,
      booking_reference: parsed.booking_reference,
      action,
      changes_detected: changesDetected,
      raw_email_snippet: emailSubject.substring(0, 500),
    });
  
  return { action, changesDetected };
}

// Main handler
const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    console.log('=== Gmail Booking Import Starting ===');
    
    const clientId = Deno.env.get('GMAIL_CLIENT_ID');
    const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET');
    const refreshToken = Deno.env.get('GMAIL_REFRESH_TOKEN');
    const emailAddress = Deno.env.get('BOOKING_EMAIL_ADDRESS');
    
    if (!clientId || !clientSecret || !refreshToken || !emailAddress) {
      throw new Error('Missing Gmail credentials. Please configure: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, BOOKING_EMAIL_ADDRESS');
    }
    
    console.log(`Configured for email: ${emailAddress}`);
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    // Get Gmail access token
    console.log('Authenticating with Gmail...');
    const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);
    
    // Fetch unread emails
    console.log('Fetching unread emails with "DEAL!!! BOOKING FORM" in subject...');
    const messages = await fetchUnreadEmails(accessToken, emailAddress);
    
    console.log(`Found ${messages.length} unread booking emails`);
    
    const results = {
      processed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[],
    };
    
    // Process each email
    for (const message of messages) {
      try {
        console.log(`\nProcessing email: ${message.id}`);
        const email = await getEmailContent(accessToken, message.id);
        const parsed = parseBookingEmail(email.body);
        
        const { action } = await upsertBooking(supabase, parsed, email.id, email.subject);
        
        results[action as keyof typeof results]++;
        results.processed++;
        
        // Mark as read
        await markEmailAsRead(accessToken, message.id);
        
      } catch (error) {
        console.error(`✗ Failed to process email ${message.id}:`, error);
        results.failed++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorDetails = error instanceof Error && 'code' in error 
          ? JSON.stringify(error, Object.getOwnPropertyNames(error))
          : errorMessage;
        results.errors.push(`Email ${message.id}: ${errorMessage}`);
        
        // Log detailed error
        await supabase
          .from('email_import_logs')
          .insert({
            email_id: message.id,
            action: 'failed',
            error_message: errorDetails,
            raw_email_snippet: errorDetails.substring(0, 500),
          });
      }
    }
    
    console.log('\n=== Gmail Booking Import Complete ===');
    console.log(`Processed: ${results.processed}, Created: ${results.created}, Updated: ${results.updated}, Skipped: ${results.skipped}, Failed: ${results.failed}`);
    
    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('✗ Error in gmail-booking-import:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: 'Check edge function logs for more information'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};

serve(handler);
