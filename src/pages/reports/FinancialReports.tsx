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

  // Filter active bookings for financial calculations
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

  const { data: payments, isLoading: loadingPayments } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, booking_id, bookings!inner(reference_code, client_name)");
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

    // Filter all data to only include records related to active bookings
    const activeFinancials = financials.filter(f => 
      activeBookings.some(b => b.id === f.id)
    );
    const activePayments = payments.filter(p => 
      activeBookings.some(b => b.id === p.booking_id)
    );
    const activeSupplierInvoices = supplierInvoices.filter(inv => 
      !inv.booking_id || activeBookings.some(b => b.id === inv.booking_id)
    );
    const activeExpenses = expenses.filter(exp => 
      activeBookings.some(b => b.id === exp.booking_id)
    );
    const activeFines = fines.filter(f => 
      !f.booking_id || activeBookings.some(b => b.id === f.booking_id)
    );

    const totalRevenue = activeFinancials.reduce((sum, f) => sum + Number(f.amount_total || 0), 0);
    const totalProfit = activeFinancials.reduce((sum, f) => {
      const booking = activeBookings.find(b => b.id === f.id);
      return sum + Number(f.commission_net || 0) - Number(booking?.extra_deduction || 0);
    }, 0);

    // Revenue by month (using activeBookings only)
    const revenueByMonth = activeBookings.reduce((acc, booking) => {
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

    // Revenue by status (using activeBookings only, excluding cancelled)
    const revenueByStatus = {
      confirmed: activeBookings
        .filter(b => b.status === "confirmed")
        .reduce((sum, b) => {
          const financial = financials.find(f => f.id === b.id);
          return sum + Number(financial?.amount_total || 0);
        }, 0),
      ongoing: activeBookings
        .filter(b => b.status === "ongoing")
        .reduce((sum, b) => {
          const financial = financials.find(f => f.id === b.id);
          return sum + Number(financial?.amount_total || 0);
        }, 0),
      completed: activeBookings
        .filter(b => b.status === "completed")
        .reduce((sum, b) => {
          const financial = financials.find(f => f.id === b.id);
          return sum + Number(financial?.amount_total || 0);
        }, 0),
    };

    // Revenue by country (using activeBookings only)
    const revenueByCountry = activeBookings.reduce((acc, booking) => {
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
    const totalBilled = activeFinancials.reduce((sum, f) => sum + Number(f.amount_total || 0), 0);
    const totalCollected = activeFinancials.reduce((sum, f) => sum + Number(f.amount_paid || 0), 0);
    const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;

    // Profitability
    const avgProfitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const totalSupplierCosts = activeFinancials.reduce((sum, f) => sum + Number(f.supplier_price || 0), 0);
    const avgCommissionPercentage = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    // Most/least profitable bookings (using activeBookings only)
    const bookingsWithProfit = activeBookings
      .map(b => {
        const financial = financials.find(f => f.id === b.id);
        const netCommission = Number(financial?.commission_net || 0) - Number(b.extra_deduction || 0);
        return {
          ...b,
          profit: netCommission,
          revenue: Number(financial?.amount_total || 0),
        };
      })
      .sort((a, b) => b.profit - a.profit);

    const mostProfitable = bookingsWithProfit.slice(0, 5);
    const leastProfitable = bookingsWithProfit.slice(-5).reverse();

    // Profit trend (using activeBookings only)
    const profitByMonth = activeBookings.reduce((acc, booking) => {
      const month = format(parseISO(booking.created_at), 'MMM yyyy');
      const financial = financials.find(f => f.id === booking.id);
      const profit = Number(financial?.commission_net || 0) - Number(booking.extra_deduction || 0);
      
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
    const totalMoneyIn = activePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const totalMoneyOut = 
      activeSupplierInvoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0) +
      activeExpenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0) +
      activeFines.reduce((sum, f) => sum + Number(f.amount || 0), 0);
    const netCashFlow = totalMoneyIn - totalMoneyOut;

    // Payment method distribution - using booking payment_method
    const paymentMethodDist = activeBookings.reduce((acc, booking) => {
      const method = booking.payment_method || 'Unknown';
      if (!acc[method]) {
        acc[method] = 0;
      }
      acc[method] += Number(booking.amount_total || 0);
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
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={metrics.revenueTrendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="hsl(220, 70%, 50%)" strokeWidth={2} />
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
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Confirmed', value: metrics.revenueByStatus.confirmed },
                      { name: 'Ongoing', value: metrics.revenueByStatus.ongoing },
                      { name: 'Completed', value: metrics.revenueByStatus.completed },
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                  label={(entry) => {
                    const percent = Number((entry.percent * 100).toFixed(0));
                    return percent > 5 ? `${percent}%` : '';
                  }}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    <Cell fill="hsl(220, 70%, 50%)" />
                    <Cell fill="hsl(160, 60%, 45%)" />
                    <Cell fill="hsl(280, 65%, 60%)" />
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Revenue by Country</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={Object.entries(metrics.revenueByCountry).map(([country, revenue]) => ({ country, revenue }))} margin={{ top: 5, right: 30, left: 20, bottom: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="country" 
                    angle={-45} 
                    textAnchor="end" 
                    height={120}
                    interval={0}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => value.length > 15 ? value.substring(0, 12) + '...' : value}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="revenue" fill="hsl(30, 80%, 55%)" />
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
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={metrics.profitTrendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Line type="monotone" dataKey="profit" stroke="hsl(160, 60%, 45%)" strokeWidth={2} />
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
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={Object.entries(metrics.paymentMethodDist).map(([method, amount]) => ({ method, amount }))}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={(entry) => {
                    const percent = Number((entry.percent * 100).toFixed(0));
                    return percent > 5 ? `${percent}%` : '';
                  }}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="amount"
                >
                  {Object.keys(metrics.paymentMethodDist).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={[
                      'hsl(220, 70%, 50%)', 
                      'hsl(340, 75%, 55%)', 
                      'hsl(160, 60%, 45%)', 
                      'hsl(280, 65%, 60%)', 
                      'hsl(30, 80%, 55%)',
                      'hsl(200, 70%, 50%)',
                      'hsl(45, 90%, 55%)'
                    ][index % 7]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
