import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Webhook, Download, ExternalLink, Play, CreditCard, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";

export default function Integrations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [isTestingPostfinance, setIsTestingPostfinance] = useState(false);
  const [isMagnoliaTestOpen, setIsMagnoliaTestOpen] = useState(false);
  const [isPostfinanceTestOpen, setIsPostfinanceTestOpen] = useState(false);
  
  const [testFormData, setTestFormData] = useState({
    booking_id: `TEST-${new Date().getTime()}`,
    client_name: "John Doe",
    email: "john.doe@example.com",
    phone: "+41 79 123 4567",
    car_brand: "BMW",
    car_model: "X5",
    car_plate: "ZH-12345",
    pickup_location: "Zurich Airport",
    delivery_location: "Geneva City Center",
    pickup_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    return_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    flight_number: "LX1635",
    special_requests: "Need child seat",
    price_total: "1500",
    currency: "EUR",
    supplier_price: "1200",
    vat_rate: "8.1",
    security_deposit: "1000",
    km_included: "500",
    extra_km_cost: "0.50",
  });

  const [postfinanceTestData, setPostfinanceTestData] = useState({
    eventType: 'payment.succeeded',
    bookingId: '',
    amount: '',
    currency: 'EUR',
    sessionId: `test_ses_${Date.now()}`,
    transactionId: `test_txn_${Date.now()}`,
  });

  // Fetch bookings for PostFinance testing
  const { data: bookings } = useQuery({
    queryKey: ['bookings-for-testing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, reference_code, client_name, amount_total, currency')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
  });

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/magnolia-webhook`;

  const handleTestWebhook = async () => {
    setIsTestingWebhook(true);
    
    try {
      // Format dates to ISO 8601 with timezone
      const payload = {
        ...testFormData,
        pickup_date: new Date(testFormData.pickup_date).toISOString(),
        return_date: new Date(testFormData.return_date).toISOString(),
      };

      const { data, error } = await supabase.functions.invoke('magnolia-webhook', {
        body: payload,
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Webhook Test Successful",
        description: `Booking created with reference: ${data.reference_code}`,
      });

      // Invalidate bookings query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['bookings'] });

      // Generate new test booking ID for next test
      setTestFormData(prev => ({
        ...prev,
        booking_id: `TEST-${new Date().getTime()}`,
      }));
      
    } catch (error: any) {
      console.error('Webhook test error:', error);
      toast({
        title: "Webhook Test Failed",
        description: error.message || "Failed to process webhook",
        variant: "destructive",
      });
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setTestFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDownloadInstructions = () => {
    const link = document.createElement('a');
    link.href = '/magnolia-webhook-instructions.md';
    link.download = 'magnolia-webhook-instructions.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({
      title: "Copied to clipboard",
      description: "Webhook URL copied successfully",
    });
  };

  const postfinanceWebhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/postfinance-webhook`;

  const handleCopyPostfinanceUrl = () => {
    navigator.clipboard.writeText(postfinanceWebhookUrl);
    toast({
      title: "Copied to clipboard",
      description: "PostFinance webhook URL copied successfully",
    });
  };

  const handleDownloadPostfinanceInstructions = () => {
    const link = document.createElement('a');
    link.href = '/postfinance-webhook-instructions.md';
    link.download = 'postfinance-webhook-instructions.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBookingSelect = (bookingId: string) => {
    const selectedBooking = bookings?.find(b => b.id === bookingId);
    if (selectedBooking) {
      setPostfinanceTestData(prev => ({
        ...prev,
        bookingId,
        amount: selectedBooking.amount_total.toString(),
        currency: selectedBooking.currency,
      }));
    }
  };

  const handleTestPostfinanceWebhook = async () => {
    if (!postfinanceTestData.bookingId) {
      toast({
        title: "Booking Required",
        description: "Please select a booking to test the webhook",
        variant: "destructive",
      });
      return;
    }

    setIsTestingPostfinance(true);

    try {
      const payload: any = {
        type: postfinanceTestData.eventType,
        data: {
          session_id: postfinanceTestData.sessionId,
          status: postfinanceTestData.eventType === 'payment.succeeded' ? 'paid' : 
                  postfinanceTestData.eventType === 'payment.failed' ? 'failed' : 'expired',
        },
        created_at: new Date().toISOString(),
      };

      // Add transaction ID only for succeeded events
      if (postfinanceTestData.eventType === 'payment.succeeded') {
        payload.data.transaction_id = postfinanceTestData.transactionId;
      }

      // First, create a payment record with the test session ID
      const { error: paymentError } = await supabase
        .from('payments')
        .insert([{
          booking_id: postfinanceTestData.bookingId,
          type: 'full',
          method: 'other',
          amount: parseFloat(postfinanceTestData.amount),
          currency: postfinanceTestData.currency,
          payment_link_status: 'pending',
          postfinance_session_id: postfinanceTestData.sessionId,
          paid_at: new Date().toISOString(),
        }]);

      if (paymentError) throw paymentError;

      // Then trigger the webhook
      const { data, error } = await supabase.functions.invoke('postfinance-webhook', {
        body: payload,
      });

      if (error) throw error;

      toast({
        title: "PostFinance Webhook Test Successful",
        description: `Event ${postfinanceTestData.eventType} processed successfully`,
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking-payments'] });

      // Generate new test IDs for next test
      setPostfinanceTestData(prev => ({
        ...prev,
        sessionId: `test_ses_${Date.now()}`,
        transactionId: `test_txn_${Date.now()}`,
      }));

    } catch (error: any) {
      console.error('PostFinance webhook test error:', error);
      toast({
        title: "Webhook Test Failed",
        description: error.message || "Failed to process webhook",
        variant: "destructive",
      });
    } finally {
      setIsTestingPostfinance(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Integrations</h2>
        <p className="text-sm md:text-base text-muted-foreground">
          Connect external services and automate your workflow
        </p>
      </div>

      <Tabs defaultValue="magnolia" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="magnolia" className="gap-2">
            <Webhook className="h-4 w-4" />
            <span className="hidden sm:inline">Magnolia CMS</span>
            <span className="sm:hidden">Magnolia</span>
          </TabsTrigger>
          <TabsTrigger value="postfinance" className="gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">PostFinance</span>
            <span className="sm:hidden">Payment</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="magnolia" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Webhook className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Magnolia CMS Webhook</CardTitle>
              </div>
              <CardDescription>
                Receive and process booking data automatically from your Magnolia CMS website
              </CardDescription>
            </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">Active</Badge>
              <span className="text-sm text-muted-foreground">Ready to receive webhooks</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              This webhook endpoint automatically creates new bookings when your Magnolia CMS website sends booking form submissions. 
              All data is validated and securely stored in your database.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">API Endpoint URL</label>
            <div className="flex gap-2">
              <code className="flex-1 px-3 py-2 text-xs bg-muted rounded-md overflow-x-auto whitespace-nowrap">
                {webhookUrl}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyUrl}
              >
                Copy
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use this endpoint URL in your Magnolia CMS webhook configuration
            </p>
          </div>

          <div className="pt-4 space-y-3">
            <h4 className="text-sm font-medium">Setup & Configuration</h4>
            <p className="text-sm text-muted-foreground">
              Download the complete integration guide to configure this webhook in your Magnolia CMS.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="default"
                onClick={handleDownloadInstructions}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Download Instructions
              </Button>
              
              <Button
                variant="outline"
                asChild
              >
                <a 
                  href="/magnolia-webhook-instructions.md" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  View Instructions
                </a>
              </Button>
            </div>
          </div>

          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium mb-3">Webhook Features</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">✓</span>
                <span>Automatic booking creation from Magnolia CMS form submissions</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">✓</span>
                <span>Real-time updates when booking details change in Magnolia</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">✓</span>
                <span>Secure authentication with secret key verification</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">✓</span>
                <span>Duplicate prevention using unique reference codes</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">✓</span>
                <span>Complete field validation and error handling</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">✓</span>
                <span>Bi-directional synchronization for data consistency</span>
              </li>
            </ul>

            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium mb-1">📋 How Updates Work</p>
              <p className="text-xs text-muted-foreground">
                When Magnolia sends an update for an existing booking (same booking_id), 
                this webhook automatically updates the booking data in your system, ensuring 
                both platforms stay in sync.
              </p>
            </div>
          </div>

          {/* Test Integration Section */}
          <div className="pt-4 border-t">
            <Collapsible open={isMagnoliaTestOpen} onOpenChange={setIsMagnoliaTestOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-4 h-auto">
                  <div className="flex items-center gap-2">
                    <Play className="h-4 w-4" />
                    <span className="font-medium">Test Integration</span>
                  </div>
                  {isMagnoliaTestOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-4 pb-4 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Simulate a webhook call from Magnolia CMS to test your integration
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="booking_id">Booking Reference *</Label>
                    <Input
                      id="booking_id"
                      value={testFormData.booking_id}
                      onChange={(e) => handleInputChange('booking_id', e.target.value)}
                      placeholder="TEST-001"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="client_name">Client Name *</Label>
                    <Input
                      id="client_name"
                      value={testFormData.client_name}
                      onChange={(e) => handleInputChange('client_name', e.target.value)}
                      placeholder="John Doe"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={testFormData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="john@example.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={testFormData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="+41 79 123 4567"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="car_brand">Car Brand</Label>
                    <Input
                      id="car_brand"
                      value={testFormData.car_brand}
                      onChange={(e) => handleInputChange('car_brand', e.target.value)}
                      placeholder="BMW"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="car_model">Car Model *</Label>
                    <Input
                      id="car_model"
                      value={testFormData.car_model}
                      onChange={(e) => handleInputChange('car_model', e.target.value)}
                      placeholder="X5"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="car_plate">Car Plate</Label>
                    <Input
                      id="car_plate"
                      value={testFormData.car_plate}
                      onChange={(e) => handleInputChange('car_plate', e.target.value)}
                      placeholder="ZH-12345"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pickup_location">Pickup Location *</Label>
                    <Input
                      id="pickup_location"
                      value={testFormData.pickup_location}
                      onChange={(e) => handleInputChange('pickup_location', e.target.value)}
                      placeholder="Zurich Airport"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="delivery_location">Delivery Location *</Label>
                    <Input
                      id="delivery_location"
                      value={testFormData.delivery_location}
                      onChange={(e) => handleInputChange('delivery_location', e.target.value)}
                      placeholder="Geneva"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pickup_date">Pickup Date *</Label>
                    <Input
                      id="pickup_date"
                      type="datetime-local"
                      value={testFormData.pickup_date}
                      onChange={(e) => handleInputChange('pickup_date', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="return_date">Return Date *</Label>
                    <Input
                      id="return_date"
                      type="datetime-local"
                      value={testFormData.return_date}
                      onChange={(e) => handleInputChange('return_date', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="price_total">Total Price *</Label>
                    <Input
                      id="price_total"
                      value={testFormData.price_total}
                      onChange={(e) => handleInputChange('price_total', e.target.value)}
                      placeholder="1500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Input
                      id="currency"
                      value={testFormData.currency}
                      onChange={(e) => handleInputChange('currency', e.target.value)}
                      placeholder="EUR"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="supplier_price">Supplier Price</Label>
                    <Input
                      id="supplier_price"
                      value={testFormData.supplier_price}
                      onChange={(e) => handleInputChange('supplier_price', e.target.value)}
                      placeholder="1200"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vat_rate">VAT Rate (%)</Label>
                    <Input
                      id="vat_rate"
                      value={testFormData.vat_rate}
                      onChange={(e) => handleInputChange('vat_rate', e.target.value)}
                      placeholder="8.1"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="security_deposit">Security Deposit</Label>
                    <Input
                      id="security_deposit"
                      value={testFormData.security_deposit}
                      onChange={(e) => handleInputChange('security_deposit', e.target.value)}
                      placeholder="1000"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="km_included">KM Included</Label>
                    <Input
                      id="km_included"
                      value={testFormData.km_included}
                      onChange={(e) => handleInputChange('km_included', e.target.value)}
                      placeholder="500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="extra_km_cost">Extra KM Cost</Label>
                    <Input
                      id="extra_km_cost"
                      value={testFormData.extra_km_cost}
                      onChange={(e) => handleInputChange('extra_km_cost', e.target.value)}
                      placeholder="0.50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="flight_number">Flight Number</Label>
                    <Input
                      id="flight_number"
                      value={testFormData.flight_number}
                      onChange={(e) => handleInputChange('flight_number', e.target.value)}
                      placeholder="LX1635"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="special_requests">Special Requests</Label>
                  <Textarea
                    id="special_requests"
                    value={testFormData.special_requests}
                    onChange={(e) => handleInputChange('special_requests', e.target.value)}
                    placeholder="Any special requirements..."
                    rows={3}
                  />
                </div>

                <div className="pt-4 border-t">
                  <Button
                    onClick={handleTestWebhook}
                    disabled={isTestingWebhook}
                    className="w-full sm:w-auto gap-2"
                  >
                    <Play className="h-4 w-4" />
                    {isTestingWebhook ? "Testing Webhook..." : "Test Webhook"}
                  </Button>
                  <p className="text-sm text-muted-foreground mt-2">
                    This will create a test booking. Check the Bookings page to verify the result.
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="postfinance" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <CardTitle>PostFinance Checkout Webhook</CardTitle>
              </div>
              <CardDescription>
                Receive payment status updates automatically from PostFinance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">Active</Badge>
                  <span className="text-sm text-muted-foreground">Ready to receive payment webhooks</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  This webhook endpoint automatically processes payment status updates when clients complete payments through PostFinance Checkout. 
                  Payment confirmations, failures, and session expirations are handled in real-time.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Webhook Endpoint URL</label>
                <div className="flex gap-2">
                  <code className="flex-1 px-3 py-2 text-xs bg-muted rounded-md overflow-x-auto whitespace-nowrap">
                    {postfinanceWebhookUrl}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyPostfinanceUrl}
                  >
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Configure this endpoint URL in your PostFinance merchant dashboard
                </p>
              </div>

              <div className="pt-4 space-y-3">
                <h4 className="text-sm font-medium">Setup & Configuration</h4>
                <p className="text-sm text-muted-foreground">
                  Download the complete integration guide to configure PostFinance webhooks and payment processing.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="default"
                    onClick={handleDownloadPostfinanceInstructions}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download Instructions
                  </Button>
                  
                  <Button
                    variant="outline"
                    asChild
                  >
                    <a 
                      href="/postfinance-webhook-instructions.md" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="gap-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      View Instructions
                    </a>
                  </Button>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h4 className="text-sm font-medium mb-3">Webhook Features</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">✓</span>
                    <span>Real-time payment status updates (succeeded, failed, expired)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">✓</span>
                    <span>Automatic booking confirmation when down payment received</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">✓</span>
                    <span>Client invoice status synchronization</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">✓</span>
                    <span>Secure signature verification for all webhook events</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">✓</span>
                    <span>Transaction ID tracking and payment reconciliation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">✓</span>
                    <span>Idempotent event processing to prevent duplicates</span>
                  </li>
                </ul>

                <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium mb-1">🔄 Auto-Confirmation Logic</p>
                  <p className="text-xs text-muted-foreground">
                    When a down payment is successfully received, the booking status automatically changes to 
                    "confirmed". The system tracks total payments and updates booking status accordingly.
                  </p>
                </div>

                <div className="mt-4 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                  <p className="text-sm font-medium mb-1 text-warning">⚙️ Configuration Required</p>
                  <p className="text-xs text-muted-foreground">
                    You must configure POSTFINANCE_WEBHOOK_SECRET in your backend settings to verify 
                    webhook signatures. See the setup instructions for details.
                  </p>
                </div>
              </div>

              {/* Test Integration Section */}
              <div className="pt-4 border-t">
                <Collapsible open={isPostfinanceTestOpen} onOpenChange={setIsPostfinanceTestOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between p-4 h-auto">
                      <div className="flex items-center gap-2">
                        <Play className="h-4 w-4" />
                        <span className="font-medium">Test Integration</span>
                      </div>
                      {isPostfinanceTestOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-4 pb-4 space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Simulate PostFinance webhook events to test payment processing
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="event_type">Event Type *</Label>
                        <Select
                          value={postfinanceTestData.eventType}
                          onValueChange={(value) => setPostfinanceTestData(prev => ({ ...prev, eventType: value }))}
                        >
                          <SelectTrigger id="event_type">
                            <SelectValue placeholder="Select event type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="payment.succeeded">Payment Succeeded</SelectItem>
                            <SelectItem value="payment.failed">Payment Failed</SelectItem>
                            <SelectItem value="session.expired">Session Expired</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="booking_select">Select Booking *</Label>
                        <Select
                          value={postfinanceTestData.bookingId}
                          onValueChange={handleBookingSelect}
                        >
                          <SelectTrigger id="booking_select">
                            <SelectValue placeholder="Choose a booking" />
                          </SelectTrigger>
                          <SelectContent>
                            {bookings?.map((booking) => (
                              <SelectItem key={booking.id} value={booking.id}>
                                {booking.reference_code} - {booking.client_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="amount">Amount</Label>
                        <Input
                          id="amount"
                          type="number"
                          value={postfinanceTestData.amount}
                          onChange={(e) => setPostfinanceTestData(prev => ({ ...prev, amount: e.target.value }))}
                          placeholder="750.00"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="pf_currency">Currency</Label>
                        <Input
                          id="pf_currency"
                          value={postfinanceTestData.currency}
                          onChange={(e) => setPostfinanceTestData(prev => ({ ...prev, currency: e.target.value }))}
                          placeholder="EUR"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="session_id">Session ID (auto-generated)</Label>
                        <Input
                          id="session_id"
                          value={postfinanceTestData.sessionId}
                          readOnly
                          className="bg-muted"
                        />
                      </div>

                      {postfinanceTestData.eventType === 'payment.succeeded' && (
                        <div className="space-y-2">
                          <Label htmlFor="transaction_id">Transaction ID (auto-generated)</Label>
                          <Input
                            id="transaction_id"
                            value={postfinanceTestData.transactionId}
                            readOnly
                            className="bg-muted"
                          />
                        </div>
                      )}
                    </div>

                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm font-medium mb-1">ℹ️ Test Event Details</p>
                      <p className="text-xs text-muted-foreground">
                        {postfinanceTestData.eventType === 'payment.succeeded' && 
                          "This will mark the payment as paid, update booking amount, and may auto-confirm the booking if down payment threshold is met."}
                        {postfinanceTestData.eventType === 'payment.failed' && 
                          "This will mark the payment as failed and not update booking amounts."}
                        {postfinanceTestData.eventType === 'session.expired' && 
                          "This will mark the payment link as expired without creating a payment."}
                      </p>
                    </div>

                    <div className="pt-4 border-t">
                      <Button
                        onClick={handleTestPostfinanceWebhook}
                        disabled={isTestingPostfinance}
                        className="w-full sm:w-auto gap-2"
                      >
                        <Play className="h-4 w-4" />
                        {isTestingPostfinance ? "Testing Webhook..." : "Test Webhook"}
                      </Button>
                      <p className="text-sm text-muted-foreground mt-2">
                        This will simulate a PostFinance webhook event. Check the booking details to verify the result.
                      </p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Additional Integrations</CardTitle>
          <CardDescription>
            More integration options will be available soon. Contact support if you need a specific integration.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
