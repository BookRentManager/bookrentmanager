import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, XCircle, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export default function PostFinanceWebhookTest() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<string>("");
  const [webhookEvent, setWebhookEvent] = useState("payment.succeeded");
  const [transactionId, setTransactionId] = useState("");
  const [payloadFormat, setPayloadFormat] = useState<"legacy" | "modern">("legacy");
  const [response, setResponse] = useState<any>(null);

  // Fetch recent payments for testing
  const { data: payments } = useQuery({
    queryKey: ["test-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(`
          id,
          booking_id,
          amount,
          payment_link_status,
          payment_intent,
          postfinance_transaction_id,
          bookings(reference_code, client_name)
        `)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
  });

  const sendTestWebhook = async () => {
    if (!transactionId) {
      toast({
        title: "Missing transaction ID",
        description: "Please enter a PostFinance transaction ID",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setResponse(null);

    try {
      // Construct mock webhook payload based on format selection
      let mockPayload: any;
      
      if (payloadFormat === "modern") {
        // Modern/Event format with nested data object
        const statusMap: Record<string, string> = {
          "payment.succeeded": "fulfilled",
          "payment.failed": "failed",
          "authorization.succeeded": "authorized",
          "session.expired": "expired",
        };
        
        mockPayload = {
          event: {
            id: `evt_${Date.now()}`,
            type: webhookEvent,
            created_at: new Date().toISOString(),
          },
          data: {
            transaction_id: transactionId,
            id: transactionId,
            status: statusMap[webhookEvent] || "pending",
            space_id: 35129,
            amount: 100.00,
            currency: "EUR",
          },
          webhookListenerId: "619627",
        };
      } else {
        // Legacy/Transaction format (flat structure)
        mockPayload = {
          eventId: `test_${Date.now()}`,
          entityId: transactionId,
          state: webhookEvent === "payment.succeeded" ? "COMPLETED" : 
                 webhookEvent === "payment.failed" ? "FAILED" : 
                 webhookEvent === "authorization.succeeded" ? "AUTHORIZED" : "PENDING",
          type: webhookEvent,
          listenerEntityTechnicalName: "Transaction",
          spaceId: 35129,
          timestamp: new Date().toISOString(),
        };
      }

      console.log("Sending test webhook:", mockPayload);

      // Send to PostFinance webhook endpoint
      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/postfinance-webhook`;
      
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mockPayload),
      });

      const responseData = await res.json();
      
      setResponse({
        status: res.status,
        statusText: res.statusText,
        data: responseData,
      });

      if (res.ok) {
        toast({
          title: "Webhook sent successfully",
          description: "Check the response below and verify payment status updated",
        });

        // Refresh payment status
        if (selectedPayment) {
          const { data: updatedPayment } = await supabase
            .from("payments")
            .select("payment_link_status, paid_at")
            .eq("id", selectedPayment)
            .single();

          console.log("Updated payment status:", updatedPayment);
        }
      } else {
        toast({
          title: "Webhook failed",
          description: responseData.error || "Check response for details",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Test webhook error:", error);
      toast({
        title: "Error sending webhook",
        description: error.message,
        variant: "destructive",
      });
      setResponse({
        error: error.message,
        stack: error.stack,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentData = (paymentId: string) => {
    const payment = payments?.find(p => p.id === paymentId);
    if (payment) {
      setSelectedPayment(paymentId);
      setTransactionId(payment.postfinance_transaction_id || `MOCK_${Date.now()}`);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">PostFinance Webhook Tester</h1>
        <p className="text-muted-foreground">
          Test the PostFinance webhook endpoint locally with mock payloads
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Test Configuration</CardTitle>
          <CardDescription>
            Select a payment or enter a transaction ID to test webhook processing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="payment-select">Select Test Payment (Optional)</Label>
            <Select onValueChange={loadPaymentData}>
              <SelectTrigger id="payment-select">
                <SelectValue placeholder="Choose a recent payment..." />
              </SelectTrigger>
              <SelectContent>
                {payments?.map((payment: any) => (
                  <SelectItem key={payment.id} value={payment.id}>
                    {payment.bookings?.reference_code} - {payment.bookings?.client_name} - 
                    {payment.payment_link_status} - €{payment.amount}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="transaction-id">PostFinance Transaction ID</Label>
            <Input
              id="transaction-id"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder="e.g., MOCK_12345 or existing transaction ID"
            />
            <p className="text-xs text-muted-foreground">
              Use MOCK_ prefix for test mode, or enter actual transaction ID from payments table
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="webhook-event">Webhook Event Type</Label>
              <Select value={webhookEvent} onValueChange={setWebhookEvent}>
                <SelectTrigger id="webhook-event">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="payment.succeeded">
                    payment.succeeded (Marks payment as paid)
                  </SelectItem>
                  <SelectItem value="payment.failed">
                    payment.failed (Marks payment as cancelled)
                  </SelectItem>
                  <SelectItem value="authorization.succeeded">
                    authorization.succeeded (Security deposit authorized)
                  </SelectItem>
                  <SelectItem value="session.expired">
                    session.expired (Payment link expired)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payload-format">Payload Format</Label>
              <Select value={payloadFormat} onValueChange={(v) => setPayloadFormat(v as "legacy" | "modern")}>
                <SelectTrigger id="payload-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="legacy">
                    Legacy (flat entityId/state)
                  </SelectItem>
                  <SelectItem value="modern">
                    Modern (nested data object)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Modern format uses data.transaction_id and data.status
              </p>
            </div>
          </div>

          <Button 
            onClick={sendTestWebhook} 
            disabled={loading || !transactionId}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending webhook...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Test Webhook
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {response && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {response.status === 200 ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Webhook Response (Success)
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-destructive" />
                  Webhook Response (Error)
                </>
              )}
            </CardTitle>
            <CardDescription>
              Status: {response.status} {response.statusText}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label>Response Data</Label>
                <Textarea
                  value={JSON.stringify(response.data || response, null, 2)}
                  readOnly
                  className="font-mono text-sm h-64 mt-2"
                />
              </div>

              {selectedPayment && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-2">Next Steps:</p>
                  <ol className="text-sm space-y-1 list-decimal list-inside">
                    <li>Check the response above for any errors</li>
                    <li>Verify payment status in the Payments table</li>
                    <li>Check edge function logs for detailed processing info</li>
                    <li>Verify booking status was updated if applicable</li>
                  </ol>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Testing Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="font-medium mb-1">Test Scenarios:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li><strong>Successful Payment:</strong> Use payment.succeeded event with existing payment's transaction ID</li>
              <li><strong>New Test Payment:</strong> Use MOCK_ prefix for transaction ID to bypass signature verification</li>
              <li><strong>Failed Payment:</strong> Use payment.failed to test cancellation flow</li>
              <li><strong>Security Deposit:</strong> Use authorization.succeeded for deposit testing</li>
            </ul>
          </div>

          <div>
            <p className="font-medium mb-1">What the Webhook Does:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Updates payment status (pending → paid/cancelled)</li>
              <li>Sets paid_at timestamp for successful payments</li>
              <li>Triggers database trigger to update booking.amount_paid</li>
              <li>Auto-confirms booking if payment threshold reached</li>
              <li>Sends confirmation email via trigger</li>
              <li>Generates balance payment link after initial payment</li>
            </ul>
          </div>

          <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
            <p className="text-amber-900 dark:text-amber-100 text-xs">
              <strong>Note:</strong> MOCK_ transaction IDs skip signature verification for testing.
              Production webhooks from PostFinance will use real transaction IDs and HMAC-SHA256 verification.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
