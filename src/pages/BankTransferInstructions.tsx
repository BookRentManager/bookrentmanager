import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, Download, Printer, ExternalLink, Copy, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { BankTransferProofUpload } from '@/components/BankTransferProofUpload';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { ClientBookingPDF } from '@/components/ClientBookingPDF';

export default function BankTransferInstructions() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const paymentId = searchParams.get('payment_id');
  
  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState<any>(null);
  const [booking, setBooking] = useState<any>(null);
  const [appSettings, setAppSettings] = useState<any>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (paymentId) {
      fetchPaymentDetails();
    }
  }, [paymentId]);

  const fetchPaymentDetails = async () => {
    try {
      setLoading(true);

      // Fetch payment
      const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (paymentError) throw paymentError;
      setPayment(paymentData);

      // Fetch booking
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', paymentData.booking_id)
        .single();

      if (bookingError) throw bookingError;
      setBooking(bookingData);

      // Fetch app settings
      const { data: settingsData } = await supabase
        .from('app_settings')
        .select('*')
        .limit(1)
        .single();

      setAppSettings(settingsData);
    } catch (error) {
      console.error('Error fetching payment details:', error);
      toast.error('Failed to load payment details');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => setCopied(null), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="container max-w-4xl mx-auto py-8">
        <Card>
          <CardContent className="py-8">
            <div className="text-center">Loading payment details...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!payment || !booking) {
    return (
      <div className="container max-w-4xl mx-auto py-8">
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-destructive">Payment not found</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get booking access token from URL if available
  const token = searchParams.get('token');

  return (
    <div className="container max-w-4xl mx-auto py-8 print:py-4">
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div>
              <CardTitle className="text-2xl">Bank Transfer Payment Selected</CardTitle>
              <CardDescription className="text-base">
                Booking Reference: <span className="font-semibold">{booking.reference_code}</span>
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <Alert>
            <AlertDescription className="text-base">
              <strong>Important:</strong> Please transfer exactly{' '}
              <span className="font-bold text-lg">
                {payment.currency} {payment.total_amount?.toFixed(2) || payment.amount.toFixed(2)}
              </span>{' '}
              to complete your booking payment.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Bank Account Details</h3>
            <div className="grid gap-3 bg-muted/50 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Account Holder:</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{appSettings?.bank_account_holder || 'KingRent Sàrl'}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(appSettings?.bank_account_holder || 'KingRent Sàrl', 'Account Holder')}
                  >
                    {copied === 'Account Holder' ? <CheckCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">IBAN:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium">{appSettings?.bank_account_iban || 'CH00 0000 0000 0000 0000 0'}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(appSettings?.bank_account_iban || '', 'IBAN')}
                  >
                    {copied === 'IBAN' ? <CheckCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">BIC/SWIFT:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium">{appSettings?.bank_account_bic || 'XXXXCHZZXXX'}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(appSettings?.bank_account_bic || '', 'BIC/SWIFT')}
                  >
                    {copied === 'BIC/SWIFT' ? <CheckCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Bank:</span>
                <span className="font-medium">{appSettings?.bank_account_bank_name || 'PostFinance'}</span>
              </div>

              <Separator />

              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-semibold">Reference Number:</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg">{booking.reference_code}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(booking.reference_code, 'Reference Number')}
                  >
                    {copied === 'Reference Number' ? <CheckCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-semibold">Amount:</span>
                <span className="font-bold text-lg">
                  {payment.currency} {payment.total_amount?.toFixed(2) || payment.amount.toFixed(2)}
                </span>
              </div>
            </div>

            <Alert variant="default">
              <AlertDescription>
                {appSettings?.bank_transfer_instructions || 
                  'Please include the booking reference number in your transfer description. Payment processing may take 2-5 business days.'}
              </AlertDescription>
            </Alert>
          </div>

          <Separator />

          <div className="space-y-4 print:hidden">
            <h3 className="text-lg font-semibold">Upload Payment Proof (Optional)</h3>
            <p className="text-sm text-muted-foreground">
              You can upload your payment confirmation now or later via the client portal. 
              This helps us process your payment faster.
            </p>
            <BankTransferProofUpload paymentId={payment.id} onUploadSuccess={fetchPaymentDetails} />
            
            {payment.proof_url && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Payment proof uploaded successfully</span>
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-wrap gap-3 print:hidden">
          {token && (
            <Button onClick={() => navigate(`/client-portal/${token}`)} variant="default">
              <ExternalLink className="h-4 w-4 mr-2" />
              Go to Client Portal
            </Button>
          )}
          
          {booking && (
            <PDFDownloadLink
              document={<ClientBookingPDF booking={booking} appSettings={appSettings} />}
              fileName={`booking-${booking.reference_code}.pdf`}
            >
              {({ loading }) => (
                <Button variant="outline" disabled={loading}>
                  <Download className="h-4 w-4 mr-2" />
                  {loading ? 'Generating PDF...' : 'Download Booking PDF'}
                </Button>
              )}
            </PDFDownloadLink>
          )}
          
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print Instructions
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
