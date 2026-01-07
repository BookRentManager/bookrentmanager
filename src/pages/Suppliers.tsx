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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  Truck, 
  TrendingUp, 
  Receipt, 
  FileText,
  ChevronRight,
  Calendar,
  ExternalLink,
  Car,
  X,
  AlertCircle,
  Merge
} from "lucide-react";
import { format, subDays, isAfter } from "date-fns";
import { MergeNamesDialog } from "@/components/admin/MergeNamesDialog";
import { useAdminRole } from "@/hooks/useAdminRole";

interface SupplierData {
  supplier_name: string;
  booking_count: number;
  invoice_count: number;
  total_rental_cost: number;
  total_invoiced: number;
  total_paid: number;
  total_pending: number;
  last_booking_date: string | null;
  currencies: string[];
}

interface SupplierBooking {
  id: string;
  reference_code: string | null;
  car_model: string | null;
  car_plate: string | null;
  delivery_datetime: string | null;
  collection_datetime: string | null;
  supplier_price: number | null;
  currency: string | null;
  status: string | null;
}

interface SupplierInvoice {
  id: string;
  issue_date: string;
  amount: number;
  currency: string;
  payment_status: string;
  car_plate: string | null;
}

export default function Suppliers() {
  const navigate = useNavigate();
  const { isAdmin } = useAdminRole();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierData | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("all");

  // Fetch all bookings with supplier data
  const { data: bookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ['all-bookings-for-suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, reference_code, car_model, car_plate, supplier_name, supplier_price, delivery_datetime, collection_datetime, currency, status')
        .is('deleted_at', null)
        .not('supplier_name', 'is', null)
        .order('delivery_datetime', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch all supplier invoices
  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ['all-supplier-invoices-for-suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_invoices')
        .select('id, supplier_name, issue_date, amount, currency, payment_status, car_plate')
        .is('deleted_at', null)
        .order('issue_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  // Aggregate suppliers from bookings and invoices
  const suppliers = useMemo(() => {
    if (!bookings && !invoices) return [];
    
    const supplierMap = new Map<string, SupplierData>();
    
    // Process bookings
    bookings?.forEach(booking => {
      if (!booking.supplier_name) return;
      
      const key = booking.supplier_name;
      const existing = supplierMap.get(key);
      
      if (existing) {
        existing.booking_count += 1;
        existing.total_rental_cost += Number(booking.supplier_price || 0);
        if (booking.delivery_datetime && (!existing.last_booking_date || new Date(booking.delivery_datetime) > new Date(existing.last_booking_date))) {
          existing.last_booking_date = booking.delivery_datetime;
        }
        if (booking.currency && !existing.currencies.includes(booking.currency)) {
          existing.currencies.push(booking.currency);
        }
      } else {
        supplierMap.set(key, {
          supplier_name: booking.supplier_name,
          booking_count: 1,
          invoice_count: 0,
          total_rental_cost: Number(booking.supplier_price || 0),
          total_invoiced: 0,
          total_paid: 0,
          total_pending: 0,
          last_booking_date: booking.delivery_datetime,
          currencies: booking.currency ? [booking.currency] : ['EUR']
        });
      }
    });
    
    // Process invoices
    invoices?.forEach(invoice => {
      if (!invoice.supplier_name) return;
      
      const key = invoice.supplier_name;
      const existing = supplierMap.get(key);
      const amount = Number(invoice.amount || 0);
      
      if (existing) {
        existing.invoice_count += 1;
        existing.total_invoiced += amount;
        if (invoice.payment_status === 'paid') {
          existing.total_paid += amount;
        } else {
          existing.total_pending += amount;
        }
        if (invoice.currency && !existing.currencies.includes(invoice.currency)) {
          existing.currencies.push(invoice.currency);
        }
      } else {
        supplierMap.set(key, {
          supplier_name: invoice.supplier_name,
          booking_count: 0,
          invoice_count: 1,
          total_rental_cost: 0,
          total_invoiced: amount,
          total_paid: invoice.payment_status === 'paid' ? amount : 0,
          total_pending: invoice.payment_status !== 'paid' ? amount : 0,
          last_booking_date: null,
          currencies: invoice.currency ? [invoice.currency] : ['EUR']
        });
      }
    });
    
    // Sort by total rental cost descending
    return Array.from(supplierMap.values()).sort((a, b) => b.total_rental_cost - a.total_rental_cost);
  }, [bookings, invoices]);

  // Filter suppliers by search, status, and date range
  const filteredSuppliers = useMemo(() => {
    let result = suppliers;
    
    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(s => 
        s.supplier_name.toLowerCase().includes(term)
      );
    }
    
    // Status filter (based on invoice payment status)
    if (statusFilter !== "all") {
      if (statusFilter === "pending") {
        result = result.filter(s => s.total_pending > 0);
      } else if (statusFilter === "paid") {
        result = result.filter(s => s.total_pending === 0 && s.total_paid > 0);
      }
    }
    
    // Date range filter
    if (dateRangeFilter !== "all" && bookings) {
      const daysAgo = parseInt(dateRangeFilter);
      const cutoffDate = subDays(new Date(), daysAgo);
      
      result = result.filter(supplier => {
        return bookings.some(booking => 
          booking.supplier_name === supplier.supplier_name &&
          booking.delivery_datetime &&
          isAfter(new Date(booking.delivery_datetime), cutoffDate)
        );
      });
    }
    
    return result;
  }, [suppliers, searchTerm, statusFilter, dateRangeFilter, bookings]);

  const hasActiveFilters = statusFilter !== "all" || dateRangeFilter !== "all";

  const clearFilters = () => {
    setStatusFilter("all");
    setDateRangeFilter("all");
  };

  // Get bookings for selected supplier
  const supplierBookings = useMemo(() => {
    if (!selectedSupplier || !bookings) return [];
    return bookings.filter(b => b.supplier_name === selectedSupplier.supplier_name) as SupplierBooking[];
  }, [selectedSupplier, bookings]);

  // Get invoices for selected supplier
  const supplierInvoices = useMemo(() => {
    if (!selectedSupplier || !invoices) return [];
    return invoices.filter(inv => inv.supplier_name === selectedSupplier.supplier_name) as SupplierInvoice[];
  }, [selectedSupplier, invoices]);

  // Statistics
  const stats = useMemo(() => {
    if (!suppliers.length) return { totalSuppliers: 0, totalRentalCost: 0, totalInvoiced: 0, totalPending: 0 };
    
    const totalRentalCost = suppliers.reduce((sum, s) => sum + s.total_rental_cost, 0);
    const totalInvoiced = suppliers.reduce((sum, s) => sum + s.total_invoiced, 0);
    const totalPending = suppliers.reduce((sum, s) => sum + s.total_pending, 0);
    
    return {
      totalSuppliers: suppliers.length,
      totalRentalCost,
      totalInvoiced,
      totalPending
    };
  }, [suppliers]);

  const handleSupplierClick = (supplier: SupplierData) => {
    setSelectedSupplier(supplier);
    setDetailDialogOpen(true);
  };

  const handleInvoiceClick = (invoiceId: string) => {
    setDetailDialogOpen(false);
    navigate(`/invoices?highlight=${invoiceId}`);
  };

  const handleBookingClick = (bookingId: string) => {
    setDetailDialogOpen(false);
    navigate(`/bookings/${bookingId}`);
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

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500/10 text-green-600 border-green-200">Paid</Badge>;
      case 'to_pay':
        return <Badge variant="outline" className="border-amber-200 text-amber-600">To Pay</Badge>;
      case 'partial':
        return <Badge variant="outline" className="border-blue-200 text-blue-600">Partial</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const isLoading = bookingsLoading || invoicesLoading;

  if (isLoading) {
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
        <h1 className="text-2xl font-bold">Suppliers</h1>
        <p className="text-muted-foreground">View supplier rental history and invoices</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 md:p-6 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Total Suppliers</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-xl md:text-2xl font-bold">{stats.totalSuppliers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 md:p-6 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Total Rental Costs</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-xs sm:text-sm md:text-base lg:text-xl xl:text-2xl font-bold whitespace-nowrap truncate">
              {new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'EUR' }).format(stats.totalRentalCost)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 md:p-6 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Total Invoiced</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-xs sm:text-sm md:text-base lg:text-xl xl:text-2xl font-bold whitespace-nowrap truncate">
              {new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'EUR' }).format(stats.totalInvoiced)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 md:p-6 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Outstanding</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-xs sm:text-sm md:text-base lg:text-xl xl:text-2xl font-bold whitespace-nowrap truncate text-amber-600">
              {new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'EUR' }).format(stats.totalPending)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search suppliers by name..."
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
              <SelectItem value="paid">Fully Paid</SelectItem>
              <SelectItem value="pending">Has Pending</SelectItem>
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

          {isAdmin && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setMergeDialogOpen(true)} 
              className="h-9 px-3 text-sm ml-auto"
            >
              <Merge className="h-4 w-4 mr-1" />
              Merge Duplicates
            </Button>
          )}
        </div>
      </div>

      {/* Suppliers Table - Desktop */}
      <div className="hidden md:block border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supplier Name</TableHead>
              <TableHead className="text-center">Bookings</TableHead>
              <TableHead className="text-center">Invoices</TableHead>
              <TableHead className="text-right">Rental Costs</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSuppliers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {searchTerm ? 'No suppliers found matching your search' : 'No suppliers with bookings or invoices yet'}
                </TableCell>
              </TableRow>
            ) : (
              filteredSuppliers.map((supplier, idx) => (
                <TableRow 
                  key={`${supplier.supplier_name}-${idx}`}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSupplierClick(supplier)}
                >
                  <TableCell className="font-medium">
                    {supplier.supplier_name}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{supplier.booking_count}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{supplier.invoice_count}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium whitespace-nowrap">
                    {formatCurrency(supplier.total_rental_cost, supplier.currencies)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {supplier.total_pending > 0 ? (
                      <span className="text-amber-600 font-medium">
                        {formatCurrency(supplier.total_pending, supplier.currencies)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
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

      {/* Suppliers Cards - Mobile */}
      <div className="md:hidden space-y-2">
        {filteredSuppliers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Truck className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">
                {searchTerm || hasActiveFilters 
                  ? 'No suppliers found matching your filters' 
                  : 'No suppliers with bookings or invoices yet'}
              </p>
              {hasActiveFilters && (
                <Button variant="link" size="sm" onClick={clearFilters} className="mt-2">
                  Clear filters
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredSuppliers.map((supplier, idx) => (
            <Card 
              key={`${supplier.supplier_name}-${idx}`}
              className="cursor-pointer active:bg-muted/50 transition-colors"
              onClick={() => handleSupplierClick(supplier)}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="font-medium truncate block">{supplier.supplier_name}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="font-semibold text-xs sm:text-sm whitespace-nowrap">
                      {formatCurrency(supplier.total_rental_cost, supplier.currencies)}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                  <Badge variant="secondary" className="text-xs h-5">
                    {supplier.booking_count} booking{supplier.booking_count !== 1 ? 's' : ''}
                  </Badge>
                  <Badge variant="secondary" className="text-xs h-5">
                    {supplier.invoice_count} invoice{supplier.invoice_count !== 1 ? 's' : ''}
                  </Badge>
                  {supplier.total_pending > 0 && (
                    <span className="text-xs text-amber-600 font-medium ml-auto">
                      {formatCurrency(supplier.total_pending, supplier.currencies)} pending
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Supplier Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-2xl lg:max-w-3xl max-h-[95vh] sm:max-h-[90vh] p-4 sm:p-6">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Truck className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="truncate">{selectedSupplier?.supplier_name}</span>
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 -mx-4 sm:-mx-6 px-4 sm:px-6">
            {/* Stats Grid - Responsive */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 py-3 sm:py-4">
              <Card>
                <CardContent className="p-2 sm:p-4">
                  <div className="text-xs sm:text-sm text-muted-foreground">Bookings</div>
                  <div className="text-lg sm:text-2xl font-bold">{selectedSupplier?.booking_count}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-2 sm:p-4">
                  <div className="text-xs sm:text-sm text-muted-foreground">Invoices</div>
                  <div className="text-lg sm:text-2xl font-bold">{selectedSupplier?.invoice_count}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-2 sm:p-4">
                  <div className="text-xs sm:text-sm text-muted-foreground">Total Cost</div>
                  <div className="text-sm sm:text-xl font-bold truncate">
                    {selectedSupplier && formatCurrency(selectedSupplier.total_rental_cost, selectedSupplier.currencies)}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="bookings" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="bookings" className="flex items-center gap-2">
                  <Car className="h-4 w-4" />
                  <span className="hidden sm:inline">Bookings</span>
                  <Badge variant="secondary" className="ml-1">{supplierBookings.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="invoices" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Invoices</span>
                  <Badge variant="secondary" className="ml-1">{supplierInvoices.length}</Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="bookings" className="space-y-2">
                {!supplierBookings.length ? (
                  <div className="p-6 text-center text-muted-foreground border rounded-lg">
                    <Car className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm">No bookings found</p>
                  </div>
                ) : (
                  <>
                    {/* Mobile: Card layout */}
                    <div className="sm:hidden space-y-2 max-h-[280px] overflow-y-auto">
                      {supplierBookings.map((booking) => (
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
                                  {booking.supplier_price != null
                                    ? new Intl.NumberFormat('de-CH', { 
                                        style: 'currency', 
                                        currency: booking.currency || 'EUR' 
                                      }).format(booking.supplier_price)
                                    : '-'}
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    
                    {/* Desktop: Table layout */}
                    <ScrollArea className="hidden sm:block h-[280px] border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Reference</TableHead>
                            <TableHead>Car</TableHead>
                            <TableHead>Period</TableHead>
                            <TableHead className="text-right">Supplier Price</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {supplierBookings.map((booking) => (
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
                                {booking.supplier_price != null
                                  ? new Intl.NumberFormat('de-CH', { 
                                      style: 'currency', 
                                      currency: booking.currency || 'EUR' 
                                    }).format(booking.supplier_price)
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
              </TabsContent>

              <TabsContent value="invoices" className="space-y-2">
                {!supplierInvoices.length ? (
                  <div className="p-6 text-center text-muted-foreground border rounded-lg">
                    <FileText className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm">No invoices found</p>
                  </div>
                ) : (
                  <>
                    {/* Mobile: Card layout */}
                    <div className="sm:hidden space-y-2 max-h-[280px] overflow-y-auto">
                      {supplierInvoices.map((invoice) => (
                        <Card 
                          key={invoice.id}
                          className="cursor-pointer active:bg-muted/50"
                          onClick={() => handleInvoiceClick(invoice.id)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  {getPaymentStatusBadge(invoice.payment_status)}
                                  {invoice.car_plate && (
                                    <span className="text-xs text-muted-foreground">{invoice.car_plate}</span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {format(new Date(invoice.issue_date), 'dd MMM yyyy')}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <span className="font-semibold text-sm">
                                  {new Intl.NumberFormat('de-CH', { 
                                    style: 'currency', 
                                    currency: invoice.currency 
                                  }).format(invoice.amount)}
                                </span>
                                <ExternalLink className="h-3 w-3 text-muted-foreground" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    
                    {/* Desktop: Table layout */}
                    <ScrollArea className="hidden sm:block h-[280px] border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Car Plate</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-12"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {supplierInvoices.map((invoice) => (
                            <TableRow 
                              key={invoice.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => handleInvoiceClick(invoice.id)}
                            >
                              <TableCell>
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(invoice.issue_date), 'dd MMM yyyy')}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">
                                {invoice.car_plate || '-'}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {new Intl.NumberFormat('de-CH', { 
                                  style: 'currency', 
                                  currency: invoice.currency 
                                }).format(invoice.amount)}
                              </TableCell>
                              <TableCell>{getPaymentStatusBadge(invoice.payment_status)}</TableCell>
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
              </TabsContent>
            </Tabs>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Merge Names Dialog */}
      <MergeNamesDialog 
        open={mergeDialogOpen} 
        onOpenChange={setMergeDialogOpen}
        type="supplier"
      />
    </div>
  );
}
