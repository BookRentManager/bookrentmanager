import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import crownIcon from "@/assets/crown.png";
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
import { Loader2, CheckCircle, Link2, Download, CreditCard } from "lucide-react";
import { PDFDownloadLink } from '@react-pdf/renderer';
import { ClientBookingPDF } from "@/components/ClientBookingPDF";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function BookingForm() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

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
  const [clientPhone, setClientPhone] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [country, setCountry] = useState("");
  const [companyName, setCompanyName] = useState("");
  
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
  const [uploadedDocuments, setUploadedDocuments] = useState<string[]>([]);

  useEffect(() => {
    if (token) {
      fetchBookingData();
    }
  }, [token]);

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
      setClientPhone(data.booking.client_phone || "");
      setBillingAddress(data.booking.billing_address || "");
      setCountry(data.booking.country || "");
      setCompanyName(data.booking.company_name || "");

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

  const handleSubmit = async () => {
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
            client_phone: clientPhone,
            billing_address: billingAddress,
            country: country,
            company_name: companyName,
            payment_choice: paymentChoice,
            
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
        if (!paymentData?.payment_link) throw new Error('Payment link not generated');

        toast({
          title: "Redirecting to Payment",
          description: "Please complete your payment to confirm the booking",
        });
        
        setTimeout(() => {
          window.location.href = paymentData.payment_link;
        }, 1500);
        return;
      }

      // For non-card payments, redirect to client portal
      toast({
        title: "Form Saved Successfully!",
        description: "Redirecting to your booking portal...",
      });
      
      // Redirect to client portal
      setTimeout(() => {
        navigate(`/client-portal/${token}`);
      }, 1500);

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

  // Show processing state while redirecting
  if (formSubmitted && !submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <h2 className="text-2xl font-bold">Processing Your Booking...</h2>
          <p className="text-muted-foreground">
            Please wait while we redirect you to payment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-4 md:py-8 px-3 md:px-4">
      <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
        {/* Header - More compact on mobile */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <img src={crownIcon} alt="Crown" className="h-12 w-auto" />
            <h1 className="text-2xl md:text-3xl font-playfair font-bold leading-tight px-2 text-king-gold-dark">
              Complete Your Booking
            </h1>
          </div>
          <p className="text-sm md:text-base text-muted-foreground">in 2 Simple Steps</p>
          
          {/* Step indicators - stacked on small mobile */}
          <div className="flex flex-col xs:flex-row items-center justify-center gap-2 xs:gap-4 text-sm font-medium px-2">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">
                1
              </div>
              <span className="text-sm md:text-base">Complete & Sign Form</span>
            </div>
            <div className="hidden xs:block text-muted-foreground">→</div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-bold border-2 border-primary shrink-0">
                2
              </div>
              <span className="text-muted-foreground text-sm md:text-base">Payment</span>
            </div>
          </div>
          
          <p className="text-sm md:text-base text-muted-foreground px-4 leading-relaxed">
            Please review the details below, read the terms and conditions, and sign to proceed to payment.
          </p>
        </div>

        {/* Section 1: Client Information */}
        <ClientInformationForm
          clientName={booking.client_name}
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
        />

        {/* Section 2: Booking Summary */}
        <BookingFormSummary booking={booking} />

        {/* Section 3: Document Upload */}
        <Card>
          <CardHeader>
            <CardTitle>Required Documents (Optional)</CardTitle>
            <p className="text-sm text-muted-foreground">
              You can upload your documents now or later in your booking portal.
            </p>
          </CardHeader>
          <CardContent>
            <ClientDocumentUpload
              token={token!}
              bookingId={booking.id}
              clientName={booking.client_name}
              onUploadComplete={() => {
                toast({
                  title: "Document Uploaded",
                  description: "Your document has been uploaded successfully",
                });
              }}
            />
          </CardContent>
        </Card>

        {/* Section 4: Payment Configuration */}
        <div className="space-y-6">
          {/* Show different UI based on payment_amount_option */}
          {booking?.payment_amount_option === 'client_choice' ? (
            <PaymentAmountSelector
              totalAmount={booking.amount_total}
              downPaymentPercent={booking.payment_amount_percent || 30}
              selectedChoice={paymentChoice}
              onChoiceChange={setPaymentChoice}
              currency={booking.currency}
            />
          ) : (
            <Card>
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
            paymentMethods={paymentMethods}
            selectedMethod={selectedPaymentMethod}
            onMethodChange={setSelectedPaymentMethod}
            manualInstructions={manualInstructions}
            onInstructionsChange={setManualInstructions}
          />
          
          <PaymentBreakdown
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
            version={termsAndConditions.version}
            content={termsAndConditions.content}
            accepted={termsAccepted}
            onAcceptedChange={setTermsAccepted}
          />

          <DigitalSignature
            onSignatureChange={setSignatureData}
          />
        </div>

         {/* Submit Button Section - Mobile optimized */}
         <div className="sticky bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-t shadow-lg -mx-3 md:-mx-4 px-3 md:px-4 py-4 md:py-6 space-y-3 md:space-y-4">
           {/* Instructional Banner - compact on mobile */}
           <div className="text-center">
             <div className="inline-flex flex-col xs:flex-row items-center gap-2 px-3 py-2.5 bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-400 dark:border-amber-600 rounded-lg text-left xs:text-center">
               <div className="w-7 h-7 rounded-full bg-amber-400 text-white flex items-center justify-center font-bold text-sm shrink-0">
                 2
               </div>
               <p className="font-semibold text-amber-900 dark:text-amber-100 text-sm md:text-base">
                 Proceed to Step 2 - Payment by submitting below
               </p>
             </div>
           </div>

           {/* Submit Button - full width on mobile, large touch target */}
           <Button
             size="lg"
             onClick={handleSubmit}
             disabled={submitting || !signatureData || !selectedPaymentMethod}
             className="w-full h-14 md:h-16 text-base md:text-lg font-bold bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-600 hover:via-yellow-600 hover:to-amber-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 border-2 border-amber-400 active:scale-[0.98]"
           >
             {submitting ? (
               <>
                 <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                 Processing...
               </>
             ) : (
               <>
                 <CreditCard className="h-5 w-5 mr-2" />
                 Submit Booking Form
               </>
             )}
           </Button>
         </div>
      </div>
    </div>
  );
}
