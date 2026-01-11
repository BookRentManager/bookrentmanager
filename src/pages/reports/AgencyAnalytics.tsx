import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  Building2, 
  TrendingUp, 
  DollarSign,
  FileText,
  Users
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function AgencyAnalytics() {
  const navigate = useNavigate();

  const { data: bookings, isLoading: loadingBookings } = useQuery({
    queryKey: ["bookings-agency-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .is("deleted_at", null);
      if (error) throw error;
      return data;
    },
  });

  const { data: agencies, isLoading: loadingAgencies } = useQuery({
    queryKey: ["agencies-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agencies")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: financials, isLoading: loadingFinancials } = useQuery({
    queryKey: ["financials-agency"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_financials")
        .select("*");
      if (error) throw error;
      return data;
    },
  });

  const isLoading = loadingBookings || loadingAgencies || loadingFinancials;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const calculateMetrics = () => {
    if (!bookings || !agencies || !financials) return null;

    // Filter out imported bookings first, then filter active bookings
    const regularBookings = bookings.filter(b => !b.imported_from_email);
    const activeBookings = regularBookings.filter(b => 
      b.status === 'confirmed' || b.status === 'ongoing' || b.status === 'completed'
    );

    const directBookings = activeBookings.filter(b => b.booking_type === 'direct');
    const agencyBookings = activeBookings.filter(b => b.booking_type === 'agency');

    // Revenue calculations
    const directRevenue = directBookings.reduce((sum, b) => {
      const f = financials.find(fin => fin.id === b.id);
      return sum + Number(f?.amount_total || 0);
    }, 0);

    const agencyRevenue = agencyBookings.reduce((sum, b) => {
      const f = financials.find(fin => fin.id === b.id);
      return sum + Number(f?.amount_total || 0);
    }, 0);

    const totalRevenue = directRevenue + agencyRevenue;

    // Profit calculations
    const directProfit = directBookings.reduce((sum, b) => {
      const f = financials.find(fin => fin.id === b.id);
      return sum + Number(f?.commission_net || 0) - Number(b.extra_deduction || 0);
    }, 0);

    const agencyProfit = agencyBookings.reduce((sum, b) => {
      const f = financials.find(fin => fin.id === b.id);
      return sum + Number(f?.commission_net || 0) - Number(b.extra_deduction || 0);
    }, 0);

    // Average booking value
    const avgDirectValue = directBookings.length > 0 ? directRevenue / directBookings.length : 0;
    const avgAgencyValue = agencyBookings.length > 0 ? agencyRevenue / agencyBookings.length : 0;

    // Top agency by revenue
    const agencyStats = agencies.map(agency => {
      const agencyBkgs = agencyBookings.filter(b => b.agency_id === agency.id || b.agency_name === agency.name);
      const revenue = agencyBkgs.reduce((sum, b) => {
        const f = financials.find(fin => fin.id === b.id);
        return sum + Number(f?.amount_total || 0);
      }, 0);
      const profit = agencyBkgs.reduce((sum, b) => {
        const f = financials.find(fin => fin.id === b.id);
        return sum + Number(f?.commission_net || 0) - Number(b.extra_deduction || 0);
      }, 0);
      const pending = agencyBkgs.reduce((sum, b) => {
        const f = financials.find(fin => fin.id === b.id);
        const remaining = Number(f?.amount_total || 0) - Number(f?.amount_paid || 0);
        return sum + (remaining > 0 ? remaining : 0);
      }, 0);
      return {
        id: agency.id,
        name: agency.name,
        bookings: agencyBkgs.length,
        revenue,
        profit,
        pending,
        avgValue: agencyBkgs.length > 0 ? revenue / agencyBkgs.length : 0,
      };
    }).sort((a, b) => b.revenue - a.revenue);

    const topAgency = agencyStats[0];

    // Monthly trend data - Direct vs Agency
    const monthlyData: Record<string, { direct: number; agency: number }> = {};
    activeBookings.forEach(booking => {
      const month = format(parseISO(booking.created_at), 'MMM yyyy');
      const f = financials.find(fin => fin.id === booking.id);
      const revenue = Number(f?.amount_total || 0);
      
      if (!monthlyData[month]) {
        monthlyData[month] = { direct: 0, agency: 0 };
      }
      
      if (booking.booking_type === 'agency') {
        monthlyData[month].agency += revenue;
      } else {
        monthlyData[month].direct += revenue;
      }
    });

    const trendData = Object.entries(monthlyData)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

    return {
      directBookings: directBookings.length,
      agencyBookings: agencyBookings.length,
      totalBookings: activeBookings.length,
      directRevenue,
      agencyRevenue,
      totalRevenue,
      directProfit,
      agencyProfit,
      avgDirectValue,
      avgAgencyValue,
      topAgency,
      agencyStats,
      trendData,
    };
  };

  const metrics = calculateMetrics();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="space-y-6">
        <Button variant="outline" size="sm" onClick={() => navigate("/reports")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Reports
        </Button>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">No data available</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pieData = [
    { name: 'Direct', value: metrics.directRevenue },
    { name: 'Agency', value: metrics.agencyRevenue },
  ];

  const bookingsPieData = [
    { name: 'Direct', value: metrics.directBookings },
    { name: 'Agency', value: metrics.agencyBookings },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate("/reports")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Reports
        </Button>
      </div>

      <div>
        <h2 className="text-3xl font-bold tracking-tight">Agency Analytics</h2>
        <p className="text-muted-foreground">Performance comparison between direct and agency bookings</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Agency Bookings</CardTitle>
            <Building2 className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.agencyBookings}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.totalBookings > 0 
                ? `${((metrics.agencyBookings / metrics.totalBookings) * 100).toFixed(1)}% of total` 
                : '0%'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Agency Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.agencyRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.totalRevenue > 0 
                ? `${((metrics.agencyRevenue / metrics.totalRevenue) * 100).toFixed(1)}% of total` 
                : '0%'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg. Agency Booking Value</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.avgAgencyValue)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              vs {formatCurrency(metrics.avgDirectValue)} direct
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Top Agency</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">{metrics.topAgency?.name || 'N/A'}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.topAgency ? `${formatCurrency(metrics.topAgency.revenue)} revenue` : 'No agency bookings'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={(entry) => `${entry.name}: ${((entry.value / metrics.totalRevenue) * 100).toFixed(0)}%`}
                  outerRadius={100}
                  dataKey="value"
                >
                  <Cell fill="hsl(220, 70%, 50%)" />
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
            <CardTitle>Bookings Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={bookingsPieData}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={100}
                  dataKey="value"
                >
                  <Cell fill="hsl(220, 70%, 50%)" />
                  <Cell fill="hsl(280, 65%, 60%)" />
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Trend: Direct vs Agency</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={metrics.trendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Legend />
              <Line type="monotone" dataKey="direct" name="Direct" stroke="hsl(220, 70%, 50%)" strokeWidth={2} />
              <Line type="monotone" dataKey="agency" name="Agency" stroke="hsl(280, 65%, 60%)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Agency by Revenue Bar Chart */}
      {metrics.agencyStats.filter(a => a.bookings > 0).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Agency</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart 
                data={metrics.agencyStats.filter(a => a.bookings > 0).slice(0, 10)} 
                margin={{ top: 5, right: 30, left: 20, bottom: 80 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="name" 
                  angle={-45} 
                  textAnchor="end" 
                  height={120}
                  interval={0}
                  tick={{ fontSize: 11 }}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="revenue" name="Revenue" fill="hsl(280, 65%, 60%)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Agency Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Agency Performance Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agency</TableHead>
                <TableHead className="text-right">Bookings</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Avg. Value</TableHead>
                <TableHead className="text-right">Pending</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.agencyStats.filter(a => a.bookings > 0).map((agency) => (
                <TableRow key={agency.id}>
                  <TableCell className="font-medium">{agency.name}</TableCell>
                  <TableCell className="text-right">{agency.bookings}</TableCell>
                  <TableCell className="text-right">{formatCurrency(agency.revenue)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(agency.profit)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(agency.avgValue)}</TableCell>
                  <TableCell className="text-right text-orange-600">{formatCurrency(agency.pending)}</TableCell>
                </TableRow>
              ))}
              {metrics.agencyStats.filter(a => a.bookings > 0).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No agency bookings yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Comparison Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Direct vs Agency Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Metric</TableHead>
                <TableHead className="text-right">Direct</TableHead>
                <TableHead className="text-right">Agency</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Bookings</TableCell>
                <TableCell className="text-right">{metrics.directBookings}</TableCell>
                <TableCell className="text-right">{metrics.agencyBookings}</TableCell>
                <TableCell className="text-right font-semibold">{metrics.totalBookings}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Revenue</TableCell>
                <TableCell className="text-right">{formatCurrency(metrics.directRevenue)}</TableCell>
                <TableCell className="text-right">{formatCurrency(metrics.agencyRevenue)}</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(metrics.totalRevenue)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Profit</TableCell>
                <TableCell className="text-right">{formatCurrency(metrics.directProfit)}</TableCell>
                <TableCell className="text-right">{formatCurrency(metrics.agencyProfit)}</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(metrics.directProfit + metrics.agencyProfit)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Avg. Booking Value</TableCell>
                <TableCell className="text-right">{formatCurrency(metrics.avgDirectValue)}</TableCell>
                <TableCell className="text-right">{formatCurrency(metrics.avgAgencyValue)}</TableCell>
                <TableCell className="text-right font-semibold">
                  {formatCurrency(metrics.totalBookings > 0 ? metrics.totalRevenue / metrics.totalBookings : 0)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
