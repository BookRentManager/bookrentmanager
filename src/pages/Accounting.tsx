import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CreateTaxInvoiceDialog } from "@/components/accounting/CreateTaxInvoiceDialog";
import { FileText, Plus, Download } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function Accounting() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createFromPaymentId, setCreateFromPaymentId] = useState<string | undefined>();

  // Fetch payments without tax invoices (to review)
  const { data: paymentsToReview, isLoading: loadingPayments } = useQuery({
    queryKey: ['payments-to-review'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          bookings (
            reference_code,
            client_name,
            car_model
          )
        `)
        .eq('payment_link_status', 'paid')
        .neq('payment_intent', 'security_deposit')
        .not('paid_at', 'is', null)
        .order('paid_at', { ascending: false });

      if (error) throw error;

      // Filter out payments that already have tax invoices
      const { data: existingInvoices } = await supabase
        .from('tax_invoices')
        .select('payment_id')
        .not('payment_id', 'is', null);

      const invoicedPaymentIds = new Set(
        existingInvoices?.map(inv => inv.payment_id) || []
      );

      return data.filter(payment => !invoicedPaymentIds.has(payment.id));
    }
  });

  // Fetch all tax invoices
  const { data: taxInvoices, isLoading: loadingInvoices } = useQuery({
    queryKey: ['tax-invoices', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('tax_invoices')
        .select(`
          *,
          bookings (
            reference_code,
            car_model
          )
        `)
        .is('deleted_at', null)
        .order('invoice_date', { ascending: false });

      if (searchTerm) {
        query = query.or(`invoice_number.ilike.%${searchTerm}%,client_name.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  const handleCreateFromReceipt = (paymentId: string) => {
    setCreateFromPaymentId(paymentId);
    setCreateDialogOpen(true);
  };

  const handleCreateStandalone = () => {
    setCreateFromPaymentId(undefined);
    setCreateDialogOpen(true);
  };

  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Accounting</h1>
            <p className="text-sm md:text-base text-muted-foreground">Manage tax invoices and review payment receipts</p>
          </div>
          <Button onClick={handleCreateStandalone} size="lg" className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            New Tax Invoice
          </Button>
        </div>

        <Tabs defaultValue="to-review" className="space-y-4">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="to-review" className="flex-1 sm:flex-initial">
              To Review
              {paymentsToReview && paymentsToReview.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {paymentsToReview.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="all-invoices" className="flex-1 sm:flex-initial">All Invoices</TabsTrigger>
          </TabsList>

          <TabsContent value="to-review" className="space-y-3 md:space-y-4">
            {loadingPayments ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : paymentsToReview && paymentsToReview.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground text-sm md:text-base">No payments require invoice creation</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3 md:space-y-4">
                {paymentsToReview?.map((payment) => {
                  const booking = payment.bookings as any;
                  return (
                    <Card key={payment.id}>
                      <CardHeader className="pb-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <CardTitle className="text-base md:text-lg">
                            Payment Receipt - {booking?.reference_code || 'N/A'}
                          </CardTitle>
                          <Button 
                            onClick={() => handleCreateFromReceipt(payment.id)}
                            size="sm"
                            className="w-full sm:w-auto"
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            Create Tax Invoice
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                          <div>
                            <p className="text-xs md:text-sm text-muted-foreground">Client</p>
                            <p className="font-medium text-sm md:text-base">{booking?.client_name || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-xs md:text-sm text-muted-foreground">Car</p>
                            <p className="font-medium text-sm md:text-base">{booking?.car_model || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-xs md:text-sm text-muted-foreground">Amount Paid</p>
                            <p className="font-medium text-sm md:text-base">{payment.currency} {payment.amount}</p>
                          </div>
                          <div>
                            <p className="text-xs md:text-sm text-muted-foreground">Payment Date</p>
                            <p className="font-medium text-sm md:text-base">
                              {payment.paid_at ? format(new Date(payment.paid_at), 'PPP') : 'N/A'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="all-invoices" className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search by invoice number or client name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>

            {loadingInvoices ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : taxInvoices && taxInvoices.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground text-sm md:text-base">No tax invoices found</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3 md:space-y-4">
                {taxInvoices?.map((invoice) => {
                  const booking = invoice.bookings as any;
                  const handleGeneratePDF = async () => {
                    try {
                      await supabase.functions.invoke('generate-tax-invoice-pdf', {
                        body: { invoice_id: invoice.id }
                      });
                      toast.success("PDF generated successfully");
                      queryClient.invalidateQueries({ queryKey: ['tax-invoices'] });
                    } catch (error) {
                      toast.error("Failed to generate PDF");
                      console.error('PDF generation error:', error);
                    }
                  };

                  return (
                    <Card key={invoice.id}>
                      <CardHeader className="pb-3">
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                            <div className="space-y-1">
                              <CardTitle className="text-base md:text-lg">
                                Invoice {invoice.invoice_number}
                              </CardTitle>
                              <p className="text-xs md:text-sm text-muted-foreground">
                                {invoice.client_name}
                                {booking && ` • ${booking.reference_code} - ${booking.car_model}`}
                              </p>
                            </div>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                              {invoice.pdf_url ? (
                                <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
                                  <a href={invoice.pdf_url} target="_blank" rel="noopener noreferrer">
                                    <Download className="mr-2 h-4 w-4" />
                                    Download PDF
                                  </a>
                                </Button>
                              ) : (
                                <Button onClick={handleGeneratePDF} size="sm" variant="outline" className="w-full sm:w-auto">
                                  <FileText className="mr-2 h-4 w-4" />
                                  Generate PDF
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                          <div>
                            <p className="text-xs md:text-sm text-muted-foreground">Amount</p>
                            <p className="font-medium text-sm md:text-base">{invoice.currency} {invoice.total_amount}</p>
                          </div>
                          <div>
                            <p className="text-xs md:text-sm text-muted-foreground">Invoice Date</p>
                            <p className="font-medium text-sm md:text-base">
                              {format(new Date(invoice.invoice_date), 'PPP')}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs md:text-sm text-muted-foreground">VAT ({invoice.vat_rate}%)</p>
                            <p className="font-medium text-sm md:text-base">{invoice.currency} {invoice.vat_amount}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <CreateTaxInvoiceDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        paymentId={createFromPaymentId}
        mode={createFromPaymentId ? 'from_receipt' : 'standalone'}
      />
    </AppLayout>
  );
}
