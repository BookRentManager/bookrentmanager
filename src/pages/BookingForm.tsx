import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { calculateRentalDays } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookingFormSummary } from "@/components/booking-form/BookingFormSummary";
import { TermsAndConditions } from "@/components/booking-form/TermsAndConditions";
import { DigitalSignature } from "@/components/booking-form/DigitalSignature";
import { PaymentMethodSelector } from "@/components/booking-form/PaymentMethodSelector";
import { PaymentBreakdown } from "@/components/booking-form/PaymentBreakdown";
import { PaymentAmountSelector } from "@/components/booking-form/PaymentAmountSelector";
import { ClientInformationForm } from "@/components/booking-form/ClientInformationForm";
import { ClientDocumentUpload } from "@/components/booking-form/ClientDocumentUpload";
import { ClientDocumentView } from "@/components/booking-form/ClientDocumentView";
import { RentalInformationAccordion } from "@/components/booking-form/RentalInformationAccordion";
import { Loader2, CheckCircle, Link2, Download, CreditCard } from "lucide-react";
import { PDFDownloadLink } from '@react-pdf/renderer';
import { ClientBookingPDF } from "@/components/ClientBookingPDF";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function BookingForm() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const paymentFailed = searchParams.get('payment_failed') === 'true';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [booking, setBooking] = useState<any>(null);
  const [termsAndConditions, setTermsAndConditions] = useState<any>(null);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [appSettings, setAppSettings] = useState<any>(null);
  
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [manualInstructions, setManualInstructions] = useState("");
  
  // Client information
  const [clientName, setClientName] = useState("");
  const [originalClientName, setOriginalClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [country, setCountry] = useState("");
  const [companyName, setCompanyName] = useState("");
  
  // Delivery/Collection times
  const [deliveryTime, setDeliveryTime] = useState("");
  const [collectionTime, setCollectionTime] = useState("");
  
  // Delivery/Collection notes
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [collectionNotes, setCollectionNotes] = useState("");
  
  // Guest information
  const [showGuestInfo, setShowGuestInfo] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestBillingAddress, setGuestBillingAddress] = useState("");
  const [guestCountry, setGuestCountry] = useState("");
  const [guestCompanyName, setGuestCompanyName] = useState("");
  
  // Terms acceptance
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  // Payment choice (only used if payment_amount_option === 'client_choice')
  const [paymentChoice, setPaymentChoice] = useState<'down_payment' | 'full_payment'>('down_payment');
  
  // Document upload tracking
  const [uploadedDocuments, setUploadedDocuments] = useState<any[]>([]);
  
  // Rental tolerance validation
  const [rentalExceedsTolerance, setRentalExceedsTolerance] = useState(false);

  useEffect(() => {
    if (token) {
      fetchBookingData();
    }
  }, [token]);

  useEffect(() => {
    if (paymentFailed && !loading) {
      toast({
        title: "Payment Cancelled",
        description: "Your payment was cancelled. You can try again or choose a different payment method.",
        variant: "destructive",
      });
    }
  }, [paymentFailed, loading]);

  const fetchBookingData = async () => {
    try {
      setLoading(true);

      console.log('Fetching booking for token:', token?.substring(0, 8) + '...');

      // Fetch app settings for PDF generation
      const { data: settings } = await supabase
        .from('app_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      
      if (settings) {
        setAppSettings(settings);
      }

      const invocationResult = await supabase.functions.invoke('get-booking-by-token', {
        body: { token }
      });

      // Simple defensive check before destructuring
      const { data, error } = invocationResult || {};

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (!data) {
        console.error('No data returned');
        throw new Error('No data returned from booking lookup');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      if (!data.booking) {
        throw new Error('Booking not found');
      }

      console.log('Booking fetched successfully:', data.booking.reference_code);
      
      setBooking(data.booking);
      setTermsAndConditions(data.terms_and_conditions);
      setPaymentMethods(data.payment_methods);

      // Pre-fill client information
      setClientName(data.booking.client_name || "");
      setOriginalClientName(data.booking.client_name || "");
      setClientPhone(data.booking.client_phone || "");
      setBillingAddress(data.booking.billing_address || "");
      setCountry(data.booking.country || "");
      setCompanyName(data.booking.company_name || "");
      
      // Pre-fill delivery/collection times
      setDeliveryTime(format(new Date(data.booking.delivery_datetime), "HH:mm"));
      setCollectionTime(format(new Date(data.booking.collection_datetime), "HH:mm"));
      
      // Pre-fill delivery/collection notes
      setDeliveryNotes(data.booking.delivery_info || "");
      setCollectionNotes(data.booking.collection_info || "");

      // Pre-fill guest information
      setGuestName(data.booking.guest_name || "");
      setGuestPhone(data.booking.guest_phone || "");
      setGuestBillingAddress(data.booking.guest_billing_address || "");
      setGuestCountry(data.booking.guest_country || "");
      setGuestCompanyName(data.booking.guest_company_name || "");
      setShowGuestInfo(!!data.booking.guest_name);

      // Set payment choice based on admin configuration
      if (data.booking.payment_amount_option === 'full_payment_only') {
        setPaymentChoice('full_payment');
      } else {
        setPaymentChoice('down_payment');
      }

      // Check if already submitted
      if (data.booking.tc_accepted_at) {
        setFormSubmitted(true);
      }

      // Always pre-select payment method from stored data or first available
      if (data.booking.tc_accepted_at && data.booking.available_payment_methods) {
        // Use stored payment method for already-submitted bookings
        const storedMethods = typeof data.booking.available_payment_methods === 'string' 
          ? JSON.parse(data.booking.available_payment_methods) 
          : data.booking.available_payment_methods;
        if (Array.isArray(storedMethods) && storedMethods.length > 0) {
          setSelectedPaymentMethod(storedMethods[0]);
        }
      } else if (data.payment_methods?.length > 0) {
        // Use first available for new submissions
        setSelectedPaymentMethod(data.payment_methods[0].method_type);
      }
      setManualInstructions(data.booking.manual_payment_instructions || "");

    } catch (error: any) {
      console.error('Error fetching booking:', error);
      toast({
        title: "Error",
        description: error.message || "Unable to load booking. Please check the link and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUploadedDocuments = async () => {
    if (!booking?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('booking_documents')
        .select('*')
        .eq('booking_id', booking.id)
        .eq('uploaded_by_type', 'client')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setUploadedDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  useEffect(() => {
    if (booking?.id) {
      fetchUploadedDocuments();
    }
  }, [booking?.id]);

  const validateDocumentRequirements = () => {
    // If documents not required, always pass
    if (!booking?.documents_required) return { valid: true, missing: [] };
    
    // If documents are optional (not mandatory), always pass
    if (booking.document_requirements?.upload_timing !== 'mandatory') return { valid: true, missing: [] };
    
    // Documents are mandatory - check which ones are required
    const missing: string[] = [];
    const requirements = booking.document_requirements;
    const uploadedTypes = uploadedDocuments.map(doc => doc.document_type);
    
    // Check ID/Passport requirements
    if (requirements.id_passport?.enabled) {
      if (requirements.id_passport?.front_back) {
        if (!uploadedTypes.includes('id_card_front')) missing.push('ID Card/Passport (Front)');
        if (!uploadedTypes.includes('id_card_back')) missing.push('ID Card/Passport (Back)');
      } else {
        if (!uploadedTypes.includes('id_card')) missing.push('ID Card/Passport');
      }
    }
    
    // Check Driver's License requirements
    if (requirements.drivers_license?.enabled) {
      if (requirements.drivers_license?.front_back) {
        if (!uploadedTypes.includes('drivers_license_front')) missing.push('Driver\'s License (Front)');
        if (!uploadedTypes.includes('drivers_license_back')) missing.push('Driver\'s License (Back)');
      } else {
        if (!uploadedTypes.includes('drivers_license')) missing.push('Driver\'s License');
      }
    }
    
    // Check Selfie with ID requirement
    if (requirements.selfie_with_id?.enabled) {
      if (!uploadedTypes.includes('selfie_with_id')) missing.push('Selfie with ID');
    }
    
    // Check Proof of Address requirement
    if (requirements.proof_of_address?.enabled) {
      if (!uploadedTypes.includes('proof_of_address')) missing.push('Proof of Address');
    }
    
    return {
      valid: missing.length === 0,
      missing
    };
  };

  const handleSubmit = async () => {
    // Check rental tolerance FIRST
    if (rentalExceedsTolerance) {
      toast({
        title: "Cannot Submit",
        description: "Please contact your Reservation Manager to update the booking with correct pricing for the additional rental day.",
        variant: "destructive",
      });
      return;
    }

    if (!termsAccepted) {
      toast({
        title: "Terms Required",
        description: "Please accept the terms and conditions",
        variant: "destructive",
      });
      return;
    }

    if (!signatureData) {
      toast({
        title: "Signature Required",
        description: "Please sign the document before submitting",
        variant: "destructive",
      });
      return;
    }

    if (!selectedPaymentMethod) {
      toast({
        title: "Payment Method Required",
        description: "Please select a payment method",
        variant: "destructive",
      });
      return;
    }

    if (!clientPhone) {
      toast({
        title: "Phone Required",
        description: "Please enter your phone number",
        variant: "destructive",
      });
      return;
    }

    if (!billingAddress) {
      toast({
        title: "Address Required",
        description: "Please enter your billing address",
        variant: "destructive",
      });
      return;
    }

    if (!country) {
      toast({
        title: "Country Required",
        description: "Please select your country",
        variant: "destructive",
      });
      return;
    }

    if (showGuestInfo) {
      if (!guestName) {
        toast({
          title: "Guest Name Required",
          description: "Please enter the guest's full name",
          variant: "destructive",
        });
        return;
      }
      if (!guestCountry) {
        toast({
          title: "Guest Country Required",
          description: "Please select the guest's country of residence",
          variant: "destructive",
        });
        return;
      }
    }

    // Validate document requirements (if mandatory)
    const docValidation = validateDocumentRequirements();
    if (!docValidation.valid) {
      toast({
        title: "Required Documents Missing",
        description: `Please upload the following documents: ${docValidation.missing.join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);

      // STEP 1: Submit form data (T&C, client info) - only if not already submitted
      if (!formSubmitted && !booking.tc_accepted_at) {
        const clientIp = await fetch('https://api.ipify.org?format=json')
          .then(res => res.json())
          .then(data => data.ip)
          .catch(() => "0.0.0.0");

        const { data, error } = await supabase.functions.invoke('submit-booking-form', {
          body: {
            token,
            tc_signature_data: signatureData,
            tc_accepted_ip: clientIp,
            selected_payment_methods: [selectedPaymentMethod],
            manual_payment_instructions: selectedPaymentMethod === 'manual' ? manualInstructions : null,
            client_name: clientName,
            client_phone: clientPhone,
            billing_address: billingAddress,
            country: country,
            company_name: companyName,
            payment_choice: paymentChoice,
            delivery_time: deliveryTime,
            collection_time: collectionTime,
            delivery_notes: deliveryNotes,
            collection_notes: collectionNotes,
            
            // Guest information
            guest_name: showGuestInfo ? guestName : null,
            guest_phone: showGuestInfo ? guestPhone : null,
            guest_billing_address: showGuestInfo ? guestBillingAddress : null,
            guest_country: showGuestInfo ? guestCountry : null,
            guest_company_name: showGuestInfo ? guestCompanyName : null,
          },
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);
        
        setFormSubmitted(true);
        
        // If bank transfer, redirect to bank transfer instructions page
        if (data.redirect_url) {
          toast({
            title: "Form Submitted - Redirecting",
            description: "Please complete your bank transfer payment...",
          });
          window.location.href = data.redirect_url;
          return;
        }
        
        toast({
          title: "Form Saved - Redirecting to Payment",
          description: "Please wait while we prepare your payment...",
        });
        // Continue to payment step automatically (don't return early)
      }

      // STEP 2: Create payment link (only for card payments)
      const CARD_PAYMENT_METHODS = ['visa_mastercard', 'amex'];
      const isCardPayment = CARD_PAYMENT_METHODS.includes(selectedPaymentMethod!);
      
      if (isCardPayment) {
        // Calculate payment amount based on client choice and admin configuration
        let paymentAmount = booking.amount_total;
        
        if (booking.payment_amount_option === 'client_choice' && paymentChoice === 'down_payment') {
          paymentAmount = (booking.amount_total * (booking.payment_amount_percent || 30)) / 100;
        } else if (booking.payment_amount_option === 'down_payment_only') {
          paymentAmount = (booking.amount_total * (booking.payment_amount_percent || 30)) / 100;
        }
        // If 'full_payment_only' or client chose full payment, paymentAmount remains amount_total

        // Create PostFinance payment link
        const { data: paymentData, error: paymentError } = await supabase.functions.invoke(
          'create-postfinance-payment-link',
          {
            body: {
              booking_id: booking.id,
              amount: paymentAmount,
              payment_type: 'deposit',
              payment_intent: paymentChoice === 'full_payment' ? 'full_payment' : 'down_payment',
              payment_method_type: selectedPaymentMethod, // Pass the actual method type
              expires_in_hours: 48,
              description: `Payment for booking ${booking.reference_code}`,
              send_email: true,
            },
          }
        );

        if (paymentError) throw paymentError;
        if (!paymentData?.redirectUrl) throw new Error('Payment redirect URL not generated');

        toast({
          title: "Redirecting to Payment",
          description: "Please complete your payment to confirm the booking",
        });
        
        window.location.href = paymentData.redirectUrl;
        return;
      }

      // For non-card payments, redirect to client portal
      toast({
        title: "Form Saved Successfully!",
        description: "Redirecting to your booking portal...",
      });
      
      // Redirect to client portal immediately
      navigate(`/client-portal/${token}`);
      return;

    } catch (error: any) {
      console.error('Error submitting form:', error);
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit booking form",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!booking || !termsAndConditions) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Booking Not Found</h1>
          <p className="text-muted-foreground">
            The booking link is invalid or has expired.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-2xl w-full space-y-6">
          <div className="flex justify-center">
            <CheckCircle className="h-20 w-20 text-green-600" />
          </div>
          
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">Thank You!</h1>
            <p className="text-lg text-muted-foreground">
              Your booking form has been submitted successfully.
            </p>
          </div>

          <Card className="p-6 space-y-4">
            <div>
              <p className="font-semibold text-sm text-muted-foreground">Booking Reference:</p>
              <p className="font-mono text-xl font-bold">{booking.reference_code}</p>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                You can access your booking portal to view details, download your PDF, {uploadedDocuments.length === 0 && 'upload documents, '}and make payments:
              </p>

              <Button
                onClick={() => navigate(`/client-portal/${token}`)}
                className="w-full"
                size="lg"
              >
                <Link2 className="mr-2 h-5 w-5" />
                Go to Your Booking Portal
              </Button>

              {appSettings && (
                <PDFDownloadLink
                  document={<ClientBookingPDF booking={booking} appSettings={appSettings} />}
                  fileName={`booking-${booking.reference_code}.pdf`}
                >
                  {({ loading }) => (
                    <Button
                      variant="outline"
                      className="w-full"
                      size="lg"
                      disabled={loading}
                    >
                      <Download className="mr-2 h-5 w-5" />
                      {loading ? 'Preparing PDF...' : 'Download Booking PDF'}
                    </Button>
                  )}
                </PDFDownloadLink>
              )}
            </div>

            <div className="h-px bg-border" />

            <p className="text-xs text-muted-foreground text-center">
              A confirmation email with the portal link has been sent to {booking.client_email}
            </p>
          </Card>
        </div>
      </div>
    );
  }

  // Show "Already Submitted" page if the form was previously submitted
  if (formSubmitted && booking.tc_accepted_at) {
    return (
      <div className="min-h-screen flex items-center justify-center p-3 md:p-4 bg-gradient-to-br from-king-black via-gray-900 to-king-black">
        <div className="max-w-2xl w-full space-y-4 md:space-y-6 px-2 md:px-0">
          {/* Logo */}
          <div className="flex justify-center">
            <img 
              src="/king-rent-logo.png"
              alt="King Rent Logo" 
              className="h-16 md:h-20 w-auto object-contain"
              style={{ background: 'transparent' }}
            />
          </div>
          
          {/* Main message */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-king-gold px-2">
              Booking Already Submitted
            </h1>
            <p className="text-base md:text-lg text-gray-300 px-2">
              You have already completed and submitted this booking form.
            </p>
          </div>

          {/* Booking details card */}
          <Card className="p-4 md:p-6 space-y-4 bg-white/95 backdrop-blur">
            <div>
              <p className="font-semibold text-sm text-muted-foreground">Booking Reference:</p>
              <p className="font-mono text-xl md:text-2xl font-bold text-king-gold-dark break-all">{booking.reference_code}</p>
            </div>

            <div className="h-px bg-border" />

            <div>
              <p className="font-semibold text-sm text-muted-foreground">Submitted On:</p>
              <p className="text-base md:text-lg break-words">
                {new Date(booking.tc_accepted_at).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Access your booking portal to view booking details, download documents, and manage payments:
              </p>

              {/* Primary CTA - Booking Portal */}
              <Button
                onClick={() => navigate(`/client-portal/${token}`)}
                className="w-full bg-king-gold hover:bg-king-gold/90 text-king-black font-semibold"
                size="lg"
                style={{ minHeight: '48px' }}
              >
                <Link2 className="mr-2 h-5 w-5" />
                Access Your Booking Portal
              </Button>

              {/* Secondary CTA - Download PDF */}
              {appSettings && (
                <PDFDownloadLink
                  document={<ClientBookingPDF booking={booking} appSettings={appSettings} />}
                  fileName={`booking-${booking.reference_code}.pdf`}
                >
                  {({ loading }) => (
                    <Button
                      variant="outline"
                      className="w-full border-king-gold text-king-gold-dark hover:bg-king-gold/10"
                      size="lg"
                      disabled={loading}
                      style={{ minHeight: '48px' }}
                    >
                      <Download className="mr-2 h-5 w-5" />
                      {loading ? 'Preparing PDF...' : 'Download Booking PDF'}
                    </Button>
                  )}
                </PDFDownloadLink>
              )}
            </div>

            <div className="h-px bg-border" />

            <p className="text-xs md:text-sm text-muted-foreground text-center px-2">
              Need help? Contact us at {appSettings?.company_email || 'support@kingrent.com'}
            </p>
          </Card>
        </div>
      </div>
    );
  }

  // Show processing state only during active submission
  if (submitting) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-king-gold mx-auto" />
          <h2 className="text-2xl font-bold">Processing Your Booking...</h2>
          <p className="text-muted-foreground">
            Please wait while we process your submission.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-3 md:py-4 px-3 md:px-4">
      <div className="max-w-4xl mx-auto space-y-3 md:space-y-4">
        {/* Header - Centered logo on top */}
        <div className="text-center space-y-2">
          {/* Centered Logo at Top */}
          <div className="flex justify-center pt-2">
            <img 
              src="https://lbvaghmqwhsawvxyiemw.supabase.co/storage/v1/object/public/company-logos/logo-1761150745897.jpg" 
              alt={appSettings?.company_name || "BookRentManager"}
              className="h-16 md:h-20 w-auto object-contain bg-white p-2 rounded-lg" 
            />
          </div>
          
          {/* Centered Title */}
          <h1 className="text-2xl md:text-3xl font-playfair font-bold text-king-gold">
            Complete Your Booking
          </h1>
          
          {/* Subtitle */}
          <p className="text-sm md:text-base text-gray-600">in 2 Simple Steps</p>
          
          {/* Step Indicators */}
          <div className="flex items-center justify-center gap-4 text-sm font-medium py-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-king-black text-white flex items-center justify-center font-bold text-sm border-2 border-king-gold">
                1
              </div>
              <span className="text-sm font-semibold">Complete & Sign</span>
            </div>
            <div className="text-muted-foreground text-xl">→</div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-bold text-sm border-2 border-gray-400">
                2
              </div>
              <span className="text-gray-600 text-sm">Payment</span>
            </div>
          </div>
          
          {/* Clear Instructions */}
          <p className="text-xs md:text-sm text-gray-600 max-w-2xl mx-auto px-4">
            Please review the details below, read the terms and conditions, and sign to proceed to payment.
          </p>
        </div>

        {/* Section 1: Client Information */}
        <ClientInformationForm
          className="bg-gray-50"
          clientName={clientName}
          originalClientName={originalClientName}
          onClientNameChange={setClientName}
          clientEmail={booking.client_email}
          clientPhone={clientPhone}
          onPhoneChange={setClientPhone}
          billingAddress={billingAddress}
          onBillingAddressChange={setBillingAddress}
          country={country}
          onCountryChange={setCountry}
          companyName={companyName}
          onCompanyNameChange={setCompanyName}
          showGuestInfo={showGuestInfo}
          onShowGuestInfoChange={setShowGuestInfo}
          guestName={guestName}
          onGuestNameChange={setGuestName}
          guestPhone={guestPhone}
          onGuestPhoneChange={setGuestPhone}
          guestBillingAddress={guestBillingAddress}
          onGuestBillingAddressChange={setGuestBillingAddress}
          guestCountry={guestCountry}
          onGuestCountryChange={setGuestCountry}
          guestCompanyName={guestCompanyName}
          onGuestCompanyNameChange={setGuestCompanyName}
          disabled={false}
        />

        {/* Section 2: Booking Summary */}
          <BookingFormSummary 
            className="bg-gray-50" 
            booking={booking}
            showCarPlate={false}
            deliveryTime={deliveryTime}
            onDeliveryTimeChange={setDeliveryTime}
            collectionTime={collectionTime}
            onCollectionTimeChange={setCollectionTime}
            deliveryNotes={deliveryNotes}
            onDeliveryNotesChange={setDeliveryNotes}
            collectionNotes={collectionNotes}
            onCollectionNotesChange={setCollectionNotes}
            onTimeValidation={setRentalExceedsTolerance}
          />

        {/* Rental Information */}
        <RentalInformationAccordion />

        {/* Section 3: Document Upload */}
        {booking.documents_required && (
          <Card className="bg-gray-50">
            <CardHeader>
              <CardTitle>
                {booking.document_requirements?.upload_timing === 'mandatory' 
                  ? 'Required Documents *' 
                  : 'Document Upload'}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {booking.document_requirements?.upload_timing === 'mandatory'
                  ? 'Please upload all required documents to complete your booking.'
                  : 'You can upload your documents now or later in your booking portal.'}
              </p>
              {booking.documents_required_note && (
                <p className="text-sm text-primary font-medium mt-2">
                  ℹ️ {booking.documents_required_note}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              <ClientDocumentUpload
                token={token!}
                bookingId={booking.id}
                clientName={booking.client_name}
                documentRequirements={booking.document_requirements}
                uploadedDocuments={uploadedDocuments.filter(doc => 
                  ['id_card', 'id_card_front', 'id_card_back',
                   'drivers_license', 'drivers_license_front', 'drivers_license_back',
                   'selfie_with_id', 'proof_of_address', 'insurance', 'other'].includes(doc.document_type)
                )}
                onUploadComplete={() => {
                  toast({
                    title: "Document Uploaded",
                    description: "Your document has been uploaded successfully",
                  });
                  fetchUploadedDocuments();
                }}
              />

              {uploadedDocuments.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Uploaded Documents</h3>
                  <ClientDocumentView
                    documents={uploadedDocuments}
                    token={token!}
                    onDocumentDeleted={fetchUploadedDocuments}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Section 4: Payment Configuration */}
        <div className="space-y-6">
          {/* Show different UI based on payment_amount_option */}
          {booking?.payment_amount_option === 'client_choice' ? (
            <PaymentAmountSelector
              className="bg-gray-50"
              totalAmount={booking.amount_total}
              downPaymentPercent={booking.payment_amount_percent || 30}
              selectedChoice={paymentChoice}
              onChoiceChange={setPaymentChoice}
              currency={booking.currency}
            />
          ) : (
            <Card className="bg-gray-50">
              <CardHeader>
                <CardTitle>Payment Amount</CardTitle>
              </CardHeader>
              <CardContent>
                {booking.payment_amount_option === 'down_payment_only' ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Down payment required
                    </p>
                    <p className="text-2xl font-bold text-primary">
                      {booking.currency} {((booking.amount_total * (booking.payment_amount_percent || 30)) / 100).toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      ({booking.payment_amount_percent || 30}% of total rental)
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Full payment required
                    </p>
                    <p className="text-2xl font-bold text-primary">
                      {booking.currency} {booking.amount_total.toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      (100% of total rental)
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <PaymentMethodSelector
            className="bg-gray-50"
            paymentMethods={paymentMethods}
            selectedMethod={selectedPaymentMethod}
            onMethodChange={setSelectedPaymentMethod}
            manualInstructions={manualInstructions}
            onInstructionsChange={setManualInstructions}
          />
          
          <PaymentBreakdown
            className="bg-gray-50"
            bookingId={booking.id}
            paymentIntent="client_payment"
            selectedPaymentMethod={selectedPaymentMethod}
            currency={booking.currency}
            amountOverride={
              booking.payment_amount_option === 'client_choice' && paymentChoice === 'down_payment'
                ? (booking.amount_total * (booking.payment_amount_percent || 30)) / 100
                : booking.payment_amount_option === 'down_payment_only'
                ? (booking.amount_total * (booking.payment_amount_percent || 30)) / 100
                : booking.amount_total
            }
          />
        </div>

        {/* Terms and Signature */}
        <div className="space-y-6">
          <TermsAndConditions
            className="bg-gray-50"
            version={termsAndConditions.version}
            content={termsAndConditions.content}
            accepted={termsAccepted}
            onAcceptedChange={setTermsAccepted}
          />

          <DigitalSignature
            className="bg-gray-50"
            onSignatureChange={setSignatureData}
          />
        </div>

        {/* Pre-Submit Checklist */}
        <Alert className="border-king-gold/50 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/10 dark:to-orange-950/10 py-6">
          <AlertTitle className="flex items-center gap-2 text-base font-semibold mb-3">
            📋 Before Submitting
          </AlertTitle>
          <AlertDescription>
            <div className="space-y-2 text-base">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded flex items-center justify-center text-sm ${termsAccepted ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                  {termsAccepted ? '✓' : '○'}
                </div>
                <span className={termsAccepted ? 'text-foreground' : 'text-muted-foreground'}>Accepted Terms & Conditions</span>
              </div>
              
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded flex items-center justify-center text-sm ${signatureData ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                  {signatureData ? '✓' : '○'}
                </div>
                <span className={signatureData ? 'text-foreground' : 'text-muted-foreground'}>Provided Digital Signature</span>
              </div>
              
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded flex items-center justify-center text-sm ${selectedPaymentMethod ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                  {selectedPaymentMethod ? '✓' : '○'}
                </div>
                <span className={selectedPaymentMethod ? 'text-foreground' : 'text-muted-foreground'}>Selected Payment Method</span>
              </div>

              {/* Document upload status - only show if documents are mandatory */}
              {booking.documents_required && booking.document_requirements?.upload_timing === 'mandatory' && (
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded flex items-center justify-center text-sm ${
                    validateDocumentRequirements().valid ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
                  }`}>
                    {validateDocumentRequirements().valid ? '✓' : '○'}
                  </div>
                  <span className={validateDocumentRequirements().valid ? 'text-foreground' : 'text-muted-foreground'}>
                    Uploaded Required Documents
                    {!validateDocumentRequirements().valid && (
                      <span className="text-xs text-destructive ml-1">
                        ({validateDocumentRequirements().missing.length} missing)
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>

            {rentalExceedsTolerance && (
              <div className="mt-3 p-3 bg-red-50 border-2 border-red-300 rounded-md dark:bg-red-950/20 dark:border-red-800">
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded bg-red-500 text-white flex items-center justify-center text-sm flex-shrink-0 mt-0.5">
                    ✕
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-red-900 text-sm dark:text-red-200">Additional Rental Day Detected</p>
                    <p className="text-red-800 text-xs mt-1 dark:text-red-300">
                      The selected collection time would incur additional rental day charges. 
                      Please contact your Reservation Manager to confirm costs before proceeding. 
                      You cannot submit this form until the booking is updated.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </AlertDescription>
        </Alert>

        {/* Submit Button Section - Sticky Footer */}
        <div className="sticky bottom-0 left-0 right-0 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 border-t shadow-lg -mx-3 md:-mx-4 px-3 md:px-4 py-3">
          <Button
            variant="king"
            onClick={handleSubmit}
            disabled={
              submitting || 
              !signatureData || 
              !selectedPaymentMethod || 
              rentalExceedsTolerance ||
              (booking.documents_required && 
               booking.document_requirements?.upload_timing === 'mandatory' && 
               !validateDocumentRequirements().valid)
            }
            className="w-full h-16 text-lg font-bold shadow-xl hover:shadow-2xl transition-all"
          >
            {submitting ? (
              <>
                <Loader2 className="h-6 w-6 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="h-6 w-6 mr-2" />
                Submit Booking Form
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
