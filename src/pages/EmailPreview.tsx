import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Mail, Code } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import DOMPurify from 'dompurify';

export default function EmailPreview() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emailHtml, setEmailHtml] = useState<string>('');
  const [showRaw, setShowRaw] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    const generateEmailPreview = async () => {
      if (!sessionId) {
        setError('Missing session_id parameter');
        setLoading(false);
        return;
      }

      try {
        // Fetch payment data
        const { data: payment, error: paymentError } = await supabase
          .from('payments')
          .select('*')
          .eq('payment_link_id', sessionId)
          .single();

        if (paymentError || !payment) {
          setError('Payment not found');
          setLoading(false);
          return;
        }

        // Fetch booking data
        const { data: booking, error: bookingError } = await supabase
          .from('bookings')
          .select('*')
          .eq('id', payment.booking_id)
          .single();

        if (bookingError || !booking) {
          setError('Booking not found');
          setLoading(false);
          return;
        }

        // Fetch app settings
        const { data: appSettings } = await supabase
          .from('app_settings')
          .select('*')
          .limit(1)
          .single();

        const companyName = appSettings?.company_name || 'BookRentManager';
        const remainingBalance = booking.amount_total - booking.amount_paid;

        // Generate the exact same email HTML as send-payment-confirmation
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Payment Confirmation & Booking Details</h2>
            <p>Dear ${booking.client_name},</p>
            <p>Thank you for your payment. Your booking is now confirmed!</p>
            
            ${booking.guest_name ? `
              <div style="background-color: #e0f2fe; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h4 style="margin-top: 0; color: #0369a1;">Guest Information</h4>
                <p style="margin: 5px 0;"><strong>Name:</strong> ${booking.guest_name}</p>
                ${booking.guest_country ? `<p style="margin: 5px 0;"><strong>Country:</strong> ${booking.guest_country}</p>` : ''}
                ${booking.guest_phone ? `<p style="margin: 5px 0;"><strong>Phone:</strong> ${booking.guest_phone}</p>` : ''}
              </div>
            ` : ''}
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Payment Summary</h3>
              <p><strong>Booking Reference:</strong> ${booking.reference_code}</p>
              <p><strong>Amount Paid:</strong> ${payment.currency} ${payment.amount.toFixed(2)}</p>
              <p><strong>Payment Method:</strong> ${payment.payment_method_type || payment.method}</p>
              ${payment.postfinance_transaction_id ? `<p><strong>Transaction ID:</strong> ${payment.postfinance_transaction_id}</p>` : ''}
              <p><strong>Total Booking Amount:</strong> ${booking.currency} ${booking.amount_total.toFixed(2)}</p>
              <p><strong>Total Paid:</strong> ${booking.currency} ${booking.amount_paid.toFixed(2)}</p>
              <p><strong>Remaining Balance:</strong> ${booking.currency} ${remainingBalance.toFixed(2)}</p>
            </div>

            ${remainingBalance === 0 
              ? '<div style="background-color: #d1fae5; color: #065f46; padding: 15px; border-radius: 8px; margin: 20px 0;"><strong>✓ Your booking is now fully paid!</strong></div>'
              : `<div style="background-color: #fef3c7; color: #92400e; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <strong>Remaining balance:</strong> ${booking.currency} ${remainingBalance.toFixed(2)} is due.
                </div>`
            }

            ${booking.status === 'confirmed' 
              ? '<p style="color: #10b981; font-weight: bold;">✓ Your booking is confirmed!</p>'
              : ''
            }

            <div style="margin: 30px 0;">
              <h3>Your Documents</h3>
              <p>Please find your documents below:</p>
              <ul style="list-style: none; padding: 0;">
                ${payment.receipt_url ? `
                  <li style="margin: 10px 0;">
                    <a href="${payment.receipt_url}" 
                       style="display: inline-block; background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                      📄 Download Payment Receipt
                    </a>
                  </li>
                ` : '<li><em>Payment receipt: Not yet generated</em></li>'}
                ${booking.confirmation_pdf_url ? `
                  <li style="margin: 10px 0;">
                    <a href="${booking.confirmation_pdf_url}" 
                       style="display: inline-block; background-color: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                      📋 Download Signed Booking Confirmation
                    </a>
                  </li>
                ` : '<li><em>Booking confirmation: Not yet generated</em></li>'}
              </ul>
            </div>

            <p>If you have any questions, please don't hesitate to contact us.</p>
            <p>Best regards,<br>${companyName}</p>
          </div>
        `;

        setEmailHtml(html);
        setDebugInfo({
          payment: {
            id: payment.id,
            amount: payment.amount,
            currency: payment.currency,
            method: payment.method,
            payment_method_type: payment.payment_method_type,
            receipt_url: payment.receipt_url,
          },
          booking: {
            reference_code: booking.reference_code,
            client_name: booking.client_name,
            client_email: booking.client_email,
            guest_name: booking.guest_name,
            status: booking.status,
            amount_total: booking.amount_total,
            amount_paid: booking.amount_paid,
            confirmation_pdf_url: booking.confirmation_pdf_url,
          },
          appSettings: {
            company_name: companyName,
          }
        });
        setLoading(false);
      } catch (err: any) {
        console.error('Error generating preview:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    generateEmailPreview();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Generating email preview...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header Banner */}
        <Alert>
          <Mail className="h-4 w-4" />
          <AlertDescription>
            <strong>EMAIL PREVIEW</strong> - This is what should be sent to the client
          </AlertDescription>
        </Alert>

        {/* Controls */}
        <div className="flex gap-2">
          <Button
            variant={showRaw ? "outline" : "default"}
            size="sm"
            onClick={() => setShowRaw(false)}
          >
            <Mail className="h-4 w-4 mr-2" />
            Formatted View
          </Button>
          <Button
            variant={showRaw ? "default" : "outline"}
            size="sm"
            onClick={() => setShowRaw(true)}
          >
            <Code className="h-4 w-4 mr-2" />
            Raw HTML
          </Button>
        </div>

        {/* Email Content */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Email Content
              <Badge variant="outline">Subject: Payment Receipt - {debugInfo?.booking?.reference_code}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {showRaw ? (
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                <code>{emailHtml}</code>
              </pre>
            ) : (
              <div 
                className="border rounded-lg p-4 bg-white"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(emailHtml) }}
              />
            )}
          </CardContent>
        </Card>

        {/* Debug Info */}
        <Card>
          <CardHeader>
            <CardTitle>Debug Information</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
              <code>{JSON.stringify(debugInfo, null, 2)}</code>
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
