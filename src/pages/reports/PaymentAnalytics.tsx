import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CreditCard, TrendingUp, DollarSign, Percent } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function PaymentAnalytics() {
  const navigate = useNavigate();

  const { data: payments, isLoading: loadingPayments } = useQuery({
    queryKey: ["payment-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, bookings(reference_code, client_name, status)")
        .eq("payment_link_status", "paid")
        .eq("bookings.status", "confirmed");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: paymentMethods, isLoading: loadingMethods } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("is_enabled", true);
      
      if (error) throw error;
      return data;
    },
  });

  const { data: bookingsRaw, isLoading: loadingBookings } = useQuery({
    queryKey: ["bookings-tc-acceptance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .is("deleted_at", null)
        .eq("status", "confirmed");
      
      if (error) throw error;
      return data;
    },
  });

  // Filter out imported bookings for payment analytics
  const bookings = bookingsRaw?.filter(b => !b.imported_from_email) || [];

  const { data: conversionRates, isLoading: loadingRates } = useQuery({
    queryKey: ["conversion-rates-impact"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("currency_conversion_rates")
        .select("*")
        .eq("from_currency", "EUR")
        .eq("to_currency", "CHF")
        .order("effective_date", { ascending: false })
        .limit(30);
      
      if (error) throw error;
      return data;
    },
  });

  const isLoading = loadingPayments || loadingMethods || loadingBookings || loadingRates;

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  // Payment method distribution
  const paymentMethodDistribution = payments?.reduce((acc: any, payment: any) => {
    const method = payment.payment_method_type || payment.method || "Unknown";
    if (!acc[method]) {
      acc[method] = { name: method, count: 0, revenue: 0, fees: 0 };
    }
    acc[method].count += 1;
    acc[method].revenue += Number(payment.amount || 0);
    acc[method].fees += Number(payment.fee_amount || 0);
    return acc;
  }, {}) || {};

  const methodData = Object.values(paymentMethodDistribution);

  // Fee revenue analysis
  const totalFeeRevenue = payments?.reduce((sum: number, p: any) => 
    sum + Number(p.fee_amount || 0), 0) || 0;
  
  const totalPaymentRevenue = payments?.reduce((sum: number, p: any) => 
    sum + Number(p.amount || 0), 0) || 0;

  const avgFeePercentage = totalPaymentRevenue > 0 
    ? (totalFeeRevenue / totalPaymentRevenue) * 100 
    : 0;

  // Fee revenue by month
  const feeRevenueByMonth = payments?.reduce((acc: any, payment: any) => {
    const month = format(parseISO(payment.created_at), "MMM yyyy");
    if (!acc[month]) {
      acc[month] = { month, fees: 0, revenue: 0 };
    }
    acc[month].fees += Number(payment.fee_amount || 0);
    acc[month].revenue += Number(payment.amount || 0);
    return acc;
  }, {}) || {};

  const feeRevenueTrend = Object.values(feeRevenueByMonth) as any[];

  // Currency conversion impact
  const conversionsUsed = payments?.filter(p => 
    p.conversion_rate_used && p.conversion_rate_used > 0
  ) || [];

  const totalConversionRevenue = conversionsUsed.reduce((sum: number, p: any) => 
    sum + Number(p.converted_amount || 0), 0);

  const avgConversionRate = conversionsUsed.length > 0
    ? conversionsUsed.reduce((sum: number, p: any) => 
        sum + Number(p.conversion_rate_used || 0), 0) / conversionsUsed.length
    : 0;

  // T&C acceptance rate
  const totalBookings = bookings?.length || 0;
  const acceptedBookings = bookings?.filter(b => b.tc_accepted_at)?.length || 0;
  const tcAcceptanceRate = totalBookings > 0 ? (acceptedBookings / totalBookings) * 100 : 0;

  // Payment form sent vs accepted
  const formsSent = bookings?.filter(b => b.booking_form_sent_at)?.length || 0;
  const formsAccepted = bookings?.filter(b => b.tc_accepted_at)?.length || 0;
  const formCompletionRate = formsSent > 0 ? (formsAccepted / formsSent) * 100 : 0;

  // Conversion rate history chart
  const conversionRateChart = conversionRates?.map(rate => ({
    date: format(new Date(rate.effective_date), "MMM dd"),
    rate: Number(rate.rate)
  })).reverse() || [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payment Analytics</h1>
          <p className="text-muted-foreground">
            Payment method distribution, fee revenue, and conversion insights
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/reports')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Reports
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{payments?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              {paymentMethods?.length || 0} payment methods enabled
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fee Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{totalFeeRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Avg {avgFeePercentage.toFixed(2)}% of revenue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">CHF {totalConversionRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {conversionsUsed.length} converted payments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">T&C Acceptance</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tcAcceptanceRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {acceptedBookings} of {totalBookings} bookings
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Payment Method Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Method Distribution</CardTitle>
            <CardDescription>Revenue and count by payment method</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={methodData}
                  dataKey="revenue"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {methodData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => `€${Number(value).toFixed(2)}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Fee Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Fee Revenue Trend</CardTitle>
            <CardDescription>Monthly fee revenue from payment processing</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={feeRevenueTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: any) => `€${Number(value).toFixed(2)}`} />
                <Legend />
                <Line type="monotone" dataKey="fees" stroke="#8884d8" name="Fee Revenue" />
                <Line type="monotone" dataKey="revenue" stroke="#82ca9d" name="Total Revenue" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Conversion Rate History */}
        <Card>
          <CardHeader>
            <CardTitle>EUR/CHF Conversion Rate</CardTitle>
            <CardDescription>Historical conversion rates (last 30 days)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={conversionRateChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={['dataMin - 0.01', 'dataMax + 0.01']} />
                <Tooltip formatter={(value: any) => Number(value).toFixed(4)} />
                <Line type="monotone" dataKey="rate" stroke="#ff7300" name="Rate" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Form Completion Rate */}
        <Card>
          <CardHeader>
            <CardTitle>Booking Form Performance</CardTitle>
            <CardDescription>Form sent vs T&C acceptance rates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Forms Sent</span>
                  <Badge variant="secondary">{formsSent}</Badge>
                </div>
                <div className="h-2 bg-muted rounded-full">
                  <div 
                    className="h-full bg-primary rounded-full" 
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Forms Accepted</span>
                  <Badge variant="default">{formsAccepted}</Badge>
                </div>
                <div className="h-2 bg-muted rounded-full">
                  <div 
                    className="h-full bg-green-500 rounded-full" 
                    style={{ width: `${formCompletionRate}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formCompletionRate.toFixed(1)}% completion rate
                </p>
              </div>

              <div className="pt-4 border-t">
                <h4 className="text-sm font-medium mb-2">Key Insights</h4>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>• {conversionsUsed.length} payments used currency conversion</li>
                  <li>• Average conversion rate: {avgConversionRate.toFixed(4)}</li>
                  <li>• {formsSent - formsAccepted} forms pending acceptance</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Method Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Method Details</CardTitle>
          <CardDescription>Detailed breakdown by payment method</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment Method</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead className="text-right">Total Revenue</TableHead>
                <TableHead className="text-right">Total Fees</TableHead>
                <TableHead className="text-right">Avg Fee %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {methodData.map((method: any, index: number) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{method.name}</TableCell>
                  <TableCell className="text-right">{method.count}</TableCell>
                  <TableCell className="text-right">€{method.revenue.toFixed(2)}</TableCell>
                  <TableCell className="text-right">€{method.fees.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    {method.revenue > 0 
                      ? ((method.fees / method.revenue) * 100).toFixed(2) 
                      : 0}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
