import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { BookingFormSummary } from "@/components/booking-form/BookingFormSummary";
import { TermsAndConditions } from "@/components/booking-form/TermsAndConditions";
import { DigitalSignature } from "@/components/booking-form/DigitalSignature";
import { PaymentMethodSelector } from "@/components/booking-form/PaymentMethodSelector";
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
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>([]);
  const [manualInstructions, setManualInstructions] = useState("");

  useEffect(() => {
    if (token) {
      fetchBookingData();
    }
  }, [token]);

  const fetchBookingData = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke('get-booking-by-token', {
        body: { token },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setBooking(data.booking);
      setTermsAndConditions(data.terms_and_conditions);
      setPaymentMethods(data.payment_methods);

      // Check if already submitted
      if (data.booking.tc_accepted_at) {
        setSubmitted(true);
      }

      // Pre-select default payment methods
      const defaultMethods = data.booking.available_payment_methods || ["visa_mastercard", "amex", "bank_transfer"];
      setSelectedPaymentMethods(defaultMethods);
      setManualInstructions(data.booking.manual_payment_instructions || "");

    } catch (error: any) {
      console.error('Error fetching booking:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load booking details",
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

    if (selectedPaymentMethods.length === 0) {
      toast({
        title: "Payment Method Required",
        description: "Please select at least one payment method",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);

      // Get client IP (in production, this should be from server)
      const clientIp = "0.0.0.0"; // Placeholder

      const { data, error } = await supabase.functions.invoke('submit-booking-form', {
        body: {
          token,
          tc_signature_data: signatureData,
          tc_accepted_ip: clientIp,
          selected_payment_methods: selectedPaymentMethods,
          manual_payment_instructions: selectedPaymentMethods.includes('manual') ? manualInstructions : null,
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
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

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Summary */}
          <div className="space-y-6">
            <BookingFormSummary booking={booking} />
          </div>

          {/* Right Column - Form */}
          <div className="space-y-6">
            <PaymentMethodSelector
              paymentMethods={paymentMethods}
              selectedMethods={selectedPaymentMethods}
              onSelectionChange={setSelectedPaymentMethods}
              manualInstructions={manualInstructions}
              onInstructionsChange={setManualInstructions}
            />
          </div>
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
            disabled={submitting || !signatureData || selectedPaymentMethods.length === 0}
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
