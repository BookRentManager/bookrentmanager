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
import { FileText, Plus, Download, Eye, ArrowUpDown, ArrowUp, ArrowDown, CalendarIcon, Filter, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { TaxInvoicePDF } from "@/components/accounting/TaxInvoicePDF";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

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
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currencyFilter, setCurrencyFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const handleClearFilters = () => {
    setStatusFilter('all');
    setCurrencyFilter('all');
    setDateFrom(undefined);
    setDateTo(undefined);
    setSearchTerm('');
  };

  const activeFilterCount = [
    statusFilter !== 'all',
    currencyFilter !== 'all',
    dateFrom !== undefined,
    dateTo !== undefined,
    searchTerm !== ''
  ].filter(Boolean).length;

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
    queryKey: ['tax-invoices', searchTerm, sortField, sortDirection, statusFilter, currencyFilter, dateFrom, dateTo],
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

      // Status filter
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      
      // Currency filter
      if (currencyFilter !== 'all') {
        query = query.eq('currency', currencyFilter);
      }
      
      // Date range filter
      if (dateFrom) {
        query = query.gte('invoice_date', format(dateFrom, 'yyyy-MM-dd'));
      }
      if (dateTo) {
        query = query.lte('invoice_date', format(dateTo, 'yyyy-MM-dd'));
      }

      // Apply sorting
      query = query.order(sortField, { ascending: sortDirection === 'asc' });

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (invoiceIds: string[]) => {
      const { error } = await supabase
        .from('tax_invoices')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', invoiceIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-invoices'] });
      setSelectedInvoiceIds(new Set());
      setShowDeleteConfirm(false);
      toast.success('Invoice(s) moved to trash');
    },
    onError: (error) => {
      toast.error('Failed to delete invoices');
      console.error(error);
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
            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 max-w-sm">
                  <Input
                    placeholder="Search by invoice number or client..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full"
                  />
                </div>
                <Button onClick={handleCreateStandalone}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Invoice
                </Button>
              </div>

              {/* Filter Row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="issued">Issued</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Currencies</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="CHF">CHF</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, "PP") : "From Date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, "PP") : "To Date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Active Filters */}
              {activeFilterCount > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <Filter className="h-3 w-3" />
                    {activeFilterCount} active filter{activeFilterCount !== 1 ? 's' : ''}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFilters}
                    className="h-7 gap-1"
                  >
                    <X className="h-3 w-3" />
                    Clear All
                  </Button>
                </div>
              )}
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
                        <TableHead className="h-10 cursor-pointer" onClick={() => handleSort('invoice_number')}>
                          <div className="flex items-center gap-1">
                            Invoice # {renderSortIcon('invoice_number')}
                          </div>
                        </TableHead>
                        <TableHead className="h-10 cursor-pointer" onClick={() => handleSort('invoice_date')}>
                          <div className="flex items-center gap-1">
                            Date {renderSortIcon('invoice_date')}
                          </div>
                        </TableHead>
                        <TableHead className="h-10 cursor-pointer" onClick={() => handleSort('client_name')}>
                          <div className="flex items-center gap-1">
                            Client {renderSortIcon('client_name')}
                          </div>
                        </TableHead>
                        <TableHead className="h-10">Booking Ref.</TableHead>
                        <TableHead className="h-10">Description</TableHead>
                        <TableHead className="h-10">VAT</TableHead>
                        <TableHead className="h-10 text-right cursor-pointer" onClick={() => handleSort('total_amount')}>
                          <div className="flex items-center justify-end gap-1">
                            Amount {renderSortIcon('total_amount')}
                          </div>
                        </TableHead>
                        <TableHead className="h-10 cursor-pointer" onClick={() => handleSort('status')}>
                          <div className="flex items-center gap-1">
                            Status {renderSortIcon('status')}
                          </div>
                        </TableHead>
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
                          <TableCell className="py-2">
                            <div>
                              <div className="font-medium">{invoice.client_name}</div>
                              {invoice.billing_address && (
                                <div className="text-xs text-muted-foreground mt-0.5 max-w-[200px] truncate">
                                  {invoice.billing_address}
                                </div>
                              )}
                            </div>
                          </TableCell>
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
                          <TableCell className="py-2 text-sm">
                            {invoice.vat_rate > 0 ? (
                              <div>
                                {Number(invoice.vat_rate).toFixed(1)}%
                                <div className="text-xs text-muted-foreground">
                                  ({invoice.currency} {Number(invoice.vat_amount).toFixed(2)})
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">N/A</span>
                            )}
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
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => handleViewInvoice(invoice)}
                                title="View Invoice Details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <PDFDownloadLink
                                document={<TaxInvoicePDF invoice={invoice as any} />}
                                fileName={`Tax_Invoice_${invoice.invoice_number}.pdf`}
                              >
                                {({ loading }) => (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0"
                                    disabled={loading}
                                    title="Download PDF"
                                  >
                                    {loading ? (
                                      <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <Download className="h-4 w-4" />
                                    )}
                                  </Button>
                                )}
                              </PDFDownloadLink>
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
                    <Card key={invoice.id} className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{invoice.invoice_number}</p>
                            <p className="text-sm text-muted-foreground">{format(new Date(invoice.invoice_date), 'dd/MM/yyyy')}</p>
                          </div>
                          <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'}>
                            {invoice.status}
                          </Badge>
                        </div>
                        
                        <div>
                          <p className="font-medium">{invoice.client_name}</p>
                          {invoice.billing_address && (
                            <p className="text-xs text-muted-foreground mt-1">{invoice.billing_address}</p>
                          )}
                          <p className="text-sm text-muted-foreground mt-1">
                            {(invoice as any).rental_description || invoice.bookings?.car_model || 'No description'}
                          </p>
                        </div>

                        {invoice.vat_rate > 0 && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">VAT: </span>
                            {Number(invoice.vat_rate).toFixed(1)}% ({invoice.currency} {Number(invoice.vat_amount).toFixed(2)})
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between pt-2 border-t gap-2">
                          <p className="text-lg font-semibold">{invoice.currency} {Number(invoice.total_amount).toFixed(2)}</p>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewInvoice(invoice)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </Button>
                            <PDFDownloadLink
                              document={<TaxInvoicePDF invoice={invoice as any} />}
                              fileName={`Tax_Invoice_${invoice.invoice_number}.pdf`}
                            >
                              {({ loading }) => (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={loading}
                                >
                                  {loading ? (
                                    <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <Download className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                            </PDFDownloadLink>
                          </div>
                        </div>
                      </div>
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
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) {
            // Invalidate queries when dialog closes to refresh the list
            queryClient.invalidateQueries({ queryKey: ['payments-to-review'] });
            queryClient.invalidateQueries({ queryKey: ['tax-invoices'] });
          }
        }}
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
