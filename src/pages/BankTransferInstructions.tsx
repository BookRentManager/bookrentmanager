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
    <div className="container max-w-4xl mx-auto py-8 px-4 print:py-4">
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap');
          
          .king-gradient {
            background: linear-gradient(180deg, #000000 0%, #1a1a1a 100%);
          }
          
          .king-text-gradient {
            background: linear-gradient(135deg, #C5A572 0%, #d4b582 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          
          .king-card {
            background: linear-gradient(to bottom right, #ffffff 0%, #faf8f5 100%);
            border: 1px solid rgba(197, 165, 114, 0.3);
          }
          
          .bank-detail-card {
            background: linear-gradient(135deg, #fffbf0 0%, #fff9e6 100%);
            border: 2px solid #C5A572;
          }
          
          @media (max-width: 640px) {
            .copy-btn {
              min-width: 44px !important;
              min-height: 44px !important;
            }
            .action-btn {
              min-height: 48px !important;
              font-size: 15px !important;
            }
          }
        `}
      </style>
      
      <Card className="shadow-2xl border-king-gold/30">
        <CardHeader className="king-gradient space-y-4 pb-6 -m-[1px] rounded-t-lg border-b-2 border-king-gold">
          <div className="text-center space-y-3">
            <img 
              src="/bookrentmanager-logo-new.webp" 
              alt="King Rent"
              width="475"
              height="180"
              className="h-16 md:h-20 lg:h-16 mx-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className="flex items-center justify-center gap-3">
              <CheckCircle className="h-8 w-8 md:h-10 md:w-10 text-king-gold drop-shadow-lg" />
            </div>
            <CardTitle className="text-2xl md:text-3xl lg:text-2xl xl:text-3xl font-playfair text-king-gold">
              Bank Transfer Payment
            </CardTitle>
            <p className="text-king-gold/80 text-sm italic">Experience Luxury on Wheels</p>
            <CardDescription className="text-base lg:text-base mt-1 text-king-gold/90">
              Reference: <span className="font-mono font-bold text-king-gold">{booking.reference_code}</span>
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <Alert className="border-king-gold bg-gradient-to-r from-king-gold/10 to-king-gold/5">
            <AlertDescription className="text-base lg:text-base">
              <strong className="text-king-gold-dark">Important:</strong> Please transfer exactly{' '}
              <span className="font-bold text-xl md:text-2xl lg:text-xl text-king-gold-dark block mt-2">
                {payment.currency} {payment.total_amount?.toFixed(2) || payment.amount.toFixed(2)}
              </span>
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <h3 className="text-xl lg:text-xl font-semibold font-playfair text-king-gold-dark">
              Bank Account Details
            </h3>
            <div className="bank-detail-card p-5 md:p-6 rounded-lg space-y-4 shadow-lg">
              <div className="grid gap-4">
                <div className="flex flex-col gap-2">
                  <span className="text-base lg:text-base font-semibold text-muted-foreground">
                    Account Holder
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-base lg:text-base flex-1 break-words">
                      {appSettings?.bank_account_holder || 'KingRent Sàrl'}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="copy-btn flex-shrink-0 border-king-gold hover:bg-king-gold hover:text-white"
                      onClick={() => copyToClipboard(appSettings?.bank_account_holder || 'KingRent Sàrl', 'Account Holder')}
                    >
                      {copied === 'Account Holder' ? <CheckCheck className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                    </Button>
                  </div>
                </div>

                <Separator className="bg-king-gold/30" />

                <div className="flex flex-col gap-2">
                  <span className="text-base lg:text-base font-semibold text-muted-foreground">
                    IBAN
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-medium text-sm lg:text-sm flex-1 break-all">
                      {appSettings?.bank_account_iban || 'CH00 0000 0000 0000 0000 0'}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="copy-btn flex-shrink-0 border-king-gold hover:bg-king-gold hover:text-white"
                      onClick={() => copyToClipboard(appSettings?.bank_account_iban || '', 'IBAN')}
                    >
                      {copied === 'IBAN' ? <CheckCheck className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                    </Button>
                  </div>
                </div>

                <Separator className="bg-king-gold/30" />

                <div className="flex flex-col gap-2">
                  <span className="text-base lg:text-base font-semibold text-muted-foreground">
                    BIC/SWIFT
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-medium text-sm lg:text-sm flex-1 break-all">
                      {appSettings?.bank_account_bic || 'XXXXCHZZXXX'}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="copy-btn flex-shrink-0 border-king-gold hover:bg-king-gold hover:text-white"
                      onClick={() => copyToClipboard(appSettings?.bank_account_bic || '', 'BIC/SWIFT')}
                    >
                      {copied === 'BIC/SWIFT' ? <CheckCheck className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                    </Button>
                  </div>
                </div>

                <Separator className="bg-king-gold/30" />

                <div className="flex flex-col gap-2">
                  <span className="text-base lg:text-base font-semibold text-muted-foreground">
                    Bank Name
                  </span>
                  <span className="font-medium text-base lg:text-base">
                    {appSettings?.bank_account_bank_name || 'PostFinance'}
                  </span>
                </div>

                <Separator className="bg-king-gold" />

                <div className="flex flex-col gap-2 bg-king-gold/10 p-4 rounded-md">
                  <span className="text-base lg:text-base font-bold text-king-gold-dark">
                    Payment Reference
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-lg lg:text-lg flex-1 break-all text-king-gold-dark">
                      {booking.reference_code}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="copy-btn flex-shrink-0 border-king-gold bg-king-gold text-white hover:bg-king-gold-dark"
                      onClick={() => copyToClipboard(booking.reference_code, 'Reference Number')}
                    >
                      {copied === 'Reference Number' ? <CheckCheck className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-2 bg-gradient-to-r from-king-black to-king-black/90 p-4 rounded-md text-white">
                  <span className="text-base lg:text-base font-semibold text-king-gold">
                    Amount to Transfer
                  </span>
                  <span className="font-bold text-2xl lg:text-2xl text-king-gold">
                    {payment.currency} {payment.total_amount?.toFixed(2) || payment.amount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <Alert className="border-orange-200 bg-orange-50">
              <AlertDescription className="text-sm lg:text-sm">
                {appSettings?.bank_transfer_instructions || 
                  '⚠️ Please include the booking reference number in your transfer description. Payment processing typically takes 2-5 business days.'}
              </AlertDescription>
            </Alert>
          </div>

          <Separator className="bg-king-gold/30" />

          <div className="space-y-4 print:hidden">
            <h3 className="text-xl lg:text-xl font-semibold font-playfair text-king-gold-dark">
              Upload Payment Proof
            </h3>
            <p className="text-sm lg:text-sm text-muted-foreground">
              Upload your payment confirmation to help us process your payment faster. You can also do this later via the client portal.
            </p>
            <BankTransferProofUpload paymentId={payment.id} onUploadSuccess={fetchPaymentDetails} />
            
            {payment.proof_url && (
              <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-md">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium text-sm lg:text-sm">Payment proof uploaded successfully</span>
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 pt-6">
          <Separator className="bg-king-gold/30 mb-4" />
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full print:hidden">
            {token && (
              <Button 
                onClick={() => navigate(`/client-portal/${token}`)} 
                variant="king" 
                className="action-btn w-full"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Client Portal
              </Button>
            )}
            
            {booking && (
              <PDFDownloadLink
                document={<ClientBookingPDF booking={booking} appSettings={appSettings} />}
                fileName={`booking-${booking.reference_code}.pdf`}
                className="w-full"
              >
                {({ loading }) => (
                  <Button 
                    variant="outline" 
                    disabled={loading} 
                    className="action-btn w-full border-king-gold hover:bg-king-gold hover:text-white"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {loading ? 'Generating...' : 'Download PDF'}
                  </Button>
                )}
              </PDFDownloadLink>
            )}
            
            <Button 
              variant="outline" 
              onClick={handlePrint} 
              className="action-btn w-full border-king-gold hover:bg-king-gold hover:text-white"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
          
          <div className="king-gradient -mx-6 -mb-6 mt-6 px-6 py-6 rounded-b-lg border-t-2 border-king-gold text-center print:hidden">
            <p className="text-king-gold/80 text-sm italic mb-2">Your Trusted Luxury Car Rental Agency in Europe & Dubai</p>
            <p className="text-king-gold/60 text-xs">Questions? Contact us anytime</p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
