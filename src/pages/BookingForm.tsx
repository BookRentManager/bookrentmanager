import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { BookingFormSummary } from "@/components/booking-form/BookingFormSummary";
import { TermsAndConditions } from "@/components/booking-form/TermsAndConditions";
import { DigitalSignature } from "@/components/booking-form/DigitalSignature";
import { PaymentMethodSelector } from "@/components/booking-form/PaymentMethodSelector";
import { PaymentBreakdown } from "@/components/booking-form/PaymentBreakdown";
import { ClientInformationForm } from "@/components/booking-form/ClientInformationForm";
import { PaymentAmountSelector } from "@/components/booking-form/PaymentAmountSelector";
import { Loader2, CheckCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const formSchema = z.object({
  client_name: z.string(),
  client_email: z.string(),
  client_phone: z.string().min(1, "Phone number is required"),
  billing_address: z.string().min(1, "Billing address is required"),
  country: z.string().min(1, "Country is required"),
  company_name: z.string().optional(),
});

export default function BookingForm() {
  const { token } = useParams<{ token: string }>();
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
  const [paymentChoice, setPaymentChoice] = useState<'down_payment' | 'full_payment'>('down_payment');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      client_name: "",
      client_email: "",
      client_phone: "",
      billing_address: "",
      country: "",
      company_name: "",
    },
  });

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
      if (data.error) throw new Error(data.error);

      console.log('Booking data loaded:', data.booking);

      setBooking(data.booking);
      setTermsAndConditions(data.terms_and_conditions);
      setPaymentMethods(data.payment_methods);

      // Populate form with booking data - ensure all fields have string values
      const formData = {
        client_name: data.booking.client_name || "",
        client_email: data.booking.client_email || "",
        client_phone: data.booking.client_phone || "",
        billing_address: data.booking.billing_address || "",
        country: data.booking.country || "Switzerland",
        company_name: data.booking.company_name || "",
      };
      
      console.log('Form data to populate:', formData);
      form.reset(formData);

      // Check if already submitted
      if (data.booking.tc_accepted_at) {
        setSubmitted(true);
      }

      // Pre-select first available payment method
      if (data.payment_methods?.length > 0 && !data.booking.tc_accepted_at) {
        setSelectedPaymentMethod(data.payment_methods[0].method_type);
      }
      setManualInstructions(data.booking.manual_payment_instructions || "");

      // Set default payment choice based on payment_amount_percent
      if (data.booking.payment_amount_percent && data.booking.payment_amount_percent < 100) {
        setPaymentChoice('down_payment');
      } else {
        setPaymentChoice('full_payment');
      }

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

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
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
          client_phone: values.client_phone,
          billing_address: values.billing_address,
          country: values.country,
          company_name: values.company_name,
          payment_choice: paymentChoice,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Check if payment method requires card payment
      const paymentMethod = paymentMethods.find(pm => pm.method_type === selectedPaymentMethod);
      const isCardPayment = paymentMethod?.method_type?.includes('visa') || 
                           paymentMethod?.method_type?.includes('mastercard') ||
                           paymentMethod?.method_type?.includes('amex');

      if (isCardPayment) {
        // Calculate payment amount based on choice
        let paymentAmount;
        if (paymentChoice === 'full_payment') {
          paymentAmount = booking.amount_total;
        } else {
          const downPaymentPercent = booking.payment_amount_percent || 100;
          paymentAmount = (booking.amount_total * downPaymentPercent) / 100;
        }

        // Create PostFinance payment link
        const { data: paymentData, error: paymentError } = await supabase.functions.invoke(
          'create-postfinance-payment-link',
          {
            body: {
              booking_id: booking.id,
              amount: paymentAmount,
              payment_type: 'deposit',
              payment_intent: paymentChoice === 'full_payment' ? 'final_payment' : 'down_payment',
              expires_in_hours: 48,
              description: `${paymentChoice === 'full_payment' ? 'Full payment' : 'Down payment'} for booking ${booking.reference_code}`,
              send_email: true,
            },
          }
        );

        if (paymentError) throw paymentError;

        // Redirect to PostFinance checkout
        if (paymentData?.payment_link) {
          toast({
            title: "Redirecting to Payment",
            description: "Please complete your payment to confirm the booking",
          });
          
          setTimeout(() => {
            window.location.href = paymentData.payment_link;
          }, 1000);
          return;
        }
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
            Please review and complete the information below to finalize your booking.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
            {/* Section 1: Client Information */}
            <section>
              <ClientInformationForm form={form} />
            </section>

            <Separator />

            {/* Section 2: Booking Summary */}
            <section>
              <BookingFormSummary booking={booking} />
            </section>

            <Separator />

            {/* Section 3: Payment Selection */}
            <section className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold">Payment Details</h2>
                <p className="text-muted-foreground">
                  Choose your payment amount and method
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PaymentAmountSelector
                  totalAmount={booking.amount_total}
                  downPaymentPercent={booking.payment_amount_percent}
                  selectedChoice={paymentChoice}
                  onChoiceChange={setPaymentChoice}
                  currency={booking.currency}
                />

                <PaymentMethodSelector
                  paymentMethods={paymentMethods}
                  selectedMethod={selectedPaymentMethod}
                  onMethodChange={setSelectedPaymentMethod}
                  manualInstructions={manualInstructions}
                  onInstructionsChange={setManualInstructions}
                />
              </div>

              <PaymentBreakdown
                bookingId={booking.id}
                paymentIntent="client_payment"
                selectedPaymentMethod={selectedPaymentMethod}
                amountOverride={
                  paymentChoice === 'full_payment'
                    ? booking.amount_total
                    : booking.payment_amount_percent
                    ? (booking.amount_total * booking.payment_amount_percent) / 100
                    : booking.amount_total
                }
                currency={booking.currency}
              />
            </section>

            <Separator />

            {/* Section 4: Terms & Signature */}
            <section className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold">Terms & Conditions</h2>
                <p className="text-muted-foreground">
                  Please read and sign to accept
                </p>
              </div>

              <TermsAndConditions
                version={termsAndConditions.version}
                content={termsAndConditions.content}
              />

              <DigitalSignature onSignatureChange={setSignatureData} />
            </section>

            {/* Submit Button */}
            <div className="flex justify-center pt-4">
              <Button
                type="submit"
                size="lg"
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
          </form>
        </Form>
      </div>
    </div>
  );
}
