import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, TrendingUp, DollarSign, Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ClientAnalytics() {
  const navigate = useNavigate();

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["client-analytics-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .is("deleted_at", null);
      
      if (error) throw error;
      return data;
    },
  });

  // Filter active bookings for client analytics
  const activeBookings = bookings?.filter(b => 
    b.status === 'confirmed' || b.status === 'ongoing' || b.status === 'completed'
  ) || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  // Calculate metrics using active bookings only
  const clientMetrics = activeBookings?.reduce((acc: any, booking: any) => {
    const clientName = booking.client_name || "Unknown";
    
    if (!acc[clientName]) {
      acc[clientName] = {
        name: clientName,
        email: booking.client_email,
        country: booking.country,
        totalRevenue: 0,
        bookingCount: 0,
        totalPaid: 0,
        firstBooking: booking.created_at,
        lastBooking: booking.created_at,
      };
    }

    acc[clientName].totalRevenue += Number(booking.amount_total) || 0;
    acc[clientName].totalPaid += Number(booking.amount_paid) || 0;
    acc[clientName].bookingCount += 1;
    
    if (new Date(booking.created_at) < new Date(acc[clientName].firstBooking)) {
      acc[clientName].firstBooking = booking.created_at;
    }
    if (new Date(booking.created_at) > new Date(acc[clientName].lastBooking)) {
      acc[clientName].lastBooking = booking.created_at;
    }

    return acc;
  }, {}) || {};

  const clientList = Object.values(clientMetrics) as any[];

  // Top clients by revenue
  const topClientsByRevenue = [...clientList]
    .sort((a: any, b: any) => b.totalRevenue - a.totalRevenue)
    .slice(0, 10);

  // Top clients by booking frequency
  const topClientsByFrequency = [...clientList]
    .sort((a: any, b: any) => b.bookingCount - a.bookingCount)
    .slice(0, 10);

  // Average booking value per client
  const totalAvgValue = clientList.reduce((sum: number, client: any) => 
    sum + (client.totalRevenue / client.bookingCount), 0);
  const avgBookingValue = clientList.length > 0 ? totalAvgValue / clientList.length : 0;

  // Client distribution by country (using activeBookings only)
  const countryDistribution = activeBookings.reduce((acc: any, booking: any) => {
    const country = booking.country || "Unknown";
    acc[country] = (acc[country] || 0) + 1;
    return acc;
  }, {});

  const countryData = Object.entries(countryDistribution)
    .map(([name, value]) => ({ name, value }))
    .sort((a: any, b: any) => b.value - a.value)
    .slice(0, 8);

  // New vs returning clients
  const newClients = clientList.filter((c: any) => c.bookingCount === 1).length;
  const returningClients = clientList.filter((c: any) => c.bookingCount > 1).length;

  const newVsReturningData = [
    { name: "New Clients", value: newClients },
    { name: "Returning Clients", value: returningClients },
  ];

  // Client lifetime value (top 10)
  const topLTVClients = [...clientList]
    .sort((a: any, b: any) => b.totalRevenue - a.totalRevenue)
    .slice(0, 10);

  // Payment status distribution
  const fullyPaidClients = clientList.filter((c: any) => c.totalPaid >= c.totalRevenue).length;
  const partiallyPaidClients = clientList.filter((c: any) => c.totalPaid > 0 && c.totalPaid < c.totalRevenue).length;
  const unpaidClients = clientList.filter((c: any) => c.totalPaid === 0).length;

  const paymentStatusData = [
    { name: "Fully Paid", value: fullyPaidClients },
    { name: "Partially Paid", value: partiallyPaidClients },
    { name: "Unpaid", value: unpaidClients },
  ];

  const CHART_COLORS = [
    'hsl(220, 70%, 50%)',  // Blue
    'hsl(340, 75%, 55%)',  // Pink/Red
    'hsl(160, 60%, 45%)',  // Green
    'hsl(280, 65%, 60%)',  // Purple
    'hsl(30, 80%, 55%)',   // Orange
    'hsl(200, 70%, 50%)',  // Cyan
    'hsl(45, 90%, 55%)',   // Yellow
    'hsl(120, 50%, 50%)',  // Lime
    'hsl(300, 60%, 55%)',  // Magenta
    'hsl(180, 55%, 50%)',  // Teal
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/reports")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Reports
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Client Analytics</h2>
          <p className="text-muted-foreground">Analyze client behavior and performance</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientList.length}</div>
            <p className="text-xs text-muted-foreground">
              {newClients} new, {returningClients} returning
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Booking Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{avgBookingValue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Per client average</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Countries Served</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(countryDistribution).length}</div>
            <p className="text-xs text-muted-foreground">Different countries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payment Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((fullyPaidClients / (clientList.length || 1)) * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {fullyPaidClients} of {clientList.length} clients
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Clients by Revenue</CardTitle>
            <CardDescription>Highest revenue generating clients</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={topClientsByRevenue} margin={{ top: 5, right: 30, left: 20, bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45} 
                  textAnchor="end" 
                  height={120}
                  interval={0}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => value.length > 15 ? value.substring(0, 12) + '...' : value}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="totalRevenue" fill="hsl(220, 70%, 50%)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Clients by Booking Frequency</CardTitle>
            <CardDescription>Most frequent clients</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={topClientsByFrequency} margin={{ top: 5, right: 30, left: 20, bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45} 
                  textAnchor="end" 
                  height={120}
                  interval={0}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => value.length > 15 ? value.substring(0, 12) + '...' : value}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="bookingCount" fill="hsl(340, 75%, 55%)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Client Distribution by Country</CardTitle>
            <CardDescription>Geographical distribution of clients</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={countryData}
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
                  {countryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>New vs Returning Clients</CardTitle>
            <CardDescription>Client retention analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={newVsReturningData}
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
                  {newVsReturningData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 3 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Client Lifetime Value</CardTitle>
            <CardDescription>Top 10 clients by total revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client Name</TableHead>
                  <TableHead className="text-right">Total Revenue</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                  <TableHead className="text-right">Avg Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topLTVClients.map((client: any) => (
                  <TableRow key={client.name}>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell className="text-right">€{client.totalRevenue.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{client.bookingCount}</TableCell>
                    <TableCell className="text-right">
                      €{(client.totalRevenue / client.bookingCount).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Status Distribution</CardTitle>
            <CardDescription>Payment completion status across clients</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={paymentStatusData}
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
                  {paymentStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
