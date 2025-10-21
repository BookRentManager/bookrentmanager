import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, FileText, CreditCard, Info, Download, Printer, ShoppingBag } from 'lucide-react';
import { BookingFormSummary } from '@/components/booking-form/BookingFormSummary';
import { ClientDocumentUpload } from '@/components/booking-form/ClientDocumentUpload';
import { ClientDocumentView } from '@/components/booking-form/ClientDocumentView';
import { ClientPaymentPanel } from '@/components/booking-form/ClientPaymentPanel';
import { ClientBookingOverview } from '@/components/booking-form/ClientBookingOverview';
import { ContractDocumentUpload } from '@/components/booking-form/ContractDocumentUpload';
import { ContractDocumentView } from '@/components/booking-form/ContractDocumentView';
import { ExtrasDocumentUpload } from '@/components/booking-form/ExtrasDocumentUpload';
import { ExtrasDocumentView } from '@/components/booking-form/ExtrasDocumentView';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { ClientBookingPDF } from '@/components/ClientBookingPDF';
import crownIcon from '@/assets/crown.png';

interface PortalData {
  booking: any;
  documents: any[];
  payments: any[];
  security_deposits: any[];
  terms_and_conditions: any;
  payment_methods: any[];
}

export default function ClientPortal() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [portalData, setPortalData] = useState<PortalData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      navigate('/');
      return;
    }
    fetchPortalData();
  }, [token]);

  const fetchPortalData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase.functions.invoke('get-client-portal-data', {
        body: { token },
      });

      if (fetchError) throw fetchError;

      setPortalData(data);
    } catch (err: any) {
      console.error('Error fetching portal data:', err);
      setError(err.message || 'Failed to load booking information');
      toast({
        title: 'Error',
        description: err.message || 'Failed to load booking information',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePrintPDF = async () => {
    if (!portalData?.booking) return;
    
    try {
      toast({
        title: 'Preparing PDF...',
        description: 'Please wait while we generate your booking PDF',
      });

      const { data: settings } = await supabase
        .from('app_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      
      // Generate PDF
      const { pdf } = await import('@react-pdf/renderer');
      
      const blob = await pdf(
        <ClientBookingPDF booking={portalData.booking} appSettings={settings as any} />
      ).toBlob();
      
      const url = URL.createObjectURL(blob);
      
      // Direct download instead of print to avoid popup blocker
      const link = document.createElement('a');
      link.href = url;
      link.download = `booking-${portalData.booking.reference_code}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: 'PDF Downloaded',
        description: 'You can now print it from your downloads folder',
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate PDF. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !portalData) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error || 'Booking not found'}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const { booking, documents, payments, security_deposits } = portalData;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-gradient-king">
        <div className="max-w-4xl mx-auto p-4 md:p-6">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
            <div className="flex-1 w-full sm:w-auto">
              <div className="flex items-center gap-2 mb-2">
                <img src={crownIcon} alt="Crown" className="h-8 w-auto" />
                <h1 className="text-xl md:text-2xl font-playfair font-bold text-king-gold">Your Booking Portal</h1>
              </div>
              <p className="text-sm md:text-base text-king-gold/80">
                Reference: <span className="font-mono font-semibold text-king-gold">{booking.reference_code}</span>
              </p>
            </div>
            <Badge 
              variant={booking.status === 'confirmed' ? 'default' : 'secondary'} 
              className={booking.status === 'confirmed' ? 'bg-king-gold text-king-black border-king-gold' : 'capitalize self-start sm:self-auto'}
            >
              {booking.status}
            </Badge>
          </div>
          
          {/* PDF Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <PDFDownloadLink
              document={
                <ClientBookingPDF 
                  booking={booking} 
                  appSettings={{} as any} 
                />
              }
              fileName={`booking-${booking.reference_code}.pdf`}
            >
              {({ loading }) => (
                <Button variant="outline" size="default" disabled={loading} className="w-full sm:w-auto h-12 sm:h-10">
                  <Download className="h-4 w-4 mr-2" />
                  {loading ? 'Preparing...' : 'Download PDF'}
                </Button>
              )}
            </PDFDownloadLink>
            
            <Button variant="outline" size="default" onClick={handlePrintPDF} className="w-full sm:w-auto h-12 sm:h-10">
              <Printer className="h-4 w-4 mr-2" />
              Print PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 gap-1 h-auto p-1">
            <TabsTrigger value="overview" className="flex flex-col gap-1 px-2 py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Info className="h-4 w-4 md:h-5 md:w-5" />
              <span className="text-[10px] md:text-sm">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex flex-col gap-1 px-2 py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground relative">
              <FileText className="h-4 w-4 md:h-5 md:w-5" />
              <span className="text-[10px] md:text-sm">Docs</span>
              {booking.documents_required && (
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[8px]">
                  !
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex flex-col gap-1 px-2 py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <CreditCard className="h-4 w-4 md:h-5 md:w-5" />
              <span className="text-[10px] md:text-sm">Pay</span>
            </TabsTrigger>
            <TabsTrigger value="contract" className="flex flex-col gap-1 px-2 py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <FileText className="h-4 w-4 md:h-5 md:w-5" />
              <span className="text-[10px] md:text-sm">Contract</span>
            </TabsTrigger>
            <TabsTrigger value="extras" className="flex flex-col gap-1 px-2 py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <ShoppingBag className="h-4 w-4 md:h-5 md:w-5" />
              <span className="text-[10px] md:text-sm">Extras</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <ClientBookingOverview booking={booking} />
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-6 max-w-4xl mx-auto p-4 md:p-6">
            {booking.documents_required && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Documents Required:</strong>{' '}
                  {booking.documents_required_note || 'Please upload the required documents for your booking.'}
                </AlertDescription>
              </Alert>
            )}

            <ClientDocumentUpload
              token={token!}
              bookingId={booking.id}
              clientName={booking.client_name}
              onUploadComplete={fetchPortalData}
            />

            <div>
              <h3 className="text-lg font-semibold mb-4">Uploaded Documents</h3>
              <ClientDocumentView
                documents={documents.filter(doc => 
                  ['id_card', 'drivers_license', 'proof_of_address', 'insurance', 'other'].includes(doc.document_type)
                )}
                token={token!}
                onDocumentDeleted={fetchPortalData}
              />
            </div>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-6">
            <ClientPaymentPanel
              booking={booking}
              payments={payments}
              securityDeposits={security_deposits}
            />
          </TabsContent>

          {/* Contract Tab */}
          <TabsContent value="contract" className="space-y-6 max-w-4xl mx-auto p-4 md:p-6">
            <ContractDocumentUpload
              bookingToken={token!}
              bookingId={booking.id}
            />

            <div>
              <h3 className="text-lg font-semibold mb-4">Uploaded Contract Documents</h3>
              <ContractDocumentView
                documents={documents.filter(d => 
                  ['rental_contract', 'car_condition_photo', 'car_condition_video'].includes(d.document_type)
                )}
                bookingToken={token!}
                bookingId={booking.id}
              />
            </div>
          </TabsContent>

          {/* Extras Tab */}
          <TabsContent value="extras" className="space-y-6 max-w-4xl mx-auto p-4 md:p-6">
            <ExtrasDocumentUpload
              bookingToken={token!}
              bookingId={booking.id}
            />

            <div>
              <h3 className="text-lg font-semibold mb-4">Extra Costs</h3>
              <ExtrasDocumentView
                documents={documents.filter(d => 
                  ['extra_km_invoice', 'fuel_balance_invoice', 'damage_invoice', 'fine_document'].includes(d.document_type)
                )}
                bookingToken={token!}
                bookingId={booking.id}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
