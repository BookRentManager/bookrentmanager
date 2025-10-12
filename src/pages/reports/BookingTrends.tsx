import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, TrendingUp, MapPin, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, differenceInDays, parseISO, startOfMonth, startOfWeek, startOfYear } from "date-fns";

export default function BookingTrends() {
  const navigate = useNavigate();

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["booking-trends"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  // Filter active bookings for trend analysis
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

  // Bookings by time period
  const bookingsByDay = bookings?.reduce((acc: any, booking: any) => {
    const date = format(parseISO(booking.created_at), "yyyy-MM-dd");
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {}) || {};

  const bookingsByWeek = bookings?.reduce((acc: any, booking: any) => {
    const weekStart = format(startOfWeek(parseISO(booking.created_at)), "yyyy-MM-dd");
    acc[weekStart] = (acc[weekStart] || 0) + 1;
    return acc;
  }, {}) || {};

  const bookingsByMonth = bookings?.reduce((acc: any, booking: any) => {
    const month = format(parseISO(booking.created_at), "MMM yyyy");
    acc[month] = (acc[month] || 0) + 1;
    return acc;
  }, {}) || {};

  const bookingsByYear = bookings?.reduce((acc: any, booking: any) => {
    const year = format(parseISO(booking.created_at), "yyyy");
    acc[year] = (acc[year] || 0) + 1;
    return acc;
  }, {}) || {};

  const dailyData = Object.entries(bookingsByDay).map(([date, count]) => ({ date, count })).slice(-30);
  const monthlyData = Object.entries(bookingsByMonth).map(([month, count]) => ({ month, count }));
  const yearlyData = Object.entries(bookingsByYear).map(([year, count]) => ({ year, count }));

  // Peak booking seasons
  const seasonalData = bookings?.reduce((acc: any, booking: any) => {
    const month = parseISO(booking.created_at).getMonth();
    let season = "";
    if (month >= 2 && month <= 4) season = "Spring";
    else if (month >= 5 && month <= 7) season = "Summer";
    else if (month >= 8 && month <= 10) season = "Fall";
    else season = "Winter";
    
    acc[season] = (acc[season] || 0) + 1;
    return acc;
  }, {}) || {};

  const seasonData = Object.entries(seasonalData).map(([name, value]) => ({ name, value }));

  // Average booking duration
  const durations = bookings?.map((booking: any) => {
    const start = parseISO(booking.delivery_datetime);
    const end = parseISO(booking.collection_datetime);
    return differenceInDays(end, start);
  }) || [];

  const avgDuration = durations.length > 0 
    ? durations.reduce((sum: number, d: number) => sum + d, 0) / durations.length 
    : 0;

  const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
  const minDuration = durations.length > 0 ? Math.min(...durations) : 0;

  // Popular pickup/dropoff locations
  const pickupLocations = bookings?.reduce((acc: any, booking: any) => {
    const location = booking.delivery_location || "Unknown";
    acc[location] = (acc[location] || 0) + 1;
    return acc;
  }, {}) || {};

  const dropoffLocations = bookings?.reduce((acc: any, booking: any) => {
    const location = booking.collection_location || "Unknown";
    acc[location] = (acc[location] || 0) + 1;
    return acc;
  }, {}) || {};

  const topPickupLocations = Object.entries(pickupLocations)
    .map(([name, count]) => ({ name, count }))
    .sort((a: any, b: any) => b.count - a.count)
    .slice(0, 10);

  const topDropoffLocations = Object.entries(dropoffLocations)
    .map(([name, count]) => ({ name, count }))
    .sort((a: any, b: any) => b.count - a.count)
    .slice(0, 10);

  // Advance booking time
  const advanceBookingDays = bookings?.map((booking: any) => {
    const created = parseISO(booking.created_at);
    const delivery = parseISO(booking.delivery_datetime);
    return differenceInDays(delivery, created);
  }) || [];

  const avgAdvanceBooking = advanceBookingDays.length > 0
    ? advanceBookingDays.reduce((sum: number, d: number) => sum + d, 0) / advanceBookingDays.length
    : 0;

  // Distribution of advance booking times
  const advanceBookingDistribution = advanceBookingDays.reduce((acc: any, days: number) => {
    let range = "";
    if (days < 1) range = "Same day";
    else if (days <= 7) range = "1-7 days";
    else if (days <= 14) range = "8-14 days";
    else if (days <= 30) range = "15-30 days";
    else if (days <= 60) range = "31-60 days";
    else range = "60+ days";
    
    acc[range] = (acc[range] || 0) + 1;
    return acc;
  }, {});

  const advanceBookingData = Object.entries(advanceBookingDistribution).map(([name, value]) => ({ name, value }));

  // Cancellation rate (only confirmed + cancelled bookings, excluding drafts)
  const confirmedAndCancelled = bookings?.filter((b: any) => 
    b.status === "confirmed" || b.status === "cancelled"
  ).length || 0;
  const cancelledBookings = bookings?.filter((b: any) => b.status === "cancelled").length || 0;
  const totalBookings = bookings?.length || 0;
  const cancellationRate = confirmedAndCancelled > 0 ? (cancelledBookings / confirmedAndCancelled) * 100 : 0;

  // Cancellation patterns by status
  const statusDistribution = bookings?.reduce((acc: any, booking: any) => {
    acc[booking.status] = (acc[booking.status] || 0) + 1;
    return acc;
  }, {}) || {};

  const statusData = Object.entries(statusDistribution).map(([name, value]) => ({ name, value }));

  // Average km included per booking
  const kmValues = bookings?.filter((b: any) => b.km_included).map((b: any) => Number(b.km_included)) || [];
  const avgKmIncluded = kmValues.length > 0 
    ? kmValues.reduce((sum: number, km: number) => sum + km, 0) / kmValues.length 
    : 0;

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

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
          <h2 className="text-3xl font-bold tracking-tight">Booking Trends</h2>
          <p className="text-muted-foreground">Analyze booking patterns and trends over time</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBookings}</div>
            <p className="text-xs text-muted-foreground">
              {cancelledBookings} cancelled ({cancellationRate.toFixed(1)}%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Booking Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgDuration.toFixed(1)} days</div>
            <p className="text-xs text-muted-foreground">
              Range: {minDuration}-{maxDuration} days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Advance Booking Time</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgAdvanceBooking.toFixed(1)} days</div>
            <p className="text-xs text-muted-foreground">Average lead time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg KM Included</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgKmIncluded.toFixed(0)} km</div>
            <p className="text-xs text-muted-foreground">Per booking average</p>
          </CardContent>
        </Card>
      </div>

      {/* Bookings Over Time */}
      <Card>
        <CardHeader>
          <CardTitle>Bookings Over Time</CardTitle>
          <CardDescription>Booking trends by different time periods</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="month">
            <TabsList className="mb-4">
              <TabsTrigger value="day">Last 30 Days</TabsTrigger>
              <TabsTrigger value="month">By Month</TabsTrigger>
              <TabsTrigger value="year">By Year</TabsTrigger>
            </TabsList>
            
            <TabsContent value="day">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--chart-1))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </TabsContent>
            
            <TabsContent value="month">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--chart-2))" />
                </BarChart>
              </ResponsiveContainer>
            </TabsContent>
            
            <TabsContent value="year">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={yearlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--chart-3))" />
                </BarChart>
              </ResponsiveContainer>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Charts Row 1 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Peak Booking Seasons</CardTitle>
            <CardDescription>Bookings by season</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={seasonData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {seasonData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
            <CardTitle>Booking Status Distribution</CardTitle>
            <CardDescription>Current status of all bookings</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Advance Booking Distribution</CardTitle>
            <CardDescription>How far in advance clients book</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={advanceBookingData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--chart-1))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Pickup Locations</CardTitle>
            <CardDescription>Most popular pickup locations</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topPickupLocations}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--chart-2))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Location Tables */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Pickup Locations</CardTitle>
            <CardDescription>Most popular delivery locations</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                  <TableHead className="text-right">Percentage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topPickupLocations.map((location: any) => (
                  <TableRow key={location.name}>
                    <TableCell className="font-medium">{location.name}</TableCell>
                    <TableCell className="text-right">{location.count}</TableCell>
                    <TableCell className="text-right">
                      {((location.count / totalBookings) * 100).toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Dropoff Locations</CardTitle>
            <CardDescription>Most popular collection locations</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                  <TableHead className="text-right">Percentage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topDropoffLocations.map((location: any) => (
                  <TableRow key={location.name}>
                    <TableCell className="font-medium">{location.name}</TableCell>
                    <TableCell className="text-right">{location.count}</TableCell>
                    <TableCell className="text-right">
                      {((location.count / totalBookings) * 100).toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
