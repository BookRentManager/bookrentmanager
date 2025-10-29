import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Truck, Package } from 'lucide-react';
import { ContractUpload } from '@/components/driver/ContractUpload';
import { PhotoGalleryUpload } from '@/components/driver/PhotoGalleryUpload';
import { format } from 'date-fns';

interface DriverPortalData {
  booking: {
    id: string;
    reference_code: string;
    car_model: string;
    car_plate: string;
    delivery_datetime: string;
    collection_datetime: string;
    delivery_location: string;
    collection_location: string;
  };
  documents: any[];
  permission_level: string;
  token: {
    expires_at: string;
    access_count: number;
  };
}

export default function DriverPortal() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [portalData, setPortalData] = useState<DriverPortalData | null>(null);
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

      const { data, error: fetchError } = await supabase.functions.invoke('get-driver-portal-data', {
        body: { token },
      });

      if (fetchError) throw fetchError;

      // Verify permission level
      if (data.permission_level !== 'delivery_driver_edit') {
        throw new Error('Invalid access token for driver portal');
      }

      setPortalData(data);
    } catch (err: any) {
      console.error('Error fetching driver portal data:', err);
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

  const { booking, documents } = portalData;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-accent/10">
      {/* Header */}
      <div className="border-b bg-gradient-king shadow-md">
        <div className="max-w-4xl mx-auto p-4 md:p-6">
          <div className="flex items-center gap-4">
            <img 
              src="/king-rent-logo.png" 
              alt="King Rent Logo" 
              className="h-16 md:h-20 w-auto flex-shrink-0" 
            />
            <div className="flex-1">
              <h1 className="text-xl md:text-2xl font-playfair font-bold text-king-gold">
                Delivery Driver Portal
              </h1>
              <p className="text-sm md:text-base text-king-gold/80">
                Booking: <span className="font-mono font-semibold">{booking.reference_code}</span>
              </p>
            </div>
          </div>
          
          {/* Booking Info */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-king-gold/90">
            <div>
              <span className="font-medium">Vehicle:</span> {booking.car_model} ({booking.car_plate})
            </div>
            <div>
              <span className="font-medium">Delivery:</span> {format(new Date(booking.delivery_datetime), "PPp")}
            </div>
            <div>
              <span className="font-medium">Collection:</span> {format(new Date(booking.collection_datetime), "PPp")}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <Alert className="mb-6 border-blue-500 bg-blue-50 dark:bg-blue-950/20">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Driver Access</strong> - Upload delivery/collection contracts and car condition photos. No client personal or payment information is visible.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="delivery" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 h-auto p-2 bg-gradient-to-br from-king-black/5 to-king-gold/5 rounded-xl border-2 border-king-gold/20">
            <TabsTrigger 
              value="delivery" 
              className="flex flex-col gap-1.5 px-3 py-4 rounded-lg transition-all duration-300
                         data-[state=active]:bg-gradient-king data-[state=active]:text-king-gold 
                         data-[state=active]:shadow-lg data-[state=active]:shadow-king-gold/30 data-[state=active]:scale-105
                         data-[state=inactive]:hover:bg-king-gold/5
                         data-[state=inactive]:text-muted-foreground"
            >
              <Truck className="h-5 w-5 md:h-6 md:w-6" />
              <span className="text-sm md:text-base font-semibold">Delivery</span>
            </TabsTrigger>
            <TabsTrigger 
              value="collection" 
              className="flex flex-col gap-1.5 px-3 py-4 rounded-lg transition-all duration-300
                         data-[state=active]:bg-gradient-king data-[state=active]:text-king-gold 
                         data-[state=active]:shadow-lg data-[state=active]:shadow-king-gold/30 data-[state=active]:scale-105
                         data-[state=inactive]:hover:bg-king-gold/5
                         data-[state=inactive]:text-muted-foreground"
            >
              <Package className="h-5 w-5 md:h-6 md:w-6" />
              <span className="text-sm md:text-base font-semibold">Collection</span>
            </TabsTrigger>
          </TabsList>

          {/* Delivery Tab */}
          <TabsContent value="delivery" className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Delivery Contract</CardTitle>
                <CardDescription>Upload the signed rental contract at delivery (PDF or photo)</CardDescription>
              </CardHeader>
              <CardContent>
                <ContractUpload
                  bookingId={booking.id}
                  token={token!}
                  documentType="rental_contract_delivery"
                  existingContract={documents.find(d => d.document_type === 'rental_contract_delivery')}
                  onUploadSuccess={fetchPortalData}
                />
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Car Condition Photos - Before Delivery</CardTitle>
                <CardDescription>Upload up to 10 photos of the car condition before delivery</CardDescription>
              </CardHeader>
              <CardContent>
                <PhotoGalleryUpload
                  bookingId={booking.id}
                  token={token!}
                  documentType="car_condition_delivery_photo"
                  existingPhotos={documents.filter(d => d.document_type === 'car_condition_delivery_photo')}
                  onUploadSuccess={fetchPortalData}
                  maxPhotos={10}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Collection Tab */}
          <TabsContent value="collection" className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Collection Contract</CardTitle>
                <CardDescription>Upload the signed rental contract at collection (PDF or photo)</CardDescription>
              </CardHeader>
              <CardContent>
                <ContractUpload
                  bookingId={booking.id}
                  token={token!}
                  documentType="rental_contract_collection"
                  existingContract={documents.find(d => d.document_type === 'rental_contract_collection')}
                  onUploadSuccess={fetchPortalData}
                />
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Car Condition Photos - After Collection</CardTitle>
                <CardDescription>Upload up to 10 photos of the car condition after collection</CardDescription>
              </CardHeader>
              <CardContent>
                <PhotoGalleryUpload
                  bookingId={booking.id}
                  token={token!}
                  documentType="car_condition_collection_photo"
                  existingPhotos={documents.filter(d => d.document_type === 'car_condition_collection_photo')}
                  onUploadSuccess={fetchPortalData}
                  maxPhotos={10}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
