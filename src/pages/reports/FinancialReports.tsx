import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  ArrowLeft
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function FinancialReports() {
  const navigate = useNavigate();
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

  const { data: payments, isLoading: loadingPayments } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: expenses, isLoading: loadingExpenses } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*");
      if (error) throw error;
      return data;
    },
  });

  const isLoading = loadingFinancials || loadingBookings || loadingInvoices || loadingFines || loadingPayments || loadingExpenses;

  const calculateMetrics = () => {
    if (!financials || !bookings || !supplierInvoices || !fines || !payments || !expenses) {
      return null;
    }

    const totalRevenue = financials.reduce((sum, f) => sum + Number(f.amount_total || 0), 0);
    const totalProfit = financials.reduce((sum, f) => sum + Number(f.commission_net || 0), 0);

    // Revenue by month
    const revenueByMonth = bookings.reduce((acc, booking) => {
      const month = format(parseISO(booking.created_at), 'MMM yyyy');
      const financial = financials.find(f => f.id === booking.id);
      const revenue = Number(financial?.amount_total || 0);
      
      if (!acc[month]) {
        acc[month] = 0;
      }
      acc[month] += revenue;
      return acc;
    }, {} as Record<string, number>);

    const revenueTrendData = Object.entries(revenueByMonth)
      .map(([month, revenue]) => ({ month, revenue }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

    // Revenue by status
    const revenueByStatus = {
      confirmed: bookings
        .filter(b => b.status === "confirmed")
        .reduce((sum, b) => {
          const financial = financials.find(f => f.id === b.id);
          return sum + Number(financial?.amount_total || 0);
        }, 0),
      draft: bookings
        .filter(b => b.status === "draft")
        .reduce((sum, b) => {
          const financial = financials.find(f => f.id === b.id);
          return sum + Number(financial?.amount_total || 0);
        }, 0),
      cancelled: bookings
        .filter(b => b.status === "cancelled")
        .reduce((sum, b) => {
          const financial = financials.find(f => f.id === b.id);
          return sum + Number(financial?.amount_total || 0);
        }, 0),
    };

    // Revenue by country
    const revenueByCountry = bookings.reduce((acc, booking) => {
      const country = booking.country || 'Unknown';
      const financial = financials.find(f => f.id === booking.id);
      const revenue = Number(financial?.amount_total || 0);
      
      if (!acc[country]) {
        acc[country] = 0;
      }
      acc[country] += revenue;
      return acc;
    }, {} as Record<string, number>);

    // Collection rate
    const totalBilled = financials.reduce((sum, f) => sum + Number(f.amount_total || 0), 0);
    const totalCollected = financials.reduce((sum, f) => sum + Number(f.amount_paid || 0), 0);
    const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;

    // Profitability
    const avgProfitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const totalSupplierCosts = financials.reduce((sum, f) => sum + Number(f.supplier_price || 0), 0);
    const avgCommissionPercentage = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    // Most/least profitable bookings
    const bookingsWithProfit = bookings
      .map(b => {
        const financial = financials.find(f => f.id === b.id);
        return {
          ...b,
          profit: Number(financial?.commission_net || 0),
          revenue: Number(financial?.amount_total || 0),
        };
      })
      .sort((a, b) => b.profit - a.profit);

    const mostProfitable = bookingsWithProfit.slice(0, 5);
    const leastProfitable = bookingsWithProfit.slice(-5).reverse();

    // Profit trend
    const profitByMonth = bookings.reduce((acc, booking) => {
      const month = format(parseISO(booking.created_at), 'MMM yyyy');
      const financial = financials.find(f => f.id === booking.id);
      const profit = Number(financial?.commission_net || 0);
      
      if (!acc[month]) {
        acc[month] = 0;
      }
      acc[month] += profit;
      return acc;
    }, {} as Record<string, number>);

    const profitTrendData = Object.entries(profitByMonth)
      .map(([month, profit]) => ({ month, profit }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

    // Cash Flow
    const totalMoneyIn = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const totalMoneyOut = 
      supplierInvoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0) +
      expenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0) +
      fines.reduce((sum, f) => sum + Number(f.amount || 0), 0);
    const netCashFlow = totalMoneyIn - totalMoneyOut;

    // Payment method distribution
    const paymentMethodDist = payments.reduce((acc, payment) => {
      const method = payment.method || 'Unknown';
      if (!acc[method]) {
        acc[method] = 0;
      }
      acc[method] += Number(payment.amount || 0);
      return acc;
    }, {} as Record<string, number>);

    return {
      revenueTrendData,
      revenueByStatus,
      revenueByCountry,
      collectionRate,
      avgProfitMargin,
      totalProfit,
      totalSupplierCosts,
      avgCommissionPercentage,
      mostProfitable,
      leastProfitable,
      profitTrendData,
      totalMoneyIn,
      totalMoneyOut,
      netCashFlow,
      paymentMethodDist,
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
          <h2 className="text-3xl font-bold tracking-tight">Financial Reports</h2>
          <p className="text-muted-foreground">Revenue, profitability, and cash flow analysis</p>
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Financial Reports</h2>
          <p className="text-muted-foreground">Revenue, profitability, and cash flow analysis</p>
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
        <h2 className="text-3xl font-bold tracking-tight">Financial Reports</h2>
        <p className="text-muted-foreground">Revenue, profitability, and cash flow analysis</p>
      </div>

      {/* Revenue Analysis */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold">Revenue Analysis</h4>
        
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metrics.revenueTrendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Revenue by Booking Status</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Confirmed', value: metrics.revenueByStatus.confirmed },
                      { name: 'Draft', value: metrics.revenueByStatus.draft },
                      { name: 'Cancelled', value: metrics.revenueByStatus.cancelled },
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    <Cell fill="hsl(var(--chart-1))" />
                    <Cell fill="hsl(var(--chart-2))" />
                    <Cell fill="hsl(var(--chart-3))" />
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Revenue by Country</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={Object.entries(metrics.revenueByCountry).map(([country, revenue]) => ({ country, revenue }))}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="country" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Payment Collection Rate</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.collectionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">Collected vs Billed</p>
          </CardContent>
        </Card>
      </div>

      {/* Profitability */}
      <div className="space-y-4 mt-8">
        <h4 className="text-lg font-semibold">Profitability</h4>
        
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg. Profit Margin</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.avgProfitMargin.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground mt-1">Commission / Revenue</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Commission Earned</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metrics.totalProfit)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                vs {formatCurrency(metrics.totalSupplierCosts)} supplier costs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg. Commission %</CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.avgCommissionPercentage.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground mt-1">Per booking</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Profit Trend Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metrics.profitTrendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Line type="monotone" dataKey="profit" stroke="hsl(var(--chart-2))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Most Profitable Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {metrics.mostProfitable.map((booking) => (
                  <div key={booking.id} className="flex justify-between items-center border-b pb-2">
                    <div>
                      <p className="font-medium text-sm">{booking.reference_code}</p>
                      <p className="text-xs text-muted-foreground">{booking.car_model}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600">{formatCurrency(booking.profit)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Least Profitable Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {metrics.leastProfitable.map((booking) => (
                  <div key={booking.id} className="flex justify-between items-center border-b pb-2">
                    <div>
                      <p className="font-medium text-sm">{booking.reference_code}</p>
                      <p className="text-xs text-muted-foreground">{booking.car_model}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-red-600">{formatCurrency(booking.profit)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Cash Flow */}
      <div className="space-y-4 mt-8">
        <h4 className="text-lg font-semibold">Cash Flow</h4>
        
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Money In</CardTitle>
              <ArrowUpRight className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(metrics.totalMoneyIn)}</div>
              <p className="text-xs text-muted-foreground mt-1">Client payments</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Money Out</CardTitle>
              <ArrowDownRight className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(metrics.totalMoneyOut)}</div>
              <p className="text-xs text-muted-foreground mt-1">Invoices, expenses, fines</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Net Cash Flow</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${metrics.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(metrics.netCashFlow)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Overall balance</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Payment Method Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={Object.entries(metrics.paymentMethodDist).map(([method, amount]) => ({ method, amount }))}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ method, percent }) => `${method}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="amount"
                >
                  {Object.keys(metrics.paymentMethodDist).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
