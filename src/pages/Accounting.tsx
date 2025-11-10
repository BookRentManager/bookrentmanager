import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CreateTaxInvoiceDialog } from "@/components/accounting/CreateTaxInvoiceDialog";
import { FileText, Plus, Download, Search, Eye } from "lucide-react";
import { format } from "date-fns";

export default function Accounting() {
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
        .not('payment_intent', 'eq', 'security_deposit')
        .is('paid_at', 'not.null')
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
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Accounting & Tax Invoices</h1>
          <p className="text-muted-foreground">
            Manage tax invoices for accounting purposes
          </p>
        </div>

        <Tabs defaultValue="to-review" className="space-y-4">
          <TabsList>
            <TabsTrigger value="to-review">
              To Review
              {paymentsToReview && paymentsToReview.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {paymentsToReview.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="all-invoices">All Invoices</TabsTrigger>
          </TabsList>

          <TabsContent value="to-review" className="space-y-4">
            <Card className="p-6">
              <div className="mb-4">
                <h3 className="font-semibold mb-2">Payment Receipts to Review</h3>
                <p className="text-sm text-muted-foreground">
                  Create tax invoices from payment receipts
                </p>
              </div>

              {loadingPayments ? (
                <p className="text-center py-8 text-muted-foreground">Loading receipts...</p>
              ) : paymentsToReview && paymentsToReview.length > 0 ? (
                <div className="space-y-2">
                  {paymentsToReview.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                    >
                      <div className="flex-1">
                        <div className="font-medium">
                          {payment.bookings?.reference_code} - {payment.bookings?.client_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {payment.bookings?.car_model} • Paid: {payment.paid_at ? format(new Date(payment.paid_at), 'PPP') : 'N/A'}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-semibold">
                            {payment.currency} {Number(payment.amount).toFixed(2)}
                          </div>
                          {payment.receipt_url && (
                            <a
                              href={payment.receipt_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" />
                              View Receipt
                            </a>
                          )}
                        </div>
                        <Button onClick={() => handleCreateFromReceipt(payment.id)}>
                          <FileText className="w-4 h-4 mr-2" />
                          Create Invoice
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">
                  No payment receipts to review
                </p>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="all-invoices" className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by invoice number or client name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button onClick={handleCreateStandalone}>
                <Plus className="w-4 h-4 mr-2" />
                New Invoice
              </Button>
            </div>

            <Card className="p-6">
              {loadingInvoices ? (
                <p className="text-center py-8 text-muted-foreground">Loading invoices...</p>
              ) : taxInvoices && taxInvoices.length > 0 ? (
                <div className="space-y-2">
                  {taxInvoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                    >
                      <div className="flex-1">
                        <div className="font-medium">
                          Invoice #{invoice.invoice_number}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {invoice.client_name}
                          {invoice.bookings?.reference_code && ` • ${invoice.bookings.reference_code}`}
                          {invoice.bookings?.car_model && ` • ${invoice.bookings.car_model}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="font-semibold">
                            {invoice.currency} {Number(invoice.total_amount).toFixed(2)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(invoice.invoice_date), 'PPP')}
                          </div>
                        </div>
                        <Badge variant={invoice.status === 'draft' ? 'secondary' : 'default'}>
                          {invoice.status}
                        </Badge>
                        {invoice.pdf_url && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={invoice.pdf_url} target="_blank" rel="noopener noreferrer">
                              <Download className="w-4 h-4 mr-2" />
                              PDF
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">
                  {searchTerm ? 'No invoices found' : 'No tax invoices created yet'}
                </p>
              )}
            </Card>
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
