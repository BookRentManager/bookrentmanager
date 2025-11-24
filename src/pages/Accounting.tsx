import { useState, useEffect, useRef } from "react";
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
import { FileText, Plus, Download, Eye, ArrowUpDown, ArrowUp, ArrowDown, CalendarIcon, Filter, X, Search, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, subMonths, subQuarters } from "date-fns";
import { toast } from "sonner";
import { pdf } from "@react-pdf/renderer";
import { TaxInvoicePDF } from "@/components/accounting/TaxInvoicePDF";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useDebounce } from "@/hooks/useDebounce";

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
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 25;

  // Debounce search term for better performance
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Cmd/Ctrl + N to create new invoice
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        handleCreateStandalone();
      }
      // Escape to clear search
      if (e.key === 'Escape' && searchTerm) {
        e.preventDefault();
        setSearchTerm('');
        searchInputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchTerm]);

  // Fetch app settings for PDF generation
  const { data: appSettings } = useQuery({
    queryKey: ['app-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  const handleQuickDateFilter = (type: 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter') => {
    const now = new Date();
    
    switch (type) {
      case 'this_month':
        setDateFrom(startOfMonth(now));
        setDateTo(endOfMonth(now));
        break;
      case 'last_month':
        const lastMonth = subMonths(now, 1);
        setDateFrom(startOfMonth(lastMonth));
        setDateTo(endOfMonth(lastMonth));
        break;
      case 'this_quarter':
        setDateFrom(startOfQuarter(now));
        setDateTo(endOfQuarter(now));
        break;
      case 'last_quarter':
        const lastQuarter = subQuarters(now, 1);
        setDateFrom(startOfQuarter(lastQuarter));
        setDateTo(endOfQuarter(lastQuarter));
        break;
    }
  };

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
  const { data: taxInvoicesData, isLoading: loadingInvoices, isFetching } = useQuery({
    queryKey: ['tax-invoices', debouncedSearchTerm, sortField, sortDirection, statusFilter, currencyFilter, dateFrom, dateTo, currentPage],
    queryFn: async () => {
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('tax_invoices')
        .select(`
          *,
          bookings (
            reference_code,
            car_model
          )
        `, { count: 'exact' })
        .is('deleted_at', null);

      if (debouncedSearchTerm) {
        query = query.or(`invoice_number.ilike.%${debouncedSearchTerm}%,client_name.ilike.%${debouncedSearchTerm}%`);
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

      // Apply pagination
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      
      // Client-side filter for booking reference (PostgREST .or() doesn't work with joined columns)
      let filteredData = data;
      if (debouncedSearchTerm && filteredData) {
        filteredData = filteredData.filter(invoice => 
          invoice.bookings?.reference_code?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
          invoice.invoice_number.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
          invoice.client_name.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
        );
      }
      
      return { invoices: filteredData, total: count || 0 };
    },
  });

  const taxInvoices = taxInvoicesData?.invoices || [];
  const totalInvoices = taxInvoicesData?.total || 0;
  const totalPages = Math.ceil(totalInvoices / PAGE_SIZE);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, statusFilter, currencyFilter, dateFrom, dateTo]);

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

  const handleSelectAll = () => {
    if (!taxInvoices) return;
    if (selectedInvoiceIds.size === taxInvoices.length) {
      setSelectedInvoiceIds(new Set());
    } else {
      setSelectedInvoiceIds(new Set(taxInvoices.map(inv => inv.id)));
    }
  };

  const handleSelectInvoice = (invoiceId: string) => {
    const newSelected = new Set(selectedInvoiceIds);
    if (newSelected.has(invoiceId)) {
      newSelected.delete(invoiceId);
    } else {
      newSelected.add(invoiceId);
    }
    setSelectedInvoiceIds(newSelected);
  };

  const handleDeleteSelected = () => {
    if (selectedInvoiceIds.size === 0) return;
    deleteMutation.mutate(Array.from(selectedInvoiceIds));
    setShowDeleteConfirm(false);
  };

  const handleDownloadPDF = async (invoice: any) => {
    try {
      const blob = await pdf(<TaxInvoicePDF invoice={invoice} appSettings={appSettings || undefined} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Tax_Invoice_${invoice.invoice_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF');
    }
  };

  const handleBulkDownloadPDF = async () => {
    if (selectedInvoiceIds.size === 0) return;
    
    const selectedInvoices = taxInvoices?.filter(inv => selectedInvoiceIds.has(inv.id)) || [];
    
    toast.promise(
      Promise.all(
        selectedInvoices.map(async (invoice: any) => {
          const blob = await pdf(<TaxInvoicePDF invoice={invoice} appSettings={appSettings || undefined} />).toBlob();
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `Tax_Invoice_${invoice.invoice_number}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          // Small delay between downloads to prevent browser blocking
          await new Promise(resolve => setTimeout(resolve, 300));
        })
      ),
      {
        loading: `Downloading ${selectedInvoiceIds.size} invoice${selectedInvoiceIds.size > 1 ? 's' : ''}...`,
        success: `Successfully downloaded ${selectedInvoiceIds.size} invoice${selectedInvoiceIds.size > 1 ? 's' : ''}`,
        error: 'Failed to download some invoices',
      }
    );
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
                    ref={searchInputRef}
                    placeholder="Search by invoice number or client... (⌘K)"
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

              {/* Quick Date Filter Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickDateFilter('this_month')}
                  className="h-8"
                >
                  This Month
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickDateFilter('last_month')}
                  className="h-8"
                >
                  Last Month
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickDateFilter('this_quarter')}
                  className="h-8"
                >
                  This Quarter
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickDateFilter('last_quarter')}
                  className="h-8"
                >
                  Last Quarter
                </Button>
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

            {/* Bulk Action Toolbar */}
            {selectedInvoiceIds.size > 0 && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="px-3">
                    {selectedInvoiceIds.size} invoice{selectedInvoiceIds.size !== 1 ? 's' : ''} selected
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedInvoiceIds(new Set())}
                    className="h-8"
                  >
                    Deselect All
                  </Button>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkDownloadPDF}
                    className="gap-2 flex-1 sm:flex-none"
                  >
                    <Download className="h-4 w-4" />
                    Download PDFs
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="gap-2 flex-1 sm:flex-none"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Selected
                  </Button>
                </div>
              </div>
            )}

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
                        <TableHead className="w-12 h-10">
                          <Checkbox
                            checked={taxInvoices && selectedInvoiceIds.size === taxInvoices.length && taxInvoices.length > 0}
                            onCheckedChange={handleSelectAll}
                            aria-label="Select all invoices"
                          />
                        </TableHead>
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
                          <TableCell className="py-2">
                            <Checkbox
                              checked={selectedInvoiceIds.has(invoice.id)}
                              onCheckedChange={() => handleSelectInvoice(invoice.id)}
                              aria-label={`Select invoice ${invoice.invoice_number}`}
                            />
                          </TableCell>
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
                            <Badge 
                              variant={invoice.status === 'paid' ? 'default' : 'secondary'}
                              className={
                                invoice.status === 'paid' 
                                  ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200' 
                                  : 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200'
                              }
                            >
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
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => handleDownloadPDF(invoice)}
                                title="Download PDF"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-6 mt-4 border-t">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="gap-1"
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                          </Button>
                        </PaginationItem>
                        
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          
                          return (
                            <PaginationItem key={pageNum}>
                              <PaginationLink
                                onClick={() => setCurrentPage(pageNum)}
                                isActive={currentPage === pageNum}
                                className="cursor-pointer"
                              >
                                {pageNum}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        })}
                        
                        <PaginationItem>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="gap-1"
                          >
                            Next
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}

                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {taxInvoices.map((invoice) => (
                    <Card key={invoice.id} className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 mb-2">
                          <Checkbox
                            checked={selectedInvoiceIds.has(invoice.id)}
                            onCheckedChange={() => handleSelectInvoice(invoice.id)}
                            aria-label={`Select invoice ${invoice.invoice_number}`}
                          />
                        </div>
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{invoice.invoice_number}</p>
                            <p className="text-sm text-muted-foreground">{format(new Date(invoice.invoice_date), 'dd/MM/yyyy')}</p>
                          </div>
                          <Badge 
                            variant={invoice.status === 'paid' ? 'default' : 'secondary'}
                            className={
                              invoice.status === 'paid' 
                                ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200' 
                                : 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200'
                            }
                          >
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
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDownloadPDF(invoice)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Pagination for mobile */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-6 mt-4 border-t">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="gap-1"
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                          </Button>
                        </PaginationItem>
                        
                        <PaginationItem>
                          <span className="text-sm text-muted-foreground px-2">
                            Page {currentPage} of {totalPages}
                          </span>
                        </PaginationItem>
                        
                        <PaginationItem>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="gap-1"
                          >
                            Next
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to Trash?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to move {selectedInvoiceIds.size} invoice{selectedInvoiceIds.size !== 1 ? 's' : ''} to trash? 
              This action can be reversed later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSelected}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Move to Trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
