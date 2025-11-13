import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateTaxInvoiceDialog } from "@/components/accounting/CreateTaxInvoiceDialog";
import { TaxInvoiceDetailDialog } from "@/components/accounting/TaxInvoiceDetailDialog";
import { EditTaxInvoiceDialog } from "@/components/accounting/EditTaxInvoiceDialog";
import { FileText, Plus, Printer, Loader2, RefreshCw, Download, Eye, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function Accounting() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createFromPaymentId, setCreateFromPaymentId] = useState<string | undefined>();
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [sortField, setSortField] = useState<'invoice_number' | 'invoice_date' | 'client_name' | 'total_amount' | 'status' | 'created_at'>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

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
    queryKey: ['tax-invoices', searchTerm, sortField, sortDirection],
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
        .is('deleted_at', null);

      if (searchTerm) {
        query = query.or(`invoice_number.ilike.%${searchTerm}%,client_name.ilike.%${searchTerm}%`);
      }

      // Apply sorting
      query = query.order(sortField, { ascending: sortDirection === 'asc' });

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    refetchInterval: (query) => {
      // Poll every 3 seconds if any invoice is missing PDF
      const hasPendingPdf = query.state.data?.some(inv => !inv.pdf_url);
      return hasPendingPdf ? 3000 : false;
    },
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

  const handleEditInvoice = (invoice: any) => {
    setSelectedInvoice(invoice);
    setEditDialogOpen(true);
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const renderSortIcon = (field: typeof sortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    }
    return sortDirection === 'asc' ? 
      <ArrowUp className="h-3 w-3" /> : 
      <ArrowDown className="h-3 w-3" />;
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
      queryClient.invalidateQueries({ queryKey: ['tax-invoices'] });
    },
    onError: (error) => {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate PDF');
    }
  });

  return (
    <>
      <div className="space-y-6">
        <Tabs defaultValue="all-invoices" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="all-invoices">All Invoices</TabsTrigger>
            <TabsTrigger value="to-review">
              To Review
              {paymentsToReview && paymentsToReview.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {paymentsToReview.length}
                </Badge>
              )}
            </TabsTrigger>
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
                        <TableHead className="h-10">Date</TableHead>
                        <TableHead className="h-10">Client</TableHead>
                        <TableHead className="h-10">Booking Ref.</TableHead>
                        <TableHead className="h-10">Description</TableHead>
                        <TableHead className="h-10 text-right">Amount</TableHead>
                        <TableHead className="h-10">Status</TableHead>
                        <TableHead className="h-10 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {taxInvoices.map((invoice) => (
                        <TableRow key={invoice.id} className="h-12">
                          <TableCell className="font-medium py-2">{invoice.invoice_number}</TableCell>
                          <TableCell className="py-2">
                            {format(new Date(invoice.invoice_date), 'dd/MM/yyyy')}
                          </TableCell>
                          <TableCell className="py-2">{invoice.client_name}</TableCell>
                          <TableCell className="py-2">
                            {invoice.bookings?.reference_code || 'N/A'}
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="max-w-xs">
                              {(invoice as any).rental_description || invoice.bookings?.car_model || 'N/A'}
                              {(invoice as any).delivery_location && (invoice as any).collection_location && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {(invoice as any).delivery_location} → {(invoice as any).collection_location}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium py-2">
                            {invoice.currency} {Number(invoice.total_amount).toFixed(2)}
                          </TableCell>
                          <TableCell className="py-2">
                            <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'}>
                              {invoice.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right py-2">
                            <div className="flex justify-end gap-1">
                              {invoice.pdf_url ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0"
                                    onClick={() => window.open(invoice.pdf_url, '_blank')}
                                    title="Download PDF"
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0"
                                    onClick={() => handleViewInvoice(invoice)}
                                    title="View Invoice Details"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => regeneratePdfMutation.mutate(invoice.id)}
                                  disabled={regeneratePdfMutation.isPending}
                                >
                                  {regeneratePdfMutation.isPending ? (
                                    <>
                                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                      Generating...
                                    </>
                                  ) : (
                                    <>
                                      <RefreshCw className="h-3 w-3 mr-1" />
                                      Generate PDF
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
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
                            <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'} className="text-xs">
                              {invoice.status}
                            </Badge>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm"><span className="font-medium">Date:</span> {format(new Date(invoice.invoice_date), 'dd/MM/yyyy')}</p>
                          <p className="text-sm"><span className="font-medium">Amount:</span> {invoice.currency} {Number(invoice.total_amount).toFixed(2)}</p>
                          <p className="text-sm"><span className="font-medium">Booking Ref.:</span> {invoice.bookings?.reference_code || 'N/A'}</p>
                          {((invoice as any).rental_description || invoice.bookings?.car_model) && (
                            <p className="text-sm">
                              <span className="font-medium">Description:</span> {(invoice as any).rental_description || invoice.bookings?.car_model}
                              {(invoice as any).delivery_location && (invoice as any).collection_location && (
                                <span className="text-muted-foreground block mt-1">
                                  {(invoice as any).delivery_location} → {(invoice as any).collection_location}
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2 pt-2">
                          {invoice.pdf_url ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(invoice.pdf_url, '_blank');
                                }}
                                title="Download PDF"
                              >
                                <Download className="h-4 w-4 mr-1" />
                                Download
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditInvoice(invoice);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                regeneratePdfMutation.mutate(invoice.id);
                              }}
                              disabled={regeneratePdfMutation.isPending}
                            >
                              {regeneratePdfMutation.isPending ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                  Generating...
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="h-4 w-4 mr-1" />
                                  Generate PDF
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
          )}
        </TabsContent>

        {/* To Review Tab */}
        <TabsContent value="to-review" className="space-y-4">
          {loadingPayments ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : paymentsToReview && paymentsToReview.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {paymentsToReview.map((payment) => (
                <Card key={payment.id}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">
                      {payment.bookings?.reference_code || 'N/A'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1 text-sm">
                      <p className="text-muted-foreground">
                        Client: <span className="text-foreground">{payment.bookings?.client_name || 'N/A'}</span>
                      </p>
                      <p className="text-muted-foreground">
                        Amount: <span className="text-foreground font-medium">{payment.currency} {payment.amount.toFixed(2)}</span>
                      </p>
                      <p className="text-muted-foreground">
                        Paid: <span className="text-foreground">{payment.paid_at ? format(new Date(payment.paid_at), 'dd MMM yyyy') : 'N/A'}</span>
                      </p>
                    </div>
                    <Button 
                      size="sm" 
                      className="w-full"
                      onClick={() => handleCreateFromReceipt(payment.id)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Create Invoice
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No payments requiring invoices</p>
              </CardContent>
            </Card>
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
        onEdit={handleEditInvoice}
      />

      <EditTaxInvoiceDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        invoice={selectedInvoice}
      />
    </>
  );
}
