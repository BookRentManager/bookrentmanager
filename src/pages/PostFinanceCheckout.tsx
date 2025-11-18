import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, CreditCard, Loader2 } from "lucide-react";

const PostFinanceCheckout = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const sessionId = searchParams.get("session_id");
  const paymentId = searchParams.get("payment_id");
  
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [payment, setPayment] = useState<any>(null);
  const [booking, setBooking] = useState<any>(null);

  useEffect(() => {
    if (!sessionId || !paymentId) {
      toast({
        title: "Invalid Payment Link",
        description: "Missing session or payment ID. Please try again.",
        variant: "destructive",
      });
      navigate("/");
      return;
    }

    // Check if this is a test mode transaction
    const isTestMode = sessionId.startsWith('MOCK_');
    
    if (!isTestMode) {
      toast({
        title: "Invalid Request",
        description: "This page is only for test payments. Real payments happen on PostFinance's site.",
        variant: "destructive",
      });
      navigate("/");
      return;
    }

    fetchPaymentDetails();
  }, [sessionId, paymentId, toast, navigate]);

  const fetchPaymentDetails = async () => {
    try {
      setLoading(true);

      // Fetch payment details
      const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .select('*, bookings(reference_code, client_name, amount_total, currency)')
        .eq('id', paymentId)
        .single();

      if (paymentError || !paymentData) {
        throw new Error('Payment not found');
      }

      setPayment(paymentData);
      setBooking(paymentData.bookings);
    } catch (error: any) {
      console.error('Error fetching payment:', error);
      toast({
        title: "Error",
        description: "Failed to load payment details",
        variant: "destructive",
      });
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSimulation = async (success: boolean) => {
    try {
      setProcessing(true);

      // Call the webhook endpoint to simulate PostFinance webhook
      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/postfinance-webhook`;
      
      const webhookPayload = {
        entityId: sessionId,
        state: success ? 'COMPLETED' : 'FAILED',
        entity: 'Transaction',
        eventTimestamp: new Date().toISOString(),
        listenerEntityId: payment.booking_id,
        listenerEntityTechnicalName: 'Transaction',
        spaceId: 'MOCK_SPACE',
        webhookListenerId: 'MOCK_LISTENER',
      };

      console.log('Simulating webhook with payload:', webhookPayload);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Webhook simulation failed:', errorText);
        throw new Error('Failed to process payment simulation');
      }

      // Show success/failure message
      toast({
        title: success ? "Payment Successful!" : "Payment Failed",
        description: success 
          ? "Your test payment has been processed successfully."
          : "Your test payment has been cancelled.",
        variant: success ? "default" : "destructive",
      });

      // Redirect to client portal after a short delay
      setTimeout(() => {
        navigate(`/client-portal/${payment.booking_id}`);
      }, 2000);

    } catch (error: any) {
      console.error('Error simulating payment:', error);
      toast({
        title: "Simulation Error",
        description: error.message || "Failed to simulate payment",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <CreditCard className="w-8 h-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-center text-2xl">Test Payment Simulation</CardTitle>
          <CardDescription className="text-center">
            This is a test payment page for development
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {booking && (
            <>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Booking Reference:</span>
                  <span className="font-semibold">{booking.reference_code}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Client Name:</span>
                  <span className="font-semibold">{booking.client_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Payment Amount:</span>
                  <span className="font-semibold">
                    {payment.currency} {payment.amount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Payment Type:</span>
                  <span className="font-semibold capitalize">{payment.payment_intent?.replace('_', ' ')}</span>
                </div>
              </div>

              <Alert>
                <AlertDescription className="text-sm">
                  🧪 <strong>Test Mode:</strong> This is a simulated payment page. 
                  Click one of the buttons below to simulate payment success or failure.
                </AlertDescription>
              </Alert>
            </>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button
            onClick={() => handlePaymentSimulation(true)}
            className="w-full"
            size="lg"
            disabled={processing}
          >
            {processing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Simulate Payment Success
              </>
            )}
          </Button>
          
          <Button
            onClick={() => handlePaymentSimulation(false)}
            variant="outline"
            className="w-full"
            size="lg"
            disabled={processing}
          >
            <XCircle className="mr-2 h-4 w-4" />
            Simulate Payment Failed
          </Button>
          
          <Button
            onClick={() => navigate("/")}
            variant="ghost"
            className="w-full"
            size="sm"
            disabled={processing}
          >
            Cancel
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default PostFinanceCheckout;
