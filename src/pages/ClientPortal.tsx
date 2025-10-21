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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { ClientBookingPDF } from '@/components/ClientBookingPDF';

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
        title: 'Generating PDF...',
        description: 'Preparing your document for printing',
      });

      const { data: settings } = await supabase
        .from('app_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      
      // Generate PDF using the same method as download - settings are optional
      const { pdf } = await import('@react-pdf/renderer');
      
      const blob = await pdf(
        <ClientBookingPDF booking={portalData.booking} appSettings={settings as any} />
      ).toBlob();
      
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, '_blank');
      
      if (printWindow) {
        // Wait for PDF to load then trigger print
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
          }, 500);
        };
        
        // Clean up URL after 10 seconds
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        
        toast({
          title: 'PDF Ready',
          description: 'Print dialog opened in new tab',
        });
      } else {
        toast({
          title: 'Popup Blocked',
          description: 'Please allow popups to print, or use the Download button instead',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error generating print PDF:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate PDF for printing. Please try the download button instead.',
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
      <div className="border-b bg-card">
        <div className="max-w-4xl mx-auto p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold mb-2">Your Booking Portal</h1>
              <p className="text-muted-foreground">
                Reference: <span className="font-mono font-semibold">{booking.reference_code}</span>
              </p>
            </div>
            <Badge variant={booking.status === 'confirmed' ? 'default' : 'secondary'} className="capitalize">
              {booking.status}
            </Badge>
          </div>
          
          {/* PDF Action Buttons */}
          <div className="flex flex-wrap gap-2 mt-4">
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
                <Button variant="outline" size="sm" disabled={loading}>
                  <Download className="h-4 w-4 mr-2" />
                  {loading ? 'Preparing...' : 'Download PDF'}
                </Button>
              )}
            </PDFDownloadLink>
            
            <Button variant="outline" size="sm" onClick={handlePrintPDF}>
              <Printer className="h-4 w-4 mr-2" />
              Print PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 md:grid-cols-5">
            <TabsTrigger value="overview" className="gap-2">
              <Info className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Documents</span>
              {booking.documents_required && (
                <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 flex items-center justify-center">
                  !
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-2">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Payments</span>
            </TabsTrigger>
            <TabsTrigger value="contract" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Contract</span>
            </TabsTrigger>
            <TabsTrigger value="extras" className="gap-2">
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">Extras</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <ClientBookingOverview booking={booking} />
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-6">
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
                documents={documents}
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
          <TabsContent value="contract" className="space-y-6">
            <Card className="p-8">
              <div className="text-center space-y-6">
                <div className="flex justify-center">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-semibold">Rental Contract</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Your rental contract will be available here. You'll be able to view, download, and digitally sign your agreement.
                  </p>
                </div>
                <Badge variant="secondary" className="text-sm">Coming Soon</Badge>
              </div>
            </Card>
          </TabsContent>

          {/* Extras Tab */}
          <TabsContent value="extras" className="space-y-6">
            <Card className="p-8">
              <div className="text-center space-y-6">
                <div className="flex justify-center">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                    <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-semibold">Additional Services & Extras</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Enhance your rental experience with optional extras like GPS, child seats, additional insurance, and more.
                  </p>
                </div>
                <Badge variant="secondary" className="text-sm">Coming Soon</Badge>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
