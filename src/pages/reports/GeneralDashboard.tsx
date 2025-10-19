import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  DollarSign, 
  FileText, 
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingDown,
  ArrowLeft,
  Banknote
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { startOfMonth, endOfMonth } from "date-fns";

export default function GeneralDashboard() {
  const navigate = useNavigate();
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

  // Filter active bookings (confirmed, ongoing, completed) for financial calculations
  const activeBookings = bookings?.filter(b => 
    b.status === 'confirmed' || b.status === 'ongoing' || b.status === 'completed'
  ) || [];

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

    // Filter financials to only include active bookings
    const activeFinancials = financials.filter(f => activeBookings.some(b => b.id === f.id));
    
    const totalRevenue = activeFinancials.reduce((sum, f) => sum + Number(f.amount_total || 0), 0);
    
    // Use activeBookings for revenue/profit calculations
    const currentMonthRevenue = financials
      .filter(f => {
        const booking = activeBookings.find(b => b.id === f.id);
        return booking && booking.created_at >= currentMonthStart && booking.created_at <= currentMonthEnd;
      })
      .reduce((sum, f) => sum + Number(f.amount_total || 0), 0);

    const totalProfit = activeFinancials.reduce((sum, f) => sum + Number(f.commission_net || 0), 0);
    
    const currentMonthProfit = financials
      .filter(f => {
        const booking = activeBookings.find(b => b.id === f.id);
        return booking && booking.created_at >= currentMonthStart && booking.created_at <= currentMonthEnd;
      })
      .reduce((sum, f) => sum + Number(f.commission_net || 0), 0);

    const draftCount = bookings.filter(b => b.status === "draft").length;
    const confirmedCount = bookings.filter(b => b.status === "confirmed").length;
    const cancelledCount = bookings.filter(b => b.status === "cancelled").length;

    const avgBookingValue = activeBookings.length > 0 ? totalRevenue / activeBookings.length : 0;
    
    // Calculate average commission values
    const avgGrossCommission = activeBookings.length > 0 
      ? activeFinancials.reduce((sum, f) => sum + (Number(f.rental_price_gross || 0) - Number(f.supplier_price || 0)), 0) / activeBookings.length 
      : 0;
    const avgNetCommission = activeBookings.length > 0 
      ? activeFinancials.reduce((sum, f) => {
          const booking = activeBookings.find(b => b.id === f.id);
          const extraDeduction = Number(booking?.extra_deduction || 0);
          return sum + Number(f.commission_net || 0) - extraDeduction;
        }, 0) / activeBookings.length 
      : 0;

    const totalOutstanding = activeFinancials.reduce((sum, f) => {
      const remaining = Number(f.amount_total || 0) - Number(f.amount_paid || 0);
      return sum + (remaining > 0 ? remaining : 0);
    }, 0);

    const pendingInvoices = supplierInvoices
      .filter(inv => inv.payment_status === "to_pay")
      .reduce((sum, inv) => sum + Number(inv.amount || 0), 0);

    const unpaidFines = fines
      .filter(fine => fine.payment_status === "unpaid")
      .reduce((sum, fine) => sum + Number(fine.amount || 0), 0);

    return {
      totalRevenue,
      currentMonthRevenue,
      totalProfit,
      currentMonthProfit,
      draftCount,
      confirmedCount,
      cancelledCount,
      avgBookingValue,
      avgGrossCommission,
      avgNetCommission,
      totalOutstanding,
      pendingInvoices,
      unpaidFines,
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
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/reports")}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Reports
        </Button>
      </div>
      
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
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/reports")}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Reports
        </Button>
      </div>

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
            <CardTitle className="text-sm font-medium">Commission Metrics</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.avgGrossCommission)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Avg. Gross Commission
            </p>
            <p className="text-[10px] text-muted-foreground">Before VAT & expenses</p>
            <div className="text-lg font-semibold mt-2">{formatCurrency(metrics.avgNetCommission)}</div>
            <p className="text-xs text-muted-foreground">
              Avg. Net Commission
            </p>
            <p className="text-[10px] text-muted-foreground">Per booking, after all costs</p>
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
