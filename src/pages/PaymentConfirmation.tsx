import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2, Download, Printer, Mail, Link2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { ClientBookingPDF } from '@/components/ClientBookingPDF';


export default function PaymentConfirmation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'success' | 'failed' | 'processing'>('processing');
  const [booking, setBooking] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [appSettings, setAppSettings] = useState<any>(null);
  const [paymentIntent, setPaymentIntent] = useState<string | null>(null);
  
  const sessionId = searchParams.get('session_id');
  const bookingRef = searchParams.get('booking_ref');

  // Safe date formatting helper
  const formatDateTime = (dateTime: string | null | undefined): string => {
    if (!dateTime) return 'Not specified';
    try {
      const date = new Date(dateTime);
      if (isNaN(date.getTime())) return 'Invalid date';
      return format(date, "PPP 'at' p");
    } catch (error) {
      console.error('Date formatting error:', error, 'for value:', dateTime);
      return 'Invalid date';
    }
  };

  useEffect(() => {
    const fetchBookingData = async () => {
      if (!sessionId) return;
      
      const { data } = await supabase
        .from('payments')
        .select(`
          booking_id,
          payment_intent,
          bookings (
            id,
            reference_code,
            client_name,
            client_email,
            client_phone,
            guest_name,
            guest_phone,
            guest_country,
            guest_billing_address,
            guest_company_name,
            car_model,
            car_plate,
            delivery_datetime,
            collection_datetime,
            delivery_location,
            collection_location,
            delivery_info,
            collection_info,
            amount_total,
            amount_paid,
            currency,
            confirmation_pdf_url,
            additional_services,
            km_included,
            extra_km_cost,
            security_deposit_amount,
            billing_address,
            country,
            company_name
          )
        `)
        .eq('payment_link_id', sessionId)
        .single();
      
      if (data?.bookings) {
        console.log('Booking loaded:', {
          reference: data.bookings.reference_code,
          payment_intent: data.payment_intent,
          delivery_datetime: data.bookings.delivery_datetime,
          collection_datetime: data.bookings.collection_datetime,
          delivery_type: typeof data.bookings.delivery_datetime,
          collection_type: typeof data.bookings.collection_datetime
        });
        
        setBooking(data.bookings);
        setPaymentIntent(data.payment_intent);
        
        // Fetch access token for this booking
        const { data: tokenData, error: tokenError } = await supabase
          .from('booking_access_tokens')
          .select('token')
          .eq('booking_id', data.bookings.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        console.log('Token fetch result:', { tokenData, tokenError, bookingId: data.bookings.id });
        
        let finalToken = tokenData?.token;
        
        if (tokenData?.token) {
          setAccessToken(tokenData.token);
          console.log('Access token found:', tokenData.token);
        } else {
          // Token doesn't exist - generate one
          console.log('No token found, generating new one for booking:', data.bookings.id);
          const { data: newToken, error: generateError } = await supabase
            .rpc('generate_booking_token', { p_booking_id: data.bookings.id });
          
          if (!generateError && newToken) {
            setAccessToken(newToken);
            finalToken = newToken;
            console.log('New token generated:', newToken);
          } else {
            console.error('Failed to generate token:', generateError);
          }
        }
        
        // Fetch app settings for PDF generation
        const { data: settings } = await supabase
          .from('app_settings')
          .select('*')
          .limit(1)
          .maybeSingle();
        
        console.log('App settings fetch result:', { hasSettings: !!settings });
        
        if (settings) {
          setAppSettings(settings);
        }
        
        console.log('Final states:', { 
          hasBooking: !!data.bookings, 
          hasAccessToken: !!finalToken, 
          hasAppSettings: !!settings
        });
      }
    };
    
    fetchBookingData();
    
    // The webhook will handle the actual payment status update
    const paymentStatus = searchParams.get('status');
    
    if (paymentStatus === 'success') {
      setStatus('success');
    } else if (paymentStatus === 'failed') {
      setStatus('failed');
    } else {
      // Default to processing, webhook will update the payment status
      setTimeout(() => setStatus('success'), 2000);
    }
  }, [searchParams, sessionId]);

  const handlePrint = async () => {
    if (!booking || !appSettings) return;
    
    // Generate PDF blob and open in new window for printing
    const { pdf } = await import('@react-pdf/renderer');
    const { ClientBookingPDF } = await import('@/components/ClientBookingPDF');
    
    const blob = await pdf(<ClientBookingPDF booking={booking} appSettings={appSettings} />).toBlob();
    const url = URL.createObjectURL(blob);
    
    // Open in new window which will trigger print dialog
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
        // Clean up the blob URL after a delay
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      };
    }
  };

  const handleDownloadPDF = () => {
    if (booking?.confirmation_pdf_url) {
      window.open(booking.confirmation_pdf_url, '_blank');
    }
  };

  const handlePreviewEmail = () => {
    const previewUrl = `/email-preview?session_id=${sessionId}&booking_ref=${bookingRef}`;
    window.open(previewUrl, '_blank');
  };

  return (
    <>
      {/* Print-optimized view */}
      <div className="print:block hidden">
        <style>{`
          @media print {
            @page { 
              size: A4; 
              margin: 2cm; 
            }
            body { 
              font-size: 12pt; 
            }
            .no-print { 
              display: none !important; 
            }
          }
        `}</style>
        
        {booking && (
          <div className="space-y-6">
            <div className="text-center border-b pb-4">
              <h1 className="text-2xl font-bold">Booking Confirmation</h1>
              <p className="text-lg mt-2">{booking.reference_code}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {format(new Date(), "PPP 'at' p")}
              </p>
            </div>
            
            {/* Client Information */}
            <div>
              <h2 className="font-bold text-lg mb-2 border-b pb-1">Client Information</h2>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><strong>Name:</strong></div>
                <div>{booking.client_name}</div>
                <div><strong>Email:</strong></div>
                <div>{booking.client_email}</div>
                {booking.client_phone && (
                  <>
                    <div><strong>Phone:</strong></div>
                    <div>{booking.client_phone}</div>
                  </>
                )}
              </div>
            </div>
            
            {/* Guest Information (if present) */}
            {booking.guest_name && (
              <div>
                <h2 className="font-bold text-lg mb-2 border-b pb-1">Guest Information</h2>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><strong>Name:</strong></div>
                  <div>{booking.guest_name}</div>
                  {booking.guest_country && (
                    <>
                      <div><strong>Country:</strong></div>
                      <div>{booking.guest_country}</div>
                    </>
                  )}
                  {booking.guest_phone && (
                    <>
                      <div><strong>Phone:</strong></div>
                      <div>{booking.guest_phone}</div>
                    </>
                  )}
                  {booking.guest_billing_address && (
                    <>
                      <div><strong>Billing Address:</strong></div>
                      <div>{booking.guest_billing_address}</div>
                    </>
                  )}
                  {booking.guest_company_name && (
                    <>
                      <div><strong>Company:</strong></div>
                      <div>{booking.guest_company_name}</div>
                    </>
                  )}
                </div>
              </div>
            )}
            
            {/* Rental Details */}
            <div>
              <h2 className="font-bold text-lg mb-2 border-b pb-1">Rental Details</h2>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><strong>Vehicle:</strong></div>
                <div>{booking.car_model} ({booking.car_plate})</div>
                <div><strong>Delivery:</strong></div>
                <div>
                  {formatDateTime(booking.delivery_datetime)}
                  <br />
                  {booking.delivery_location}
                </div>
                <div><strong>Collection:</strong></div>
                <div>
                  {formatDateTime(booking.collection_datetime)}
                  <br />
                  {booking.collection_location}
                </div>
              </div>
            </div>
            
            {/* Payment Summary */}
            <div>
              <h2 className="font-bold text-lg mb-2 border-b pb-1">Payment Summary</h2>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><strong>Total Amount:</strong></div>
                <div>{booking.currency} {booking.amount_total.toFixed(2)}</div>
                <div><strong>Amount Paid:</strong></div>
                <div className="text-green-600 font-semibold">
                  {booking.currency} {booking.amount_paid.toFixed(2)}
                </div>
                <div><strong>Remaining:</strong></div>
                <div className={booking.amount_total - booking.amount_paid > 0 ? 'text-orange-600 font-semibold' : 'text-green-600'}>
                  {booking.currency} {(booking.amount_total - booking.amount_paid).toFixed(2)}
                </div>
              </div>
            </div>

            <div className="text-center text-sm text-muted-foreground pt-4 border-t">
              <p>Thank you for your booking!</p>
              <p className="mt-1">For any questions, please contact us with your booking reference.</p>
            </div>
          </div>
        )}
      </div>

      {/* Screen view */}
      <div className="min-h-screen bg-background flex items-center justify-center p-4 no-print">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-center">
              {status === 'processing' && (paymentIntent === 'security_deposit' ? 'Processing Authorization...' : 'Processing Payment...')}
              {status === 'success' && (paymentIntent === 'security_deposit' ? 'Authorization Successful!' : 'Payment Successful!')}
              {status === 'failed' && (paymentIntent === 'security_deposit' ? 'Authorization Failed' : 'Payment Failed')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center justify-center gap-3">
              {status === 'success' && (
                <img src={appSettings?.logo_url || '/king-rent-logo.png'} alt="King Rent Logo" className="h-16 w-auto mx-auto object-contain" />
              )}
              {status === 'processing' && (
                <Loader2 className="h-16 w-16 animate-spin text-king-gold" />
              )}
              {status === 'success' && (
                <CheckCircle className="h-16 w-16 text-king-gold" />
              )}
              {status === 'failed' && (
                <XCircle className="h-16 w-16 text-destructive" />
              )}
            </div>

            {status === 'success' && (
              <Alert>
                <AlertDescription className="text-center">
                  {paymentIntent === 'security_deposit' ? (
                    <>
                      Your security deposit has been authorized successfully.
                      {bookingRef && ` Booking reference: ${bookingRef}`}
                      <br />
                      This is a hold on your card, not a charge. The authorization will be released after your rental period unless damages occur.
                      <br />
                      You can access your booking portal to view all details.
                    </>
                  ) : (
                    <>
                      Your payment has been processed successfully. 
                      {bookingRef && ` Booking reference: ${bookingRef}`}
                      <br />
                      You can now access your booking portal to view details, upload documents, and track your rental.
                      <br />
                      <span className="text-xs text-muted-foreground">
                        A confirmation email has been sent to your email address.
                      </span>
                    </>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {status === 'failed' && (
              <Alert variant="destructive">
                <AlertDescription className="text-center">
                  Your payment could not be processed. Please try again or contact support.
                </AlertDescription>
              </Alert>
            )}

            {status === 'processing' && (
              <Alert>
                <AlertDescription className="text-center">
                  Please wait while we confirm your payment...
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-3">
              {status === 'success' && booking && (
                <>
                  {/* PRIMARY ACTIONS - Full Width - ALWAYS SHOW PORTAL BUTTON */}
                  <div className="space-y-3">
                    {accessToken ? (
                      <Button 
                        onClick={() => navigate(`/client-portal/${accessToken}`)}
                        className="w-full justify-center gap-2"
                        size="lg"
                      >
                        <Link2 className="h-4 w-4" />
                        View Your Booking Portal
                      </Button>
                    ) : (
                      <div className="text-sm text-yellow-600 text-center py-2">
                        Portal link is being generated...
                      </div>
                    )}
                    
                    {/* Only show PDF download for non-security-deposit payments */}
                    {paymentIntent !== 'security_deposit' && (
                      <>
                        {booking.confirmation_pdf_url ? (
                          <Button 
                            variant="outline"
                            onClick={handleDownloadPDF}
                            className="w-full justify-center gap-2"
                            size="lg"
                          >
                            <Download className="h-4 w-4" />
                            Download Booking PDF
                          </Button>
                        ) : appSettings ? (
                          <PDFDownloadLink
                            document={<ClientBookingPDF booking={booking} appSettings={appSettings} />}
                            fileName={`booking-${booking.reference_code}.pdf`}
                            className="w-full"
                          >
                            {({ loading }) => (
                              <Button 
                                variant="outline"
                                className="w-full justify-center gap-2"
                                size="lg"
                                disabled={loading}
                              >
                                <Download className="h-4 w-4" />
                                {loading ? 'Preparing PDF...' : 'Download Booking PDF'}
                              </Button>
                            )}
                          </PDFDownloadLink>
                        ) : (
                          <Button 
                            variant="outline"
                            className="w-full justify-center gap-2"
                            size="lg"
                            disabled
                          >
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Preparing PDF...
                          </Button>
                        )}
                        
                        {/* Print Button - Full Width */}
                        <Button 
                          variant="outline"
                          onClick={handlePrint}
                          className="w-full justify-center gap-2"
                          size="lg"
                          disabled={!appSettings}
                        >
                          {appSettings ? (
                            <>
                              <Printer className="h-4 w-4" />
                              Print
                            </>
                          ) : (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading...
                            </>
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                  
                  {/* SECONDARY ACTIONS - Only Signed PDF if available */}
                  {paymentIntent !== 'security_deposit' && booking.confirmation_pdf_url && (
                    <div className="pt-2">
                      <Button 
                        variant="outline"
                        onClick={handleDownloadPDF}
                        className="w-full justify-center gap-2"
                        size="default"
                      >
                        <Download className="h-4 w-4" />
                        Signed PDF
                      </Button>
                    </div>
                  )}
                </>
              )}
              
              {status === 'failed' && (
                <>
                  <Button variant="outline" onClick={() => navigate(-1)}>
                    Go Back
                  </Button>
                  <Button onClick={() => window.location.reload()}>
                    Try Again
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}