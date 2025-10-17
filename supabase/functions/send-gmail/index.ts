import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    content: string; // base64 encoded
    mimeType: string;
  }>;
}

// Refresh Gmail access token using refresh token
async function getAccessToken(): Promise<string> {
  const refreshToken = Deno.env.get('GMAIL_REFRESH_TOKEN');
  const clientId = Deno.env.get('GMAIL_CLIENT_ID');
  const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET');

  if (!refreshToken || !clientId || !clientSecret) {
    throw new Error('Missing Gmail OAuth credentials');
  }

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

  if (!response.ok) {
    const error = await response.text();
    console.error('Failed to refresh Gmail token:', error);
    throw new Error('Failed to refresh Gmail access token');
  }

  const data = await response.json();
  return data.access_token;
}

// Create RFC 2822 MIME message
function createMimeMessage(email: EmailRequest, fromEmail: string): string {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36)}`;
  const messageParts: string[] = [];

  // Email headers
  messageParts.push(`From: ${fromEmail}`);
  messageParts.push(`To: ${email.to}`);
  if (email.cc && email.cc.length > 0) {
    messageParts.push(`Cc: ${email.cc.join(', ')}`);
  }
  if (email.bcc && email.bcc.length > 0) {
    messageParts.push(`Bcc: ${email.bcc.join(', ')}`);
  }
  messageParts.push(`Subject: ${email.subject}`);
  messageParts.push(`MIME-Version: 1.0`);
  messageParts.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  messageParts.push('');

  // HTML body
  messageParts.push(`--${boundary}`);
  messageParts.push('Content-Type: text/html; charset="UTF-8"');
  messageParts.push('Content-Transfer-Encoding: base64');
  messageParts.push('');
  messageParts.push(btoa(unescape(encodeURIComponent(email.html))));
  messageParts.push('');

  // Attachments
  if (email.attachments && email.attachments.length > 0) {
    for (const attachment of email.attachments) {
      messageParts.push(`--${boundary}`);
      messageParts.push(`Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`);
      messageParts.push('Content-Transfer-Encoding: base64');
      messageParts.push(`Content-Disposition: attachment; filename="${attachment.filename}"`);
      messageParts.push('');
      messageParts.push(attachment.content);
      messageParts.push('');
    }
  }

  messageParts.push(`--${boundary}--`);

  return messageParts.join('\r\n');
}

// Base64url encode for Gmail API
function base64urlEncode(str: string): string {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Send email via Gmail API
async function sendEmail(email: EmailRequest): Promise<{ id: string; threadId: string }> {
  console.log('Starting email send process to:', email.to);
  
  const accessToken = await getAccessToken();
  console.log('Access token obtained');

  const fromEmail = Deno.env.get('BOOKING_EMAIL_ADDRESS');
  if (!fromEmail) {
    throw new Error('BOOKING_EMAIL_ADDRESS not configured');
  }

  // Create MIME message
  const mimeMessage = createMimeMessage(email, fromEmail);
  console.log('MIME message created, size:', mimeMessage.length, 'bytes');

  // Encode for Gmail API
  const encodedMessage = base64urlEncode(mimeMessage);

  // Send via Gmail API
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raw: encodedMessage,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Gmail API error:', error);
    throw new Error(`Failed to send email: ${error}`);
  }

  const result = await response.json();
  console.log('Email sent successfully, message ID:', result.id);
  
  return {
    id: result.id,
    threadId: result.threadId,
  };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const emailRequest: EmailRequest = await req.json();

    // Validate required fields
    if (!emailRequest.to || !emailRequest.subject || !emailRequest.html) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, subject, html' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailRequest.to)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Sending email:', {
      to: emailRequest.to,
      subject: emailRequest.subject,
      hasAttachments: !!emailRequest.attachments?.length,
    });

    // Send email
    const result = await sendEmail(emailRequest);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: result.id,
        threadId: result.threadId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in send-gmail function:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to send email',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};

serve(handler);
