import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { 
  getBalancePaymentReminderEmail, 
  getEmailSubject 
} from '../_shared/email-templates.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BookingDetails {
  id: string;
  reference_code: string;
  client_name: string;
  client_email: string;
  delivery_datetime: string;
  amount_total: number;
  amount_paid: number;
  payment_amount_percent: number;
  security_deposit_amount: number;
  currency: string;
  balance_payment_reminder_sent_at: string | null;
  security_deposit_reminder_sent_at: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔔 Starting payment reminders check...');

    // Get bookings that need reminders
    // - status = 'confirmed'
    // - delivery_datetime within 48 hours
    // - reminder not already sent
    const reminderWindow = new Date();
    reminderWindow.setHours(reminderWindow.getHours() + 48);

    const { data: bookings, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('status', 'confirmed')
      .lte('delivery_datetime', reminderWindow.toISOString())
      .gte('delivery_datetime', new Date().toISOString());

    if (fetchError) {
      console.error('Error fetching bookings:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${bookings?.length || 0} bookings to check for reminders`);

    let balanceReminders = 0;
    let depositReminders = 0;

    for (const booking of bookings || []) {
      console.log(`\nProcessing booking ${booking.reference_code}...`);

      // Check if balance payment reminder needed
      const needsBalanceReminder = 
        booking.payment_amount_percent && 
        booking.payment_amount_percent < 100 && 
        !booking.balance_payment_reminder_sent_at;

      // Check if security deposit reminder needed
      const needsDepositReminder = 
        booking.security_deposit_amount > 0 && 
        !booking.security_deposit_reminder_sent_at;

      if (!needsBalanceReminder && !needsDepositReminder) {
        console.log(`  ⏭️  No reminders needed`);
        continue;
      }

      // Calculate remaining balance
      const remainingBalance = booking.amount_total - booking.amount_paid;

      // Create balance payment link if needed
      if (needsBalanceReminder && remainingBalance > 0) {
        console.log(`  💰 Creating balance payment link for ${booking.currency} ${remainingBalance}`);
        
        const { data: paymentData, error: paymentError } = await supabase.functions.invoke(
          'create-postfinance-payment-link',
          {
            body: {
              booking_id: booking.id,
              amount: remainingBalance,
              payment_type: 'balance',
              description: `Balance payment for booking ${booking.reference_code}`,
            },
          }
        );

        if (paymentError) {
          console.error(`  ❌ Error creating balance payment link:`, paymentError);
          continue;
        }

        // Send balance payment reminder email
        const balanceEmailHtml = getBalancePaymentReminderEmail(
          booking as any,
          remainingBalance,
          paymentData.payment_url
        );

        const { error: emailError } = await supabase.functions.invoke('send-gmail', {
          body: {
            to: booking.client_email,
            subject: getEmailSubject('balance_reminder', booking.reference_code),
            html: balanceEmailHtml,
          },
        });

        if (emailError) {
          console.error(`  ❌ Error sending balance reminder email:`, emailError);
        } else {
          console.log(`  ✅ Balance reminder sent`);
          balanceReminders++;
        }

        // Update booking with reminder timestamp and link
        await supabase
          .from('bookings')
          .update({
            balance_payment_reminder_sent_at: new Date().toISOString(),
            balance_payment_link_id: paymentData.payment_id,
          })
          .eq('id', booking.id);
      }

      // Create security deposit authorization link if needed
      if (needsDepositReminder) {
        console.log(`  🔒 Creating security deposit authorization for ${booking.currency} ${booking.security_deposit_amount}`);
        
        const { data: authData, error: authError } = await supabase.functions.invoke(
          'authorize-security-deposit',
          {
            body: {
              booking_id: booking.id,
              amount: booking.security_deposit_amount,
              currency: booking.currency,
            },
          }
        );

        if (authError) {
          console.error(`  ❌ Error creating security deposit authorization:`, authError);
          continue;
        }

        // Send security deposit authorization email
        const depositEmailHtml = getSecurityDepositAuthorizationEmail(
          booking as any,
          authData.authorization_url,
          booking.security_deposit_amount,
          booking.currency
        );

        const { error: emailError } = await supabase.functions.invoke('send-gmail', {
          body: {
            to: booking.client_email,
            subject: `Security Deposit Authorization Required - ${booking.reference_code}`,
            html: depositEmailHtml,
          },
        });

        if (emailError) {
          console.error(`  ❌ Error sending deposit authorization email:`, emailError);
        } else {
          console.log(`  ✅ Security deposit reminder sent`);
          depositReminders++;
        }

        // Update booking with reminder timestamp and link
        await supabase
          .from('bookings')
          .update({
            security_deposit_reminder_sent_at: new Date().toISOString(),
            security_deposit_link_id: authData.authorization_id,
          })
          .eq('id', booking.id);
      }

      // Log to audit trail
      await supabase.from('audit_logs').insert({
        entity: 'booking',
        entity_id: booking.id,
        action: 'reminders_sent',
        payload_snapshot: {
          balance_reminder: needsBalanceReminder,
          deposit_reminder: needsDepositReminder,
          balance_amount: needsBalanceReminder ? remainingBalance : null,
          deposit_amount: needsDepositReminder ? booking.security_deposit_amount : null,
        },
      });
    }

    console.log(`\n✅ Reminder check complete: ${balanceReminders} balance, ${depositReminders} deposit reminders sent`);

    return new Response(
      JSON.stringify({
        success: true,
        bookings_checked: bookings?.length || 0,
        balance_reminders_sent: balanceReminders,
        deposit_reminders_sent: depositReminders,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in send-payment-reminders:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

function getSecurityDepositAuthorizationEmail(
  booking: any,
  authorizationUrl: string,
  amount: number,
  currency: string
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333333; margin: 0;">Security Deposit Authorization Required</h1>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
          <p style="margin: 0; color: #666666;">Booking Reference: <strong style="color: #333333;">${booking.reference_code}</strong></p>
        </div>

        <p style="color: #333333; line-height: 1.6;">Dear ${booking.client_name},</p>
        
        <p style="color: #333333; line-height: 1.6;">
          Your rental is coming up soon! To complete your booking, we need to authorize a security deposit of <strong>${currency} ${amount.toFixed(2)}</strong>.
        </p>

        <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0; color: #1976d2;">Important Information:</h3>
          <ul style="margin: 0; padding-left: 20px; color: #333333;">
            <li>This is a <strong>temporary hold</strong>, not a charge</li>
            <li>The amount will be <strong>released automatically</strong> after you return the vehicle</li>
            <li>No money will be deducted unless there are damages</li>
            <li>Authorization expires in 30 days</li>
          </ul>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${authorizationUrl}" 
             style="display: inline-block; background-color: #1976d2; color: #ffffff; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Authorize Security Deposit
          </a>
        </div>

        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 30px;">
          <h3 style="margin: 0 0 15px 0; color: #333333;">Rental Details:</h3>
          <p style="margin: 5px 0; color: #666666;"><strong>Vehicle:</strong> ${booking.car_model}</p>
          <p style="margin: 5px 0; color: #666666;"><strong>Pick-up:</strong> ${new Date(booking.delivery_datetime).toLocaleString()}</p>
          <p style="margin: 5px 0; color: #666666;"><strong>Location:</strong> ${booking.delivery_location}</p>
        </div>

        <p style="color: #666666; font-size: 14px; margin-top: 30px; line-height: 1.6;">
          If you have any questions, please don't hesitate to contact us.
        </p>

        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #999999; font-size: 12px;">
          <p>KingRent - Premium Car Rental Service</p>
        </div>
      </div>
    </body>
    </html>
  `;
}