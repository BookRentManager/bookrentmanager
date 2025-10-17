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
  
  // Payment choice (only used if payment_amount_option === 'client_choice')
  const [paymentChoice, setPaymentChoice] = useState<'down_payment' | 'full_payment'>('down_payment');

  useEffect(() => {
    if (token) {
      fetchBookingData();
    }
  }, [token]);

  // Mobile detection helper
  const isMobileDevice = () => {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
    const isSafari = /safari/i.test(userAgent) && !/chrome|chromium|crios/i.test(userAgent);
    console.log('Device detection:', { userAgent, isMobile, isSafari });
    return { isMobile, isSafari };
  };

  // Timeout wrapper with cache busting for Safari mobile
  const invokeWithTimeout = async (functionName: string, body: any, timeoutMs: number = 30000) => {
    const { isSafari } = isMobileDevice();
    
    // Add cache busting for Safari
    const cacheBuster = isSafari ? `?t=${Date.now()}` : '';
    
    return Promise.race([
      supabase.functions.invoke(functionName, { 
        body: { ...body, cacheBuster },
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout - please check your internet connection')), timeoutMs)
      )
    ]);
  };

  const fetchBookingData = async (retryCount = 0) => {
    const MAX_RETRIES = 2;
    const { isMobile, isSafari } = isMobileDevice();
    
    try {
      setLoading(true);

      console.log('Invoking get-booking-by-token with token:', token?.substring(0, 8) + '...');
      console.log('Attempt:', retryCount + 1, 'of', MAX_RETRIES + 1, { isMobile, isSafari });

      // Use timeout wrapper for mobile, regular call for desktop
      let invocationResult: any = isMobile 
        ? await invokeWithTimeout('get-booking-by-token', { token }, 30000)
        : await supabase.functions.invoke('get-booking-by-token', { body: { token } });

      // Ensure Promise is fully resolved (Safari-specific issue)
      invocationResult = await Promise.resolve(invocationResult);

      console.log('Invocation result:', {
        resultType: typeof invocationResult,
        resultConstructor: invocationResult?.constructor?.name,
        isNull: invocationResult === null,
        isUndefined: invocationResult === undefined,
        isPromise: invocationResult instanceof Promise,
        hasData: invocationResult && 'data' in invocationResult,
        hasError: invocationResult && 'error' in invocationResult,
        keys: invocationResult ? Object.keys(invocationResult) : [],
        isMobile,
        isSafari
      });

      // Defensive check: ensure invocationResult is an object and not a Promise
      if (!invocationResult || typeof invocationResult !== 'object' || invocationResult instanceof Promise) {
        console.error('Invalid invocation result:', {
          value: invocationResult,
          type: typeof invocationResult,
          isPromise: invocationResult instanceof Promise
        });
        
        // Retry logic for mobile
        if (isMobile && retryCount < MAX_RETRIES) {
          console.log('Retrying request...');
          toast({
            title: "Retrying...",
            description: `Connection issue detected. Attempt ${retryCount + 2} of ${MAX_RETRIES + 1}`,
          });
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
          return fetchBookingData(retryCount + 1);
        }
        
        const errorMessage = isSafari
          ? 'Safari connection issue. Please: 1) Clear Safari cache (Settings → Safari → Clear History), 2) Try Safari Private mode, or 3) Use a desktop browser.'
          : isMobile
          ? 'Mobile connection timeout. Please try using WiFi or a desktop browser.'
          : 'Failed to connect to server. Please check your internet connection and try again.';
        throw new Error(errorMessage);
      }

      // Now safely destructure
      const { data, error } = invocationResult;

      console.log('After destructuring:', { 
        hasData: !!data, 
        hasError: !!error,
        dataType: typeof data,
        errorType: typeof error 
      });

      if (error) {
        console.error('Function returned error:', error);
        throw error;
      }

      if (!data) {
        throw new Error('No data received from server');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      if (!data.booking) {
        throw new Error('Booking data not found');
      }

      setBooking(data.booking);
      setTermsAndConditions(data.terms_and_conditions);
      setPaymentMethods(data.payment_methods);

      // DEBUG: Log payment configuration
      console.log('Booking loaded:', {
        reference: data.booking.reference_code,
        payment_amount_option: data.booking.payment_amount_option,
        payment_amount_percent: data.booking.payment_amount_percent,
        typeOfOption: typeof data.booking.payment_amount_option,
      });

      // Pre-fill client information
      setClientPhone(data.booking.client_phone || "");
      setBillingAddress(data.booking.billing_address || "");
      setCountry(data.booking.country || "");
      setCompanyName(data.booking.company_name || "");

      // Set payment choice based on admin configuration
      if (data.booking.payment_amount_option === 'full_payment_only') {
        setPaymentChoice('full_payment');
      } else {
        setPaymentChoice('down_payment');
      }

      // Check if already submitted
      if (data.booking.tc_accepted_at) {
        setSubmitted(true);
      }

      // Pre-select first available payment method
      if (data.payment_methods?.length > 0 && !data.booking.tc_accepted_at) {
        setSelectedPaymentMethod(data.payment_methods[0].method_type);
      }
      setManualInstructions(data.booking.manual_payment_instructions || "");

    } catch (error: any) {
      console.error('Error fetching booking:', {
        message: error.message,
        stack: error.stack,
        error,
        errorType: typeof error,
        errorConstructor: error?.constructor?.name
      });
      toast({
        title: "Error Loading Booking",
        description: error.message || "Failed to load booking details. Please try refreshing the page.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
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

    try {
      setSubmitting(true);

      // Get client IP
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
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      // Check if payment method requires card payment (explicit whitelist)
      const CARD_PAYMENT_METHODS = ['visa_mastercard', 'amex'];
      const isCardPayment = CARD_PAYMENT_METHODS.includes(selectedPaymentMethod);
      
      console.log('Payment submission:', {
        isCardPayment,
        selectedPaymentMethod,
        paymentMethods: paymentMethods.map(pm => pm.method_type),
        booking_id: booking.id,
        reference: booking.reference_code
      });

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
        console.log('Creating payment link:', {
          booking_id: booking.id,
          amount: paymentAmount,
          payment_intent: paymentChoice === 'full_payment' ? 'full_payment' : 'down_payment',
          reference: booking.reference_code
        });

        const { data: paymentData, error: paymentError } = await supabase.functions.invoke(
          'create-postfinance-payment-link',
          {
            body: {
              booking_id: booking.id,
              amount: paymentAmount,
              payment_type: 'deposit',
              payment_intent: paymentChoice === 'full_payment' ? 'full_payment' : 'down_payment',
              expires_in_hours: 48,
              description: `Payment for booking ${booking.reference_code}`,
              send_email: true,
            },
          }
        );

        if (paymentError) {
          console.error('Payment link creation failed:', paymentError);
          toast({
            title: "Payment Link Failed",
            description: paymentError.message || "Could not create payment link",
            variant: "destructive",
          });
          throw paymentError;
        }

        if (!paymentData?.payment_link) {
          console.error('No payment link returned:', paymentData);
          toast({
            title: "Payment Link Failed",
            description: "Payment link was not generated. Please contact support.",
            variant: "destructive",
          });
          throw new Error('Payment link not generated');
        }

        console.log('Payment link created successfully:', paymentData.payment_link);

        // Redirect to PostFinance checkout
        toast({
          title: "Redirecting to Payment",
          description: "Please complete your payment to confirm the booking",
        });
        
        // Redirect to payment
        setTimeout(() => {
          window.location.href = paymentData.payment_link;
        }, 1000);
        return;
      }

      setSubmitted(true);

      toast({
        title: "Success!",
        description: "Booking form submitted successfully",
      });

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
        />

        {/* Section 2: Booking Summary */}
        <BookingFormSummary booking={booking} />

        {/* Section 3: Payment Configuration */}
        <div className="space-y-6">
          {/* DEBUG: Remove after testing */}
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-xs font-mono">
              Debug - payment_amount_option: "{booking.payment_amount_option}" 
              (type: {typeof booking.payment_amount_option})
            </p>
            <p className="text-xs font-mono">
              Condition result: {String(booking?.payment_amount_option === 'client_choice')}
            </p>
          </div>

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
          />

          <DigitalSignature
            onSignatureChange={setSignatureData}
          />
        </div>

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
                Submitting...
              </>
            ) : (
              "Submit Booking Form"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
