import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Format date to iCal format (YYYYMMDDTHHMMSSZ)
function formatICalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// Escape special characters for iCal text fields
function escapeICalText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// Generate a unique ID for each event
function generateEventUID(bookingId: string, eventType: string, domain: string): string {
  return `${bookingId}-${eventType}@${domain}`;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    const eventType = url.searchParams.get('type'); // 'delivery', 'collection', or null (all)

    if (!token) {
      return new Response('Missing calendar token', { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find user by calendar token
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, view_scope')
      .eq('calendar_token', token)
      .single();

    if (profileError || !profile) {
      console.error('Profile lookup error:', profileError);
      return new Response('Invalid calendar token', { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Build query for confirmed bookings
    let query = supabase
      .from('bookings')
      .select(`
        id,
        reference_code,
        client_name,
        client_phone,
        car_model,
        car_plate,
        delivery_datetime,
        delivery_location,
        delivery_info,
        collection_datetime,
        collection_location,
        collection_info,
        status,
        created_by
      `)
      .eq('status', 'confirmed')
      .is('deleted_at', null)
      .order('delivery_datetime', { ascending: true });

    // Apply view_scope filter if not 'all'
    if (profile.view_scope !== 'all') {
      query = query.eq('created_by', profile.id);
    }

    const { data: bookings, error: bookingsError } = await query;

    if (bookingsError) {
      console.error('Bookings fetch error:', bookingsError);
      return new Response('Error fetching bookings', { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    const domain = 'bookrentmanager.lovable.app';
    const now = new Date();

    // Build iCal content
    let icalContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//KingRent//BookRentManager//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:KingRent Bookings
X-WR-TIMEZONE:Europe/Zurich
`;

    for (const booking of bookings || []) {
      const deliveryDate = new Date(booking.delivery_datetime);
      const collectionDate = new Date(booking.collection_datetime);
      
      // Add 1 hour duration for each event
      const deliveryEnd = new Date(deliveryDate.getTime() + 60 * 60 * 1000);
      const collectionEnd = new Date(collectionDate.getTime() + 60 * 60 * 1000);

      // Delivery Event (only if not filtering to collection-only)
      if (!eventType || eventType === 'delivery') {
        const deliveryDescription = [
          `Booking: ${booking.reference_code}`,
          `Client: ${booking.client_name}`,
          booking.client_phone ? `Phone: ${booking.client_phone}` : '',
          `Car: ${booking.car_model} (${booking.car_plate})`,
          booking.delivery_info ? `Notes: ${booking.delivery_info}` : '',
        ].filter(Boolean).join('\\n');

        icalContent += `BEGIN:VEVENT
UID:${generateEventUID(booking.id, 'delivery', domain)}
DTSTAMP:${formatICalDate(now)}
DTSTART:${formatICalDate(deliveryDate)}
DTEND:${formatICalDate(deliveryEnd)}
SUMMARY:🚗 Delivery - ${escapeICalText(booking.client_name)} (${escapeICalText(booking.car_model)})
LOCATION:${escapeICalText(booking.delivery_location)}
DESCRIPTION:${deliveryDescription}
STATUS:CONFIRMED
COLOR:green
CATEGORIES:Delivery
END:VEVENT
`;
      }

      // Collection Event (only if not filtering to delivery-only)
      if (!eventType || eventType === 'collection') {
        const collectionDescription = [
          `Booking: ${booking.reference_code}`,
          `Client: ${booking.client_name}`,
          booking.client_phone ? `Phone: ${booking.client_phone}` : '',
          `Car: ${booking.car_model} (${booking.car_plate})`,
          booking.collection_info ? `Notes: ${booking.collection_info}` : '',
        ].filter(Boolean).join('\\n');

        icalContent += `BEGIN:VEVENT
UID:${generateEventUID(booking.id, 'collection', domain)}
DTSTAMP:${formatICalDate(now)}
DTSTART:${formatICalDate(collectionDate)}
DTEND:${formatICalDate(collectionEnd)}
SUMMARY:🔄 Collection - ${escapeICalText(booking.client_name)} (${escapeICalText(booking.car_model)})
LOCATION:${escapeICalText(booking.collection_location)}
DESCRIPTION:${collectionDescription}
STATUS:CONFIRMED
COLOR:red
CATEGORIES:Collection
END:VEVENT
`;
      }
    }

    icalContent += 'END:VCALENDAR';

    console.log(`Calendar feed generated for user ${profile.id}: ${bookings?.length || 0} bookings`);

    return new Response(icalContent, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="kingrent-bookings.ics"',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (error) {
    console.error('Calendar feed error:', error);
    return new Response('Internal server error', { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
    });
  }
});
