import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Search, 
  Users, 
  TrendingUp, 
  Receipt, 
  Trophy,
  ChevronRight,
  FileText,
  Calendar,
  ExternalLink,
  Car,
  X,
  Merge,
  Download,
  AlertTriangle
} from "lucide-react";
import { format, subDays, isAfter } from "date-fns";
import { MergeNamesDialog } from "@/components/admin/MergeNamesDialog";
import { CustomerDuplicatesDialog, useDuplicateCount } from "@/components/admin/CustomerDuplicatesDialog";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useUserViewScope } from "@/hooks/useUserViewScope";

interface CustomerData {
  client_name: string;
  client_email: string | null;
  invoice_count: number;
  booking_count: number;
  total_amount: number;
  last_invoice_date: string;
  currencies: string[];
}

interface CustomerInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  currency: string;
  status: string;
}

interface CustomerBooking {
  id: string;
  reference_code: string | null;
  car_model: string | null;
  car_plate: string | null;
  delivery_datetime: string | null;
  collection_datetime: string | null;
  amount_total: number | null;
  currency: string | null;
  status: string | null;
}

export default function Customers() {
  const navigate = useNavigate();
  const { isAdmin } = useAdminRole();
  const { isReadOnly } = useUserViewScope();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("all");
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [duplicatesDialogOpen, setDuplicatesDialogOpen] = useState(false);
  const [preselectedMergeNames, setPreselectedMergeNames] = useState<string[]>([]);
  const [statsYear, setStatsYear] = useState<string>(new Date().getFullYear().toString());

  // Fetch all tax invoices and aggregate by client
  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ['all-tax-invoices-for-customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tax_invoices')
        .select('id, invoice_number, invoice_date, total_amount, currency, status, client_name, client_email')
        .is('deleted_at', null)
        .order('invoice_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch all bookings for filtering and counting
  const { data: allBookings } = useQuery({
    queryKey: ['all-bookings-for-customer-filter'],
    queryFn: async () => {
      const { data } = await supabase
        .from('bookings')
        .select('id, client_name, client_email, status, delivery_datetime, imported_from_email, rental_price_gross, currency')
        .is('deleted_at', null);
      return data || [];
    }
  });

  // Helper to normalize emails for case-insensitive grouping
  const normalizeEmail = (email: string | null): string => {
    return email?.trim().toLowerCase() ?? '';
  };

  // Aggregate customers from invoices and imported bookings
  const customers = useMemo(() => {
    if (!invoices && !allBookings) return [];
    
    const customerMap = new Map<string, CustomerData>();
    
    // Step 1: Aggregate from tax invoices
    if (invoices) {
      invoices.forEach(inv => {
        // Use normalized email for grouping key (case-insensitive)
        const key = `${inv.client_name}|||${normalizeEmail(inv.client_email)}`;
        const existing = customerMap.get(key);
        
        if (existing) {
          existing.invoice_count += 1;
          existing.total_amount += Number(inv.total_amount);
          if (new Date(inv.invoice_date) > new Date(existing.last_invoice_date)) {
            existing.last_invoice_date = inv.invoice_date;
          }
          if (!existing.currencies.includes(inv.currency)) {
            existing.currencies.push(inv.currency);
          }
        } else {
          customerMap.set(key, {
            client_name: inv.client_name,
            // Store the normalized email for consistent display
            client_email: inv.client_email ? inv.client_email.trim().toLowerCase() : null,
            invoice_count: 1,
            booking_count: 0,
            total_amount: Number(inv.total_amount),
            last_invoice_date: inv.invoice_date,
            currencies: [inv.currency]
          });
        }
      });
    }
    
    // Step 2: Process bookings - imported bookings create customers and add amounts
    if (allBookings) {
      allBookings.forEach(booking => {
        // Use normalized email for grouping key (case-insensitive)
        const key = `${booking.client_name}|||${normalizeEmail(booking.client_email)}`;
        const existing = customerMap.get(key);
        
        if (booking.imported_from_email) {
          // For imported bookings: add to existing or create new customer entry
          if (existing) {
            existing.booking_count += 1;
            existing.total_amount += Number(booking.rental_price_gross || 0);
            if (booking.currency && !existing.currencies.includes(booking.currency)) {
              existing.currencies.push(booking.currency);
            }
          } else {
            // Create new customer entry from imported booking
            customerMap.set(key, {
              client_name: booking.client_name,
              // Store the normalized email for consistent display
              client_email: booking.client_email ? booking.client_email.trim().toLowerCase() : null,
              invoice_count: 0,
              booking_count: 1,
              total_amount: Number(booking.rental_price_gross || 0),
              last_invoice_date: booking.delivery_datetime || '',
              currencies: booking.currency ? [booking.currency] : ['EUR']
            });
          }
        } else {
          // For regular bookings: only increment booking count if customer exists
          if (existing) {
            existing.booking_count += 1;
          }
        }
      });
    }
    
    // Sort by total amount descending
    return Array.from(customerMap.values()).sort((a, b) => b.total_amount - a.total_amount);
  }, [invoices, allBookings]);

  // Filter customers by search, status, and date range
  const filteredCustomers = useMemo(() => {
    let result = customers;
    
    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c => 
        c.client_name.toLowerCase().includes(term) ||
        (c.client_email && c.client_email.toLowerCase().includes(term))
      );
    }
    
    // Status filter (use case-insensitive email matching)
    if (statusFilter !== "all" && allBookings) {
      result = result.filter(customer => {
        return allBookings.some(booking => 
          booking.client_name === customer.client_name &&
          normalizeEmail(booking.client_email) === normalizeEmail(customer.client_email) &&
          booking.status === statusFilter
        );
      });
    }
    
    // Date range filter (use case-insensitive email matching)
    if (dateRangeFilter !== "all" && allBookings) {
      const daysAgo = parseInt(dateRangeFilter);
      const cutoffDate = subDays(new Date(), daysAgo);
      
      result = result.filter(customer => {
        return allBookings.some(booking => 
          booking.client_name === customer.client_name &&
          normalizeEmail(booking.client_email) === normalizeEmail(customer.client_email) &&
          booking.delivery_datetime &&
          isAfter(new Date(booking.delivery_datetime), cutoffDate)
        );
      });
    }
    
    return result;
  }, [customers, searchTerm, statusFilter, dateRangeFilter, allBookings]);

  const hasActiveFilters = statusFilter !== "all" || dateRangeFilter !== "all";

  const clearFilters = () => {
    setStatusFilter("all");
    setDateRangeFilter("all");
  };

  // Get invoices for selected customer (case-insensitive email matching)
  const customerInvoices = useMemo(() => {
    if (!selectedCustomer || !invoices) return [];
    return invoices.filter(inv => 
      inv.client_name === selectedCustomer.client_name &&
      normalizeEmail(inv.client_email) === normalizeEmail(selectedCustomer.client_email)
    );
  }, [selectedCustomer, invoices]);

  // Fetch bookings for selected customer (case-insensitive email matching)
  const { data: customerBookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ['customer-bookings', selectedCustomer?.client_name, selectedCustomer?.client_email],
    queryFn: async () => {
      if (!selectedCustomer) return [];
      
      let query = supabase
        .from('bookings')
        .select('id, reference_code, car_model, car_plate, delivery_datetime, collection_datetime, amount_total, currency, status')
        .eq('client_name', selectedCustomer.client_name)
        .is('deleted_at', null)
        .order('delivery_datetime', { ascending: false });
      
      if (selectedCustomer.client_email) {
        // Use ilike for case-insensitive email matching
        query = query.ilike('client_email', selectedCustomer.client_email);
      } else {
        query = query.is('client_email', null);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as CustomerBooking[];
    },
    enabled: !!selectedCustomer && detailDialogOpen
  });

  // Calculate duplicate count
  const duplicateCount = useDuplicateCount(customers);

  // Available years from invoice data
  const availableYears = useMemo(() => {
    if (!invoices) return [];
    const years = new Set(invoices.map(inv => new Date(inv.invoice_date).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [invoices]);

  // Statistics
  const stats = useMemo(() => {
    if (!customers.length) return { 
      totalClients: 0, 
      totalRevenueForYear: 0, 
      avgPerClientForYear: 0, 
      topClients: [],
      selectedYear: statsYear
    };
    
    // Filter invoices by selected year
    const yearInvoices = invoices?.filter(inv => 
      new Date(inv.invoice_date).getFullYear().toString() === statsYear
    ) || [];
    
    // Calculate totals for the year
    const totalRevenueForYear = yearInvoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0);
    
    // Calculate unique clients with invoices in this year
    const clientsInYear = new Set(yearInvoices.map(inv => 
      `${inv.client_name}|||${normalizeEmail(inv.client_email)}`
    ));
    const avgPerClientForYear = clientsInYear.size > 0 
      ? totalRevenueForYear / clientsInYear.size 
      : 0;
    
    // Top 3 clients (all-time)
    const topClients = customers.slice(0, 3);
    
    return {
      totalClients: customers.length,
      totalRevenueForYear,
      avgPerClientForYear,
      topClients,
      selectedYear: statsYear
    };
  }, [customers, invoices, statsYear]);

  const handleCustomerClick = (customer: CustomerData) => {
    setSelectedCustomer(customer);
    setDetailDialogOpen(true);
  };

  const handleInvoiceClick = (invoiceId: string) => {
    setDetailDialogOpen(false);
    navigate(`/accounting?invoiceId=${invoiceId}`);
  };

  const handleBookingClick = (bookingId: string) => {
    setDetailDialogOpen(false);
    navigate(`/bookings/${bookingId}`);
  };

  const handleExportCSV = () => {
    const headers = ['Email', 'Client Name'];
    const rows = filteredCustomers.map(customer => [
      customer.client_email || '',
      customer.client_name
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => 
        row.map(cell => {
          const escaped = cell.replace(/"/g, '""');
          return /[,"\n]/.test(cell) ? `"${escaped}"` : escaped;
        }).join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `customers-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getBookingStatusBadge = (status: string | null) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-green-500/10 text-green-600 border-green-200">Confirmed</Badge>;
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      case 'completed':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-200">Completed</Badge>;
      default:
        return <Badge variant="secondary">{status || '-'}</Badge>;
    }
  };

  const formatCurrency = (amount: number, currencies: string[]) => {
    const currency = currencies[0] || 'EUR';
    return new Intl.NumberFormat('de-CH', { 
      style: 'currency', 
      currency 
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500/10 text-green-600 border-green-200">Paid</Badge>;
      case 'issued':
        return <Badge variant="outline">Issued</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (invoicesLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Customers</h1>
        <p className="text-muted-foreground">View client invoice history and statistics</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 md:p-6 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-xl md:text-2xl font-bold">{stats.totalClients}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 md:p-6 md:pb-2">
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-xs md:text-sm font-medium">Total Invoiced</CardTitle>
              <Select value={statsYear} onValueChange={setStatsYear}>
                <SelectTrigger className="h-5 w-auto min-w-0 px-1.5 text-[10px] md:text-xs border-muted-foreground/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year.toString()} className="text-xs">
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-xs sm:text-sm md:text-base lg:text-xl xl:text-2xl font-bold whitespace-nowrap truncate">
              {new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'EUR' }).format(stats.totalRevenueForYear)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 md:p-6 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">
              <span className="hidden sm:inline">Avg. per Client ({statsYear})</span>
              <span className="sm:hidden">Avg/Client</span>
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-xs sm:text-sm md:text-base lg:text-xl xl:text-2xl font-bold whitespace-nowrap truncate">
              {new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'EUR' }).format(stats.avgPerClientForYear)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 md:p-6 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Top Clients</CardTitle>
            <Trophy className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0 min-w-0">
            <div className="space-y-0.5">
              {stats.topClients.slice(0, 3).map((client, idx) => (
                <div key={idx} className="flex items-center gap-1 min-w-0">
                  <span className="text-[10px] flex-shrink-0">
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                  </span>
                  <span className="text-[10px] sm:text-xs font-medium truncate flex-1 min-w-0" title={client.client_name}>
                    {client.client_name}
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                    {new Intl.NumberFormat('de-CH', { style: 'currency', currency: client.currencies[0] || 'EUR', notation: 'compact' }).format(client.total_amount)}
                  </span>
                </div>
              ))}
              {stats.topClients.length === 0 && (
                <span className="text-xs text-muted-foreground">-</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full xs:w-auto xs:min-w-[140px] h-9 text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="ongoing">Ongoing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={dateRangeFilter} onValueChange={setDateRangeFilter}>
            <SelectTrigger className="w-full xs:w-auto xs:min-w-[130px] h-9 text-sm">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 px-3 text-sm">
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleExportCSV}
            className="h-9 ml-auto"
            disabled={filteredCustomers.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          
          {isAdmin && !isReadOnly && (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setDuplicatesDialogOpen(true)}
                className="h-9"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Review Duplicates
                {duplicateCount > 0 && (
                  <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1">
                    {duplicateCount}
                  </Badge>
                )}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setPreselectedMergeNames([]);
                  setMergeDialogOpen(true);
                }}
                className="h-9"
              >
                <Merge className="h-4 w-4 mr-2" />
                Merge Duplicates
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Customers Table - Desktop */}
      <div className="hidden md:block border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-center">Bookings</TableHead>
              <TableHead className="text-center">Invoices</TableHead>
              <TableHead className="text-right">Total Amount</TableHead>
              <TableHead className="text-center">Last Invoice</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {searchTerm ? 'No clients found matching your search' : 'No clients with invoices yet'}
                </TableCell>
              </TableRow>
            ) : (
              filteredCustomers.map((customer, idx) => (
                <TableRow 
                  key={`${customer.client_name}-${customer.client_email}-${idx}`}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleCustomerClick(customer)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {idx < 3 && (
                        <Trophy className={`h-4 w-4 ${
                          idx === 0 ? 'text-amber-500' : 
                          idx === 1 ? 'text-gray-400' : 
                          'text-amber-700'
                        }`} />
                      )}
                      {customer.client_name}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {customer.client_email || '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{customer.booking_count}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{customer.invoice_count}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium whitespace-nowrap">
                    {formatCurrency(customer.total_amount, customer.currencies)}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {format(new Date(customer.last_invoice_date), 'dd MMM yyyy')}
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Customers Cards - Mobile */}
      <div className="md:hidden space-y-2">
        {filteredCustomers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">
                {searchTerm || hasActiveFilters 
                  ? 'No clients found matching your filters' 
                  : 'No clients with invoices yet'}
              </p>
              {hasActiveFilters && (
                <Button variant="link" size="sm" onClick={clearFilters} className="mt-2">
                  Clear filters
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredCustomers.map((customer, idx) => (
            <Card 
              key={`${customer.client_name}-${customer.client_email}-${idx}`}
              className="cursor-pointer active:bg-muted/50 transition-colors"
              onClick={() => handleCustomerClick(customer)}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {idx < 3 && (
                        <Trophy className={`h-4 w-4 flex-shrink-0 ${
                          idx === 0 ? 'text-amber-500' : 
                          idx === 1 ? 'text-gray-400' : 
                          'text-amber-700'
                        }`} />
                      )}
                      <span className="font-medium truncate">{customer.client_name}</span>
                    </div>
                    {customer.client_email && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{customer.client_email}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="font-semibold text-xs sm:text-sm whitespace-nowrap">
                      {formatCurrency(customer.total_amount, customer.currencies)}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                  <Badge variant="secondary" className="text-xs h-5">
                    {customer.invoice_count} invoice{customer.invoice_count !== 1 ? 's' : ''}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Last: {format(new Date(customer.last_invoice_date), 'dd MMM yyyy')}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Customer Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-2xl lg:max-w-3xl max-h-[95vh] sm:max-h-[90vh] p-4 sm:p-6">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Users className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="truncate">{selectedCustomer?.client_name}</span>
            </DialogTitle>
            {selectedCustomer?.client_email && (
              <p className="text-xs sm:text-sm text-muted-foreground truncate">{selectedCustomer.client_email}</p>
            )}
          </DialogHeader>

          <ScrollArea className="flex-1 -mx-4 sm:-mx-6 px-4 sm:px-6">
            {/* Stats Grid - Responsive */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 py-3 sm:py-4">
              <Card>
                <CardContent className="p-2 sm:p-4">
                  <div className="text-xs sm:text-sm text-muted-foreground">Invoices</div>
                  <div className="text-lg sm:text-2xl font-bold">{selectedCustomer?.invoice_count}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-2 sm:p-4">
                  <div className="text-xs sm:text-sm text-muted-foreground">Bookings</div>
                  <div className="text-lg sm:text-2xl font-bold">{customerBookings?.length ?? 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-2 sm:p-4">
                  <div className="text-xs sm:text-sm text-muted-foreground">Total</div>
                  <div className="text-sm sm:text-xl font-bold truncate">
                    {selectedCustomer && formatCurrency(selectedCustomer.total_amount, selectedCustomer.currencies)}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              {/* Booking History */}
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2 text-sm sm:text-base">
                  <Car className="h-4 w-4" />
                  Booking History
                </h4>
                
                {bookingsLoading ? (
                  <div className="p-4 space-y-2 border rounded-lg">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : !customerBookings?.length ? (
                  <div className="p-6 text-center text-muted-foreground border rounded-lg">
                    <Car className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm">No bookings found</p>
                  </div>
                ) : (
                  <>
                    {/* Mobile: Card layout */}
                    <div className="sm:hidden space-y-2 max-h-[180px] overflow-y-auto">
                      {customerBookings.map((booking) => (
                        <Card 
                          key={booking.id}
                          className="cursor-pointer active:bg-muted/50"
                          onClick={() => handleBookingClick(booking.id)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                                    {booking.reference_code || '-'}
                                  </span>
                                  {getBookingStatusBadge(booking.status)}
                                </div>
                                <p className="text-sm font-medium mt-1 truncate">
                                  {booking.car_model || '-'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {booking.delivery_datetime 
                                    ? format(new Date(booking.delivery_datetime), 'dd MMM') 
                                    : '-'}
                                  {booking.collection_datetime && (
                                    <> - {format(new Date(booking.collection_datetime), 'dd MMM yyyy')}</>
                                  )}
                                </p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <span className="font-semibold text-sm">
                                  {booking.amount_total != null
                                    ? new Intl.NumberFormat('de-CH', { 
                                        style: 'currency', 
                                        currency: booking.currency || 'EUR' 
                                      }).format(booking.amount_total)
                                    : '-'}
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    
                    {/* Desktop: Table layout */}
                    <ScrollArea className="hidden sm:block h-[180px] border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Reference</TableHead>
                            <TableHead>Car</TableHead>
                            <TableHead>Period</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {customerBookings.map((booking) => (
                            <TableRow 
                              key={booking.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => handleBookingClick(booking.id)}
                            >
                              <TableCell className="font-mono text-sm">
                                {booking.reference_code || '-'}
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  {booking.car_model || '-'}
                                  {booking.car_plate && (
                                    <span className="text-muted-foreground ml-1">({booking.car_plate})</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {booking.delivery_datetime 
                                  ? format(new Date(booking.delivery_datetime), 'dd MMM') 
                                  : '-'}
                                {booking.collection_datetime && (
                                  <> - {format(new Date(booking.collection_datetime), 'dd MMM yyyy')}</>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {booking.amount_total != null
                                  ? new Intl.NumberFormat('de-CH', { 
                                      style: 'currency', 
                                      currency: booking.currency || 'EUR' 
                                    }).format(booking.amount_total)
                                  : '-'}
                              </TableCell>
                              <TableCell>{getBookingStatusBadge(booking.status)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </>
                )}
              </div>

              {/* Invoice History */}
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2 text-sm sm:text-base">
                  <FileText className="h-4 w-4" />
                  Invoice History
                </h4>
                
                {!customerInvoices.length ? (
                  <div className="p-6 text-center text-muted-foreground border rounded-lg">
                    <FileText className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm">No invoices found</p>
                  </div>
                ) : (
                  <>
                    {/* Mobile: Card layout */}
                    <div className="sm:hidden space-y-2 max-h-[180px] overflow-y-auto">
                      {customerInvoices.map((invoice) => (
                        <Card 
                          key={invoice.id}
                          className="cursor-pointer active:bg-muted/50"
                          onClick={() => handleInvoiceClick(invoice.id)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                                    {invoice.invoice_number}
                                  </span>
                                  {getStatusBadge(invoice.status)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {format(new Date(invoice.invoice_date), 'dd MMM yyyy')}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <span className="font-semibold text-sm">
                                  {new Intl.NumberFormat('de-CH', { 
                                    style: 'currency', 
                                    currency: invoice.currency 
                                  }).format(invoice.total_amount)}
                                </span>
                                <ExternalLink className="h-3 w-3 text-muted-foreground" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    
                    {/* Desktop: Table layout */}
                    <ScrollArea className="hidden sm:block h-[180px] border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Invoice #</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-12"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {customerInvoices.map((invoice) => (
                            <TableRow 
                              key={invoice.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => handleInvoiceClick(invoice.id)}
                            >
                              <TableCell className="font-mono text-sm">
                                {invoice.invoice_number}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(invoice.invoice_date), 'dd MMM yyyy')}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {new Intl.NumberFormat('de-CH', { 
                                  style: 'currency', 
                                  currency: invoice.currency 
                                }).format(invoice.total_amount)}
                              </TableCell>
                              <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </>
                )}
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Merge Names Dialog */}
      <MergeNamesDialog 
        open={mergeDialogOpen} 
        onOpenChange={setMergeDialogOpen}
        type="client"
        preselectedNames={preselectedMergeNames}
      />

      {/* Customer Duplicates Review Dialog */}
      <CustomerDuplicatesDialog
        open={duplicatesDialogOpen}
        onOpenChange={setDuplicatesDialogOpen}
        customers={customers}
        onMergeNames={(names) => {
          setPreselectedMergeNames(names);
          setMergeDialogOpen(true);
        }}
      />
    </div>
  );
}
