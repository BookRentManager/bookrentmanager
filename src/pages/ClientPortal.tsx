import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, FileText, CreditCard, Info } from 'lucide-react';
import { BookingFormSummary } from '@/components/booking-form/BookingFormSummary';
import { ClientDocumentUpload } from '@/components/booking-form/ClientDocumentUpload';
import { ClientDocumentView } from '@/components/booking-form/ClientDocumentView';
import { ClientPaymentPanel } from '@/components/booking-form/ClientPaymentPanel';
import { ClientBookingOverview } from '@/components/booking-form/ClientBookingOverview';
import { Badge } from '@/components/ui/badge';

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
            <div>
              <h1 className="text-2xl font-bold mb-2">Your Booking Portal</h1>
              <p className="text-muted-foreground">
                Reference: <span className="font-mono font-semibold">{booking.reference_code}</span>
              </p>
            </div>
            <Badge variant={booking.status === 'confirmed' ? 'default' : 'secondary'} className="capitalize">
              {booking.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
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
        </Tabs>
      </div>
    </div>
  );
}
