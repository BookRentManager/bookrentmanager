import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateTaxInvoiceDialog } from "@/components/accounting/CreateTaxInvoiceDialog";
import { TaxInvoiceDetailDialog } from "@/components/accounting/TaxInvoiceDetailDialog";
import { FileText, Plus, Printer, Loader2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function Accounting() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createFromPaymentId, setCreateFromPaymentId] = useState<string | undefined>();
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

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
  const { data: taxInvoices, isLoading: loadingInvoices, refetch } = useQuery({
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
        .order('invoice_number', { ascending: false });

      if (searchTerm) {
        query = query.or(`invoice_number.ilike.%${searchTerm}%,client_name.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Auto-refresh when PDFs are generating
  const hasPendingPdf = taxInvoices?.some(inv => !inv.pdf_url) || false;
  
  useQuery({
    queryKey: ['pdf-status-check'],
    queryFn: async () => {
      if (hasPendingPdf) {
        refetch();
      }
      return null;
    },
    enabled: hasPendingPdf,
    refetchInterval: hasPendingPdf ? 3000 : false,
  });

  const handleCreateFromReceipt = (paymentId: string) => {
    setCreateFromPaymentId(paymentId);
    setCreateDialogOpen(true);
  };

  const handleCreateStandalone = () => {
    setCreateFromPaymentId(undefined);
    setCreateDialogOpen(true);
  };

  const handleViewInvoice = (invoice: any) => {
    setSelectedInvoice(invoice);
    setDetailDialogOpen(true);
  };

  const regeneratePdfMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { data, error } = await supabase.functions.invoke('generate-tax-invoice-pdf', {
        body: { invoice_id: invoiceId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('PDF generated successfully');
      refetch();
    },
    onError: (error) => {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate PDF');
    }
  });

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6 space-y-6">
        <Tabs defaultValue="to-review" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
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
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex-1 max-w-sm">
                <Input
                  placeholder="Search by invoice # or client..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
              <Button onClick={handleCreateStandalone} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Create Invoice
              </Button>
            </div>

            {loadingInvoices ? (
              <div className="text-center py-8">Loading invoices...</div>
            ) : !taxInvoices || taxInvoices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No invoices found
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="h-10">Invoice #</TableHead>
                        <TableHead className="h-10">Client</TableHead>
                        <TableHead className="h-10">Booking</TableHead>
                        <TableHead className="h-10">Date</TableHead>
                        <TableHead className="h-10 text-right">Net</TableHead>
                        <TableHead className="h-10 text-right">VAT</TableHead>
                        <TableHead className="h-10 text-right">Total</TableHead>
                        <TableHead className="h-10 text-right">PDF</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {taxInvoices.map((invoice) => (
                        <TableRow
                          key={invoice.id}
                          className="cursor-pointer hover:bg-muted/30 h-12"
                          onClick={() => handleViewInvoice(invoice)}
                        >
                          <TableCell className="font-medium py-2">
                            {invoice.invoice_number}
                          </TableCell>
                          <TableCell className="py-2">{invoice.client_name}</TableCell>
                          <TableCell className="py-2">
                            {invoice.bookings?.reference_code || '-'}
                          </TableCell>
                          <TableCell className="py-2">
                            {format(new Date(invoice.invoice_date), 'dd MMM yy')}
                          </TableCell>
                          <TableCell className="text-right py-2">
                            {invoice.currency} {Number(invoice.subtotal).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right py-2">
                            {Number(invoice.vat_rate).toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-right font-medium py-2">
                            {invoice.currency} {Number(invoice.total_amount).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right py-2" onClick={(e) => e.stopPropagation()}>
                            {invoice.pdf_url ? (
                              <div className="flex gap-1 justify-end">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  onClick={() => window.open(invoice.pdf_url, '_blank')}
                                >
                                  <FileText className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  onClick={() => {
                                    const iframe = document.createElement('iframe');
                                    iframe.style.display = 'none';
                                    iframe.src = invoice.pdf_url;
                                    document.body.appendChild(iframe);
                                    iframe.onload = () => {
                                      iframe.contentWindow?.print();
                                    };
                                  }}
                                >
                                  <Printer className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8"
                                onClick={() => regeneratePdfMutation.mutate(invoice.id)}
                                disabled={regeneratePdfMutation.isPending}
                              >
                                {regeneratePdfMutation.isPending ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    <span className="text-xs">Gen</span>
                                  </div>
                                )}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {taxInvoices.map((invoice) => (
                    <Card 
                      key={invoice.id} 
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => handleViewInvoice(invoice)}
                    >
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-semibold text-sm">
                              {invoice.invoice_number}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {invoice.client_name}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-sm">
                              {invoice.currency} {Number(invoice.total_amount).toFixed(2)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(invoice.invoice_date), 'dd MMM yyyy')}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs">
                          <div className="space-y-1">
                            <div className="text-muted-foreground">
                              Booking: {invoice.bookings?.reference_code || '-'}
                            </div>
                            <div>
                              Net: {invoice.currency} {Number(invoice.subtotal).toFixed(2)} + 
                              VAT {Number(invoice.vat_rate).toFixed(1)}%
                            </div>
                          </div>
                          <div onClick={(e) => e.stopPropagation()}>
                            {invoice.pdf_url ? (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => window.open(invoice.pdf_url, '_blank')}
                                >
                                  <FileText className="h-4 w-4 mr-1" />
                                  PDF
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => regeneratePdfMutation.mutate(invoice.id)}
                                disabled={regeneratePdfMutation.isPending}
                              >
                                {regeneratePdfMutation.isPending ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <>
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                    Generating
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
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
      
      <TaxInvoiceDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        invoice={selectedInvoice}
      />
    </AppLayout>
  );
}
