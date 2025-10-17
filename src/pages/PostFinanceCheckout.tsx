import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CreditCard, CheckCircle, XCircle } from "lucide-react";

const PostFinanceCheckout = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [payment, setPayment] = useState<any>(null);
  const [booking, setBooking] = useState<any>(null);

  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    const fetchPaymentDetails = async () => {
      if (!sessionId) {
        toast({
          title: "Invalid Payment Link",
          description: "No session ID provided",
          variant: "destructive",
        });
        return;
      }

      try {
        // Fetch payment details
        const { data: paymentData, error: paymentError } = await supabase
          .from("payments")
          .select("*, bookings(*)")
          .eq("postfinance_session_id", sessionId)
          .single();

        if (paymentError) throw paymentError;

        setPayment(paymentData);
        setBooking(paymentData.bookings);
      } catch (error: any) {
        console.error("Error fetching payment:", error);
        toast({
          title: "Error",
          description: error.message || "Could not load payment details",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentDetails();
  }, [sessionId, toast]);

  const handlePayment = async (success: boolean) => {
    if (!sessionId) return;

    setProcessing(true);

    try {
      // Simulate webhook call to postfinance-webhook
      const { error } = await supabase.functions.invoke("postfinance-webhook", {
        body: {
          event_type: success ? "payment.succeeded" : "payment.failed",
          session_id: sessionId,
          amount: payment.amount,
          currency: payment.currency,
          transaction_id: `MOCK_TXN_${Date.now()}`,
          timestamp: new Date().toISOString(),
        },
      });

      if (error) throw error;

      if (success) {
        toast({
          title: "Payment Successful!",
          description: "Your booking has been confirmed",
        });
        
        // Redirect to payment confirmation page
        setTimeout(() => {
          navigate(`/payment/confirmation?session_id=${sessionId}&status=success`);
        }, 1500);
      } else {
        toast({
          title: "Payment Failed",
          description: "Your payment could not be processed",
          variant: "destructive",
        });
        
        setTimeout(() => {
          navigate(`/payment/confirmation?session_id=${sessionId}&status=failed`);
        }, 1500);
      }
    } catch (error: any) {
      console.error("Error processing payment:", error);
      toast({
        title: "Error",
        description: error.message || "Could not process payment",
        variant: "destructive",
      });
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center space-x-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Loading payment details...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!payment || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Card className="w-full max-w-md border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <XCircle className="h-6 w-6 text-destructive" />
              <span>Payment Not Found</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This payment link is invalid or has expired.
            </p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => navigate("/")} className="w-full">
              Go to Homepage
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10">
            <CreditCard className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl text-center">PostFinance Payment</CardTitle>
          <CardDescription className="text-center">
            Complete your payment for booking {booking.reference_code}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Payment Details */}
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b">
              <span className="text-muted-foreground">Booking Reference</span>
              <span className="font-semibold">{booking.reference_code}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b">
              <span className="text-muted-foreground">Customer</span>
              <span className="font-semibold">{booking.client_name}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b">
              <span className="text-muted-foreground">Vehicle</span>
              <span className="font-semibold">{booking.car_model}</span>
            </div>
            <div className="flex justify-between items-center pb-4 border-b-2 border-primary/20">
              <span className="text-lg font-semibold">Amount to Pay</span>
              <span className="text-2xl font-bold text-primary">
                {payment.currency} {payment.total_amount?.toFixed(2) || payment.amount.toFixed(2)}
              </span>
            </div>
            
            {payment.fee_amount > 0 && (
              <div className="text-xs text-muted-foreground space-y-1 bg-muted/50 p-3 rounded-md">
                <div className="flex justify-between">
                  <span>Original amount:</span>
                  <span>{payment.currency} {payment.original_amount?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Processing fee ({payment.fee_percentage}%):</span>
                  <span>{payment.currency} {payment.fee_amount?.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Mock Payment Info */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-100 font-medium mb-2">
              🧪 Test Payment Mode
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              This is a simulated payment. Click "Pay Now" to simulate a successful payment, 
              or "Cancel" to simulate a failed payment.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-3">
          <Button
            onClick={() => handlePayment(true)}
            disabled={processing}
            className="w-full"
            size="lg"
          >
            {processing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-5 w-5" />
                Pay Now
              </>
            )}
          </Button>
          <Button
            onClick={() => handlePayment(false)}
            disabled={processing}
            variant="outline"
            className="w-full"
            size="lg"
          >
            <XCircle className="mr-2 h-5 w-5" />
            Cancel Payment
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default PostFinanceCheckout;
