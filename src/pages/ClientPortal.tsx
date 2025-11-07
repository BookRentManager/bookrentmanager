import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, FileText, CreditCard, Info, Download, Printer, Car } from 'lucide-react';
import { BookingFormSummary } from '@/components/booking-form/BookingFormSummary';
import { ClientDocumentUpload } from '@/components/booking-form/ClientDocumentUpload';
import { ClientDocumentView } from '@/components/booking-form/ClientDocumentView';
import { ClientPaymentPanel } from '@/components/booking-form/ClientPaymentPanel';
import { ClientBookingOverview } from '@/components/booking-form/ClientBookingOverview';
import { ContractDocumentUpload } from '@/components/booking-form/ContractDocumentUpload';
import { ContractDocumentView } from '@/components/booking-form/ContractDocumentView';
import { ExtrasDocumentUpload } from '@/components/booking-form/ExtrasDocumentUpload';
import { ExtrasDocumentView } from '@/components/booking-form/ExtrasDocumentView';
import { AdditionalDriverUpload } from '@/components/booking-form/AdditionalDriverUpload';
import { RentalTab } from '@/components/rental/RentalTab';
import { RentalInformationAccordion } from '@/components/booking-form/RentalInformationAccordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { ClientBookingPDF } from '@/components/ClientBookingPDF';
import crownIcon from '@/assets/crown.png';
import { isDeliveryDriver, hasPermission } from '@/lib/permissions';

interface PortalData {
  booking: any;
  documents: any[];
  payments: any[];
  security_deposits: any[];
  terms_and_conditions: any;
  payment_methods: any[];
  app_settings?: any;
  rental_policies?: any[];
  delivery_steps?: any[];
  permission_level?: string;
}

export default function ClientPortal() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [portalData, setPortalData] = useState<PortalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

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
              <div className="flex items-center gap-4">
                <img 
                  src="/king-rent-logo.png" 
                  alt="King Rent Logo" 
                  className="h-16 md:h-20 w-auto flex-shrink-0" 
                />
                <div className="flex-1 self-center space-y-0.5">
                  <h1 className="text-xl md:text-2xl font-playfair font-bold text-king-gold leading-tight">
                    Your Booking Portal
                  </h1>
                  <p className="text-sm md:text-base text-king-gold/80 leading-tight">
                    Reference: <span className="font-mono font-semibold text-king-gold">{booking.reference_code}</span>
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 self-start sm:self-auto">
              <Badge 
                variant={booking.status === 'confirmed' ? 'default' : 'secondary'} 
                className={booking.status === 'confirmed' ? 'bg-green-600 hover:bg-green-700' : 'capitalize'}
              >
                {booking.status}
              </Badge>
              {booking.status === 'confirmed' && payments?.some((p: any) => 
                p.payment_link_status === 'pending' && p.payment_intent !== 'security_deposit'
              ) && (
                <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-200">
                  Pending Payment
                </Badge>
              )}
            </div>
          </div>
          
          {/* PDF Action Buttons - Only for clients */}
          {hasPermission(portalData.permission_level as any, 'download_docs') && (
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
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-6">
        {/* Delivery Driver Access Indicator */}
        {isDeliveryDriver(portalData.permission_level as any) && (
          <Alert className="mb-4 border-blue-500 bg-blue-50 dark:bg-blue-950/20">
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Delivery Driver Access</strong> - You're viewing this booking with limited permissions for delivery/collection purposes only.
            </AlertDescription>
          </Alert>
        )}
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 gap-2 h-auto p-2 bg-gradient-to-br from-king-black/5 to-king-gold/5 rounded-xl border-2 border-king-gold/20">
            <TabsTrigger 
              value="overview" 
              className="flex flex-col gap-1.5 px-3 py-4 rounded-lg transition-all duration-300
                         data-[state=active]:bg-gradient-king data-[state=active]:text-king-gold 
                         data-[state=active]:shadow-lg data-[state=active]:shadow-king-gold/30 data-[state=active]:scale-105
                         data-[state=inactive]:hover:bg-king-gold/5
                         data-[state=inactive]:text-muted-foreground"
            >
              <Info className="h-5 w-5 md:h-6 md:w-6" />
              <span className="text-[11px] md:text-sm font-semibold">Overview</span>
            </TabsTrigger>
            <TabsTrigger 
              value="documents" 
              className="flex flex-col gap-1.5 px-3 py-4 rounded-lg transition-all duration-300 relative
                         data-[state=active]:bg-gradient-king data-[state=active]:text-king-gold 
                         data-[state=active]:shadow-lg data-[state=active]:shadow-king-gold/30 data-[state=active]:scale-105
                         data-[state=inactive]:hover:bg-king-gold/5
                         data-[state=inactive]:text-muted-foreground"
            >
              <FileText className="h-5 w-5 md:h-6 md:w-6" />
              <span className="text-[11px] md:text-sm font-semibold">Documents</span>
              {booking.documents_required && (
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[8px]">
                  !
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="payments" 
              className="flex flex-col gap-1.5 px-3 py-4 rounded-lg transition-all duration-300 relative
                         data-[state=active]:bg-gradient-king data-[state=active]:text-king-gold 
                         data-[state=active]:shadow-lg data-[state=active]:shadow-king-gold/30 data-[state=active]:scale-105
                         data-[state=inactive]:hover:bg-king-gold/5
                         data-[state=inactive]:text-muted-foreground"
            >
              <CreditCard className="h-5 w-5 md:h-6 md:w-6" />
              <span className="text-[11px] md:text-sm font-semibold">Payments</span>
              {(() => {
                const hasPendingPayments = payments?.some((p: any) => 
                  !p.paid_at && p.payment_intent !== 'security_deposit'
                );
                const hasUnauthorizedDeposit = !security_deposits?.some((sd: any) => 
                  sd.status === 'authorized'
                );
                const showIndicator = hasPendingPayments || (booking.security_deposit_amount > 0 && hasUnauthorizedDeposit);
                
                return showIndicator ? (
                  <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[8px]">
                    !
                  </Badge>
                ) : null;
              })()}
            </TabsTrigger>
            <TabsTrigger 
              value="rental" 
              className="flex flex-col gap-1.5 px-3 py-4 rounded-lg transition-all duration-300 relative
                         data-[state=active]:bg-gradient-king data-[state=active]:text-king-gold 
                         data-[state=active]:shadow-lg data-[state=active]:shadow-king-gold/30 data-[state=active]:scale-105
                         data-[state=inactive]:hover:bg-king-gold/5
                         data-[state=inactive]:text-muted-foreground"
            >
              <Car className="h-5 w-5 md:h-6 md:w-6" />
              <span className="text-[11px] md:text-sm font-semibold">Rental</span>
              <Badge variant="secondary" className="absolute -top-1 -right-1 bg-king-gold text-white text-[8px] px-1 py-0 h-4">
                BETA
              </Badge>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <ClientBookingOverview 
              booking={booking} 
              appSettings={portalData.app_settings} 
              payments={portalData.payments}
              permissionLevel={portalData.permission_level}
            />
            
            <RentalInformationAccordion />
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-6 max-w-4xl mx-auto p-4 md:p-6">
            {booking.documents_required && (() => {
              const getMissingDocuments = () => {
                if (!booking.document_requirements) return [];
                
                const missing: string[] = [];
                const requirements = booking.document_requirements;
                const uploadedTypes = documents
                  .filter(doc => ['id_card_front', 'id_card_back', 'drivers_license_front', 'drivers_license_back', 'selfie_with_id', 'proof_of_address'].includes(doc.document_type))
                  .map(doc => doc.document_type);
                
                if (requirements.id_passport?.enabled) {
                  if (requirements.id_passport?.front_back) {
                    if (!uploadedTypes.includes('id_card_front')) missing.push('ID Card/Passport (Front)');
                    if (!uploadedTypes.includes('id_card_back')) missing.push('ID Card/Passport (Back)');
                  } else {
                    if (!uploadedTypes.includes('id_card')) missing.push('ID Card/Passport');
                  }
                }
                
                if (requirements.drivers_license?.enabled) {
                  if (requirements.drivers_license?.front_back) {
                    if (!uploadedTypes.includes('drivers_license_front')) missing.push('Driver\'s License (Front)');
                    if (!uploadedTypes.includes('drivers_license_back')) missing.push('Driver\'s License (Back)');
                  } else {
                    if (!uploadedTypes.includes('drivers_license')) missing.push('Driver\'s License');
                  }
                }
                
                if (requirements.selfie_with_id?.enabled && !uploadedTypes.includes('selfie_with_id')) {
                  missing.push('Selfie with ID');
                }
                
                if (requirements.proof_of_address?.enabled && !uploadedTypes.includes('proof_of_address')) {
                  missing.push('Proof of Address');
                }
                
                return missing;
              };

              const missingDocs = getMissingDocuments();

              return (
                <Alert variant={missingDocs.length === 0 ? 'default' : 'destructive'} className={missingDocs.length === 0 ? 'border-green-500 bg-green-50' : ''}>
                  <AlertCircle className={`h-4 w-4 ${missingDocs.length === 0 ? 'text-green-600' : ''}`} />
                  <AlertDescription>
                    {missingDocs.length === 0 ? (
                      <>
                        <strong className="text-green-600">✓ All Required Documents Uploaded</strong>
                        <p className="text-sm text-muted-foreground mt-1">
                          Thank you for completing your document upload. You can still upload additional documents or replace existing ones below.
                        </p>
                      </>
                    ) : (
                      <>
                        <strong>Missing Required Documents:</strong>
                        <ul className="list-disc list-inside mt-2 text-sm">
                          {missingDocs.map((doc, index) => (
                            <li key={index}>{doc}</li>
                          ))}
                        </ul>
                        <p className="text-sm mt-2">
                          {booking.documents_required_note || 'Please upload the required documents for your booking.'}
                        </p>
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              );
            })()}

            {(() => {
              const getMissingDocuments = () => {
                if (!booking.document_requirements) return [];
                
                const missing: string[] = [];
                const requirements = booking.document_requirements;
                const uploadedTypes = documents
                  .filter(doc => ['id_card_front', 'id_card_back', 'drivers_license_front', 'drivers_license_back', 'selfie_with_id', 'proof_of_address'].includes(doc.document_type))
                  .map(doc => doc.document_type);
                
                if (requirements.id_passport?.enabled) {
                  if (requirements.id_passport?.front_back) {
                    if (!uploadedTypes.includes('id_card_front')) missing.push('ID Card/Passport (Front)');
                    if (!uploadedTypes.includes('id_card_back')) missing.push('ID Card/Passport (Back)');
                  } else {
                    if (!uploadedTypes.includes('id_card')) missing.push('ID Card/Passport');
                  }
                }
                
                if (requirements.drivers_license?.enabled) {
                  if (requirements.drivers_license?.front_back) {
                    if (!uploadedTypes.includes('drivers_license_front')) missing.push('Driver\'s License (Front)');
                    if (!uploadedTypes.includes('drivers_license_back')) missing.push('Driver\'s License (Back)');
                  } else {
                    if (!uploadedTypes.includes('drivers_license')) missing.push('Driver\'s License');
                  }
                }
                
                if (requirements.selfie_with_id?.enabled && !uploadedTypes.includes('selfie_with_id')) {
                  missing.push('Selfie with ID');
                }
                
                if (requirements.proof_of_address?.enabled && !uploadedTypes.includes('proof_of_address')) {
                  missing.push('Proof of Address');
                }
                
                return missing;
              };

              const missingDocs = getMissingDocuments();

              return missingDocs.length > 0 ? (
                <ClientDocumentUpload
                  token={token!}
                  bookingId={booking.id}
                  clientName={booking.client_name}
                  documentRequirements={booking.document_requirements}
                  uploadedDocuments={documents.filter(doc => 
                    ['id_card', 'id_card_front', 'id_card_back',
                     'drivers_license', 'drivers_license_front', 'drivers_license_back',
                     'selfie_with_id', 'proof_of_address', 'insurance', 'other'].includes(doc.document_type)
                   )}
                   onUploadComplete={() => {
                     fetchPortalData();
                     setActiveTab('documents');
                   }}
                 />
              ) : null;
            })()}

            <div>
              <h3 className="text-lg font-semibold mb-4">Main Driver Documents</h3>
              <ClientDocumentView
                documents={documents.filter(doc => 
                  ['id_card', 'id_card_front', 'id_card_back',
                   'drivers_license', 'drivers_license_front', 'drivers_license_back',
                   'selfie_with_id', 'proof_of_address', 'insurance', 'other'].includes(doc.document_type)
                )}
                token={token!}
                onDocumentDeleted={fetchPortalData}
                permissionLevel={portalData.permission_level}
              />
            </div>

            <div className="space-y-4 mt-8">
              <h3 className="text-lg font-semibold">Additional Drivers (Optional)</h3>
              
              <AdditionalDriverUpload
                driverNumber={2}
                token={token!}
                bookingId={booking.id}
                uploadedDocuments={documents.filter(d => 
                  d.document_type === 'driver2_license_front' || d.document_type === 'driver2_license_back'
                )}
                onUploadComplete={() => {
                  fetchPortalData();
                  setActiveTab('documents');
                }}
              />
              
              <AdditionalDriverUpload
                driverNumber={3}
                token={token!}
                bookingId={booking.id}
                uploadedDocuments={documents.filter(d => 
                  d.document_type === 'driver3_license_front' || d.document_type === 'driver3_license_back'
                )}
                onUploadComplete={() => {
                  fetchPortalData();
                  setActiveTab('documents');
                }}
              />
            </div>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-6">
            <ClientPaymentPanel
              booking={booking}
              payments={payments}
              securityDeposits={security_deposits}
              paymentMethods={portalData.payment_methods}
              permissionLevel={portalData.permission_level}
            />
          </TabsContent>

          {/* Rental Tab */}
          <TabsContent value="rental" className="space-y-6">
            <RentalTab
              booking={booking}
              documents={documents}
              deliverySteps={portalData.delivery_steps || []}
              token={token!}
              onUpdate={fetchPortalData}
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

        </Tabs>
      </div>
    </div>
  );
}
