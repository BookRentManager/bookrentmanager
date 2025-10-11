import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  TrendingUp, 
  DollarSign, 
  FileText, 
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Percent,
  TrendingDown
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { startOfMonth, endOfMonth } from "date-fns";

export default function GeneralDashboard() {
  const currentMonthStart = startOfMonth(new Date()).toISOString();
  const currentMonthEnd = endOfMonth(new Date()).toISOString();

  const { data: financials, isLoading: loadingFinancials } = useQuery({
    queryKey: ["financials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_financials")
        .select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: bookings, isLoading: loadingBookings } = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .is("deleted_at", null);
      if (error) throw error;
      return data;
    },
  });

  const { data: supplierInvoices, isLoading: loadingInvoices } = useQuery({
    queryKey: ["supplier-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_invoices")
        .select("*")
        .is("deleted_at", null);
      if (error) throw error;
      return data;
    },
  });

  const { data: fines, isLoading: loadingFines } = useQuery({
    queryKey: ["fines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fines")
        .select("*")
        .is("deleted_at", null);
      if (error) throw error;
      return data;
    },
  });

  const isLoading = loadingFinancials || loadingBookings || loadingInvoices || loadingFines;

  const calculateMetrics = () => {
    if (!financials || !bookings || !supplierInvoices || !fines) {
      return null;
    }

    const totalRevenue = financials.reduce((sum, f) => sum + Number(f.amount_total || 0), 0);
    
    const currentMonthRevenue = financials
      .filter(f => {
        const booking = bookings.find(b => b.id === f.id);
        return booking && booking.created_at >= currentMonthStart && booking.created_at <= currentMonthEnd;
      })
      .reduce((sum, f) => sum + Number(f.amount_total || 0), 0);

    const totalProfit = financials.reduce((sum, f) => sum + Number(f.commission_net || 0), 0);
    
    const currentMonthProfit = financials
      .filter(f => {
        const booking = bookings.find(b => b.id === f.id);
        return booking && booking.created_at >= currentMonthStart && booking.created_at <= currentMonthEnd;
      })
      .reduce((sum, f) => sum + Number(f.commission_net || 0), 0);

    const draftCount = bookings.filter(b => b.status === "draft").length;
    const confirmedCount = bookings.filter(b => b.status === "confirmed").length;
    const cancelledCount = bookings.filter(b => b.status === "cancelled").length;

    const avgBookingValue = bookings.length > 0 ? totalRevenue / bookings.length : 0;

    const totalOutstanding = financials.reduce((sum, f) => {
      const remaining = Number(f.amount_total || 0) - Number(f.amount_paid || 0);
      return sum + (remaining > 0 ? remaining : 0);
    }, 0);

    const pendingInvoices = supplierInvoices
      .filter(inv => inv.payment_status === "to_pay")
      .reduce((sum, inv) => sum + Number(inv.amount || 0), 0);

    const unpaidFines = fines
      .filter(fine => fine.payment_status === "unpaid")
      .reduce((sum, fine) => sum + Number(fine.amount || 0), 0);

    const totalBookings = draftCount + confirmedCount + cancelledCount;
    const conversionRate = totalBookings > 0 ? (confirmedCount / totalBookings) * 100 : 0;

    return {
      totalRevenue,
      currentMonthRevenue,
      totalProfit,
      currentMonthProfit,
      draftCount,
      confirmedCount,
      cancelledCount,
      avgBookingValue,
      totalOutstanding,
      pendingInvoices,
      unpaidFines,
      conversionRate,
    };
  };

  const metrics = calculateMetrics();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">General Dashboard</h2>
          <p className="text-muted-foreground">Overview of key business metrics</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">General Dashboard</h2>
          <p className="text-muted-foreground">Overview of key business metrics</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">No data available</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">General Dashboard</h2>
        <p className="text-muted-foreground">Overview of key business metrics</p>
      </div>

      {/* Revenue & Profit */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              This month: {formatCurrency(metrics.currentMonthRevenue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.totalProfit)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              This month: {formatCurrency(metrics.currentMonthProfit)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg. Booking Value</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.avgBookingValue)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all bookings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.conversionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Confirmed bookings
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bookings Status */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Draft Bookings</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.draftCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Pending confirmation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Confirmed Bookings</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.confirmedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Active rentals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cancelled Bookings</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.cancelledCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Lost opportunities</p>
          </CardContent>
        </Card>
      </div>

      {/* Outstanding Items */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Payments</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.totalOutstanding)}</div>
            <p className="text-xs text-muted-foreground mt-1">From clients</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Supplier Invoices</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.pendingInvoices)}</div>
            <p className="text-xs text-muted-foreground mt-1">To be paid</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Unpaid Fines</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.unpaidFines)}</div>
            <p className="text-xs text-muted-foreground mt-1">Outstanding amount</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
