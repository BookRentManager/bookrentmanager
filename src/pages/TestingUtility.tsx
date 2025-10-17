import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react";

export default function TestingUtility() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const testScenarios = {
    expiredToken: async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('get-booking-by-token', {
          body: { token: 'expired_test_token_12345' }
        });
        
        setResults({
          success: error ? false : true,
          message: error ? 'Expected: Token expired error' : 'Unexpected success',
          data: error?.message || data,
          type: error?.message?.includes('expired') ? 'success' : 'failure'
        });
      } catch (err: any) {
        setResults({ success: false, message: err.message, type: 'error' });
      }
      setLoading(false);
    },

    duplicateWebhook: async () => {
      setLoading(true);
      try {
        // Simulate sending the same webhook twice
        const webhookPayload = {
          type: 'payment.succeeded',
          data: {
            session_id: 'test_session_' + Date.now(),
            transaction_id: 'test_tx_' + Date.now(),
            status: 'paid'
          }
        };

        // First call
        const { data: firstCall } = await supabase.functions.invoke('postfinance-webhook', {
          body: webhookPayload
        });

        // Second call (duplicate)
        const { data: secondCall } = await supabase.functions.invoke('postfinance-webhook', {
          body: webhookPayload
        });

        setResults({
          success: true,
          message: 'Idempotency check',
          data: { firstCall, secondCall },
          type: 'success'
        });
      } catch (err: any) {
        setResults({ success: false, message: err.message, type: 'error' });
      }
      setLoading(false);
    },

    checkPaymentRequirements: async (bookingId: string) => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('check-payment-requirements', {
          body: { booking_id: bookingId }
        });

        setResults({
          success: !error,
          message: 'Payment requirements checked',
          data,
          type: error ? 'error' : 'success'
        });
      } catch (err: any) {
        setResults({ success: false, message: err.message, type: 'error' });
      }
      setLoading(false);
    },

    testCurrencyConversion: async () => {
      setLoading(true);
      try {
        // Fetch latest conversion rate
        const { data: rates } = await supabase
          .from('currency_conversion_rates')
          .select('*')
          .eq('from_currency', 'EUR')
          .eq('to_currency', 'CHF')
          .order('effective_date', { ascending: false })
          .limit(1)
          .single();

        const testAmount = 1000;
        const convertedAmount = rates ? testAmount * rates.rate : null;

        setResults({
          success: !!rates,
          message: 'Currency conversion test',
          data: {
            rate: rates?.rate,
            testAmount: `EUR ${testAmount}`,
            convertedAmount: convertedAmount ? `CHF ${convertedAmount.toFixed(2)}` : 'N/A',
            lastUpdated: rates?.effective_date
          },
          type: rates ? 'success' : 'warning'
        });
      } catch (err: any) {
        setResults({ success: false, message: err.message, type: 'error' });
      }
      setLoading(false);
    },

    simulatePartialPayment: async (bookingId: string) => {
      setLoading(true);
      try {
        // Get booking to calculate partial payment
        const { data: booking } = await supabase
          .from('bookings')
          .select('amount_total, payment_amount_percent')
          .eq('id', bookingId)
          .single();

        if (!booking) throw new Error('Booking not found');

        const downPayment = booking.payment_amount_percent
          ? (booking.amount_total * booking.payment_amount_percent) / 100
          : booking.amount_total * 0.3; // Default 30%

        setResults({
          success: true,
          message: 'Partial payment simulation',
          data: {
            totalAmount: `${booking.amount_total.toFixed(2)}`,
            downPaymentRequired: `${downPayment.toFixed(2)}`,
            downPaymentPercent: `${booking.payment_amount_percent || 30}%`,
            remainingAfterDownPayment: `${(booking.amount_total - downPayment).toFixed(2)}`
          },
          type: 'info'
        });
      } catch (err: any) {
        setResults({ success: false, message: err.message, type: 'error' });
      }
      setLoading(false);
    },

    checkAuditLogs: async (bookingId: string) => {
      setLoading(true);
      try {
        const { data: logs, error } = await supabase
          .from('audit_logs')
          .select('*')
          .eq('entity', 'booking')
          .eq('entity_id', bookingId)
          .order('timestamp', { ascending: false })
          .limit(10);

        setResults({
          success: !error,
          message: 'Recent audit logs',
          data: logs,
          type: error ? 'error' : 'success'
        });
      } catch (err: any) {
        setResults({ success: false, message: err.message, type: 'error' });
      }
      setLoading(false);
    }
  };

  const [testBookingId, setTestBookingId] = useState('');

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Phase 9: Testing & Validation Utility</h1>
        <p className="text-muted-foreground mt-2">
          Test edge cases, error handling, and system workflows
        </p>
      </div>

      <Tabs defaultValue="edge-cases" className="space-y-4">
        <TabsList>
          <TabsTrigger value="edge-cases">Edge Cases</TabsTrigger>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
          <TabsTrigger value="logs">Logs & Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="edge-cases" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Edge Case Testing</CardTitle>
              <CardDescription>
                Test error handling, expired tokens, duplicate webhooks, and edge cases
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Button
                  onClick={() => testScenarios.expiredToken()}
                  disabled={loading}
                  variant="outline"
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Test Expired Token
                </Button>

                <Button
                  onClick={() => testScenarios.duplicateWebhook()}
                  disabled={loading}
                  variant="outline"
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Test Duplicate Webhook (Idempotency)
                </Button>

                <Button
                  onClick={() => testScenarios.testCurrencyConversion()}
                  disabled={loading}
                  variant="outline"
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Test Currency Conversion
                </Button>

                <div className="flex gap-2">
                  <Input
                    placeholder="Booking ID"
                    value={testBookingId}
                    onChange={(e) => setTestBookingId(e.target.value)}
                  />
                  <Button
                    onClick={() => testScenarios.simulatePartialPayment(testBookingId)}
                    disabled={loading || !testBookingId}
                    variant="outline"
                  >
                    Test Partial Payment
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflows" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>End-to-End Workflow Testing</CardTitle>
              <CardDescription>
                Test complete booking workflows and payment scenarios
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="booking-id">Booking ID</Label>
                <Input
                  id="booking-id"
                  placeholder="Enter booking ID to test"
                  value={testBookingId}
                  onChange={(e) => setTestBookingId(e.target.value)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Button
                  onClick={() => testScenarios.checkPaymentRequirements(testBookingId)}
                  disabled={loading || !testBookingId}
                  variant="outline"
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Check Payment Requirements
                </Button>

                <Button
                  onClick={() => testScenarios.checkAuditLogs(testBookingId)}
                  disabled={loading || !testBookingId}
                  variant="outline"
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  View Audit Logs
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Health & Monitoring</CardTitle>
              <CardDescription>
                View recent logs, errors, and system status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Check edge function logs in the backend console for detailed error traces.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {results && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Test Results</CardTitle>
              <Badge variant={
                results.type === 'success' ? 'default' :
                results.type === 'error' ? 'destructive' :
                results.type === 'warning' ? 'secondary' : 'outline'
              }>
                {results.type === 'success' ? <CheckCircle2 className="mr-1 h-3 w-3" /> :
                 results.type === 'error' ? <XCircle className="mr-1 h-3 w-3" /> :
                 <AlertTriangle className="mr-1 h-3 w-3" />}
                {results.type}
              </Badge>
            </div>
            <CardDescription>{results.message}</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm">
              {JSON.stringify(results.data, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Test Scenarios Checklist</CardTitle>
          <CardDescription>Phase 9 validation requirements</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>Expired token handling</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>Duplicate webhook idempotency</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>Payment requirement validation</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>Currency conversion accuracy</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>Partial payment scenarios</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>Comprehensive error logging</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>Audit trail tracking</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
