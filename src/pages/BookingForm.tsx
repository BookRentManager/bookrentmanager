import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookingFormSummary } from "@/components/booking-form/BookingFormSummary";
import { TermsAndConditions } from "@/components/booking-form/TermsAndConditions";
import { DigitalSignature } from "@/components/booking-form/DigitalSignature";
import { PaymentMethodSelector } from "@/components/booking-form/PaymentMethodSelector";
import { PaymentBreakdown } from "@/components/booking-form/PaymentBreakdown";
import { PaymentAmountSelector } from "@/components/booking-form/PaymentAmountSelector";
import { ClientInformationForm } from "@/components/booking-form/ClientInformationForm";
import { Loader2, CheckCircle } from "lucide-react";

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

  useEffect(() => {
    if (token) {
      fetchBookingData();
    }
  }, [token]);

  const fetchBookingData = async () => {
    try {
      setLoading(true);

      console.log('Fetching booking for token:', token?.substring(0, 8) + '...');

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
          title: "Form Saved",
          description: "Click 'Proceed to Payment' to complete your booking",
        });
        setSubmitting(false);
        return; // Stop here, wait for user to proceed to payment
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
        }, 1000);
        return;
      }

      // For non-card payments, redirect to client portal
      toast({
        title: "Success!",
        description: "Redirecting to your booking portal...",
      });
      
      // Redirect to client portal
      setTimeout(() => {
        navigate(`/client-portal/${token}`);
      }, 1000);

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
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <CheckCircle className="h-16 w-16 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold">Form Submitted!</h1>
          <p className="text-muted-foreground">
            Thank you for completing the booking form. You will receive further instructions via email.
          </p>
          <p className="text-sm text-muted-foreground">
            Booking Reference: <span className="font-mono font-semibold">{booking.reference_code}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Complete Your Booking</h1>
          <p className="text-muted-foreground">
            Please review the details below, read the terms and conditions, and sign to complete your booking.
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

        {/* Section 3: Payment Configuration */}
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

        {/* Progress Indicator */}
        {(formSubmitted || booking.tc_accepted_at) && (
          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <p className="text-sm text-green-900 dark:text-green-100 font-medium">
              ✓ Form submitted successfully
            </p>
            <p className="text-xs text-green-700 dark:text-green-300 mt-1">
              Click "Proceed to Payment" below to complete your {selectedPaymentMethod === 'visa_mastercard' ? 'Visa/Mastercard' : selectedPaymentMethod === 'amex' ? 'Amex' : ''} payment
            </p>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={submitting || !signatureData || !selectedPaymentMethod}
            className="min-w-[200px]"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : formSubmitted || booking.tc_accepted_at ? (
              "Proceed to Payment"
            ) : (
              "Submit Booking Form"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
