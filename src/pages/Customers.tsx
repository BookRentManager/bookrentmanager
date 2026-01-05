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
  Search, 
  Users, 
  TrendingUp, 
  Receipt, 
  Trophy,
  ChevronRight,
  FileText,
  Calendar,
  ExternalLink,
  Car
} from "lucide-react";
import { format } from "date-fns";

interface CustomerData {
  client_name: string;
  client_email: string | null;
  invoice_count: number;
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
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

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

  // Aggregate customers from invoices
  const customers = useMemo(() => {
    if (!invoices) return [];
    
    const customerMap = new Map<string, CustomerData>();
    
    invoices.forEach(inv => {
      const key = `${inv.client_name}|||${inv.client_email || ''}`;
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
          client_email: inv.client_email,
          invoice_count: 1,
          total_amount: Number(inv.total_amount),
          last_invoice_date: inv.invoice_date,
          currencies: [inv.currency]
        });
      }
    });
    
    // Sort by total amount descending
    return Array.from(customerMap.values()).sort((a, b) => b.total_amount - a.total_amount);
  }, [invoices]);

  // Filter customers by search
  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return customers;
    const term = searchTerm.toLowerCase();
    return customers.filter(c => 
      c.client_name.toLowerCase().includes(term) ||
      (c.client_email && c.client_email.toLowerCase().includes(term))
    );
  }, [customers, searchTerm]);

  // Get invoices for selected customer
  const customerInvoices = useMemo(() => {
    if (!selectedCustomer || !invoices) return [];
    return invoices.filter(inv => 
      inv.client_name === selectedCustomer.client_name &&
      (inv.client_email || null) === (selectedCustomer.client_email || null)
    );
  }, [selectedCustomer, invoices]);

  // Fetch bookings for selected customer
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
        query = query.eq('client_email', selectedCustomer.client_email);
      } else {
        query = query.is('client_email', null);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as CustomerBooking[];
    },
    enabled: !!selectedCustomer && detailDialogOpen
  });

  // Statistics
  const stats = useMemo(() => {
    if (!customers.length) return { totalClients: 0, totalRevenue: 0, avgPerClient: 0, topClients: [] };
    
    const totalRevenue = customers.reduce((sum, c) => sum + c.total_amount, 0);
    const avgPerClient = totalRevenue / customers.length;
    const topClients = customers.slice(0, 3);
    
    return {
      totalClients: customers.length,
      totalRevenue,
      avgPerClient,
      topClients
    };
  }, [customers]);

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
    navigate(`/booking/${bookingId}`);
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
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClients}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoiced</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'EUR' }).format(stats.totalRevenue)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. per Client</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'EUR' }).format(stats.avgPerClient)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Client</CardTitle>
            <Trophy className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">
              {stats.topClients[0]?.client_name || '-'}
            </div>
            {stats.topClients[0] && (
              <p className="text-xs text-muted-foreground">
                {formatCurrency(stats.topClients[0].total_amount, stats.topClients[0].currencies)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search clients by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Customers Table - Desktop */}
      <div className="hidden md:block border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-center">Invoices</TableHead>
              <TableHead className="text-right">Total Amount</TableHead>
              <TableHead className="text-center">Last Invoice</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
                    <Badge variant="secondary">{customer.invoice_count}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
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
      <div className="md:hidden space-y-3">
        {filteredCustomers.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {searchTerm ? 'No clients found matching your search' : 'No clients with invoices yet'}
            </CardContent>
          </Card>
        ) : (
          filteredCustomers.map((customer, idx) => (
            <Card 
              key={`${customer.client_name}-${customer.client_email}-${idx}`}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => handleCustomerClick(customer)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {idx < 3 && (
                        <Trophy className={`h-4 w-4 ${
                          idx === 0 ? 'text-amber-500' : 
                          idx === 1 ? 'text-gray-400' : 
                          'text-amber-700'
                        }`} />
                      )}
                      <span className="font-medium">{customer.client_name}</span>
                    </div>
                    {customer.client_email && (
                      <p className="text-sm text-muted-foreground">{customer.client_email}</p>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">
                      <Badge variant="secondary">{customer.invoice_count} invoices</Badge>
                    </span>
                  </div>
                  <span className="font-medium">
                    {formatCurrency(customer.total_amount, customer.currencies)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Customer Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {selectedCustomer?.client_name}
            </DialogTitle>
            {selectedCustomer?.client_email && (
              <p className="text-sm text-muted-foreground">{selectedCustomer.client_email}</p>
            )}
          </DialogHeader>

          <div className="grid grid-cols-3 gap-4 py-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Total Invoices</div>
                <div className="text-2xl font-bold">{selectedCustomer?.invoice_count}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Total Bookings</div>
                <div className="text-2xl font-bold">{customerBookings?.length ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Total Invoiced</div>
                <div className="text-xl font-bold">
                  {selectedCustomer && formatCurrency(selectedCustomer.total_amount, selectedCustomer.currencies)}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            {/* Booking History */}
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Car className="h-4 w-4" />
                Booking History
              </h4>
              <ScrollArea className="h-[200px] border rounded-lg">
                {bookingsLoading ? (
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : !customerBookings?.length ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No bookings found for this client
                  </div>
                ) : (
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
                )}
              </ScrollArea>
            </div>

            {/* Invoice History */}
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Invoice History
              </h4>
              <ScrollArea className="h-[200px] border rounded-lg">
                {!customerInvoices.length ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No invoices found for this client
                  </div>
                ) : (
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
                )}
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
