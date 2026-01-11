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

  // Filter out imported bookings first, then filter active bookings for trend analysis
  const regularBookings = bookings?.filter(b => !b.imported_from_email) || [];
  const activeBookings = regularBookings.filter(b => 
    b.status === 'confirmed' || b.status === 'ongoing' || b.status === 'completed'
  );

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

  // Bookings by time period (using activeBookings only)
  const bookingsByDay = activeBookings?.reduce((acc: any, booking: any) => {
    const date = format(parseISO(booking.created_at), "yyyy-MM-dd");
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {}) || {};

  const bookingsByWeek = activeBookings?.reduce((acc: any, booking: any) => {
    const weekStart = format(startOfWeek(parseISO(booking.created_at)), "yyyy-MM-dd");
    acc[weekStart] = (acc[weekStart] || 0) + 1;
    return acc;
  }, {}) || {};

  const bookingsByMonth = activeBookings?.reduce((acc: any, booking: any) => {
    const month = format(parseISO(booking.created_at), "MMM yyyy");
    acc[month] = (acc[month] || 0) + 1;
    return acc;
  }, {}) || {};

  const bookingsByYear = activeBookings?.reduce((acc: any, booking: any) => {
    const year = format(parseISO(booking.created_at), "yyyy");
    acc[year] = (acc[year] || 0) + 1;
    return acc;
  }, {}) || {};

  const dailyData = Object.entries(bookingsByDay).map(([date, count]) => ({ date, count })).slice(-30);
  const monthlyData = Object.entries(bookingsByMonth).map(([month, count]) => ({ month, count }));
  const yearlyData = Object.entries(bookingsByYear).map(([year, count]) => ({ year, count }));

  // Peak booking seasons (using activeBookings only)
  const seasonalData = activeBookings?.reduce((acc: any, booking: any) => {
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

  // Average booking duration (using activeBookings only)
  const durations = activeBookings?.map((booking: any) => {
    const start = parseISO(booking.delivery_datetime);
    const end = parseISO(booking.collection_datetime);
    return differenceInDays(end, start);
  }) || [];

  const avgDuration = durations.length > 0 
    ? durations.reduce((sum: number, d: number) => sum + d, 0) / durations.length 
    : 0;

  const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
  const minDuration = durations.length > 0 ? Math.min(...durations) : 0;

  // Popular pickup/dropoff locations (using activeBookings only)
  const pickupLocations = activeBookings?.reduce((acc: any, booking: any) => {
    const location = booking.delivery_location || "Unknown";
    acc[location] = (acc[location] || 0) + 1;
    return acc;
  }, {}) || {};

  const dropoffLocations = activeBookings?.reduce((acc: any, booking: any) => {
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

  // Advance booking time (using activeBookings only)
  const advanceBookingDays = activeBookings?.map((booking: any) => {
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

  // Status distribution (using activeBookings only - excluding cancelled)
  const statusDistribution = activeBookings?.reduce((acc: any, booking: any) => {
    acc[booking.status] = (acc[booking.status] || 0) + 1;
    return acc;
  }, {}) || {};

  const statusData = Object.entries(statusDistribution).map(([name, value]) => ({ name, value }));

  // Average km included per booking (using activeBookings only)
  const kmValues = activeBookings?.filter((b: any) => b.km_included).map((b: any) => Number(b.km_included)) || [];
  const avgKmIncluded = kmValues.length > 0 
    ? kmValues.reduce((sum: number, km: number) => sum + km, 0) / kmValues.length 
    : 0;

  const totalBookings = activeBookings?.length || 0;

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
              Active bookings only
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
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={dailyData} margin={{ top: 5, right: 30, left: 20, bottom: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    angle={-45} 
                    textAnchor="end" 
                    height={120}
                    interval={0}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="hsl(220, 70%, 50%)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </TabsContent>
            
            <TabsContent value="month">
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={monthlyData} margin={{ top: 5, right: 30, left: 20, bottom: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="month" 
                    angle={-45} 
                    textAnchor="end" 
                    height={120}
                    interval={0}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(340, 75%, 55%)" />
                </BarChart>
              </ResponsiveContainer>
            </TabsContent>
            
            <TabsContent value="year">
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={yearlyData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(160, 60%, 45%)" />
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
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={seasonData}
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
                  {seasonData.map((entry, index) => (
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
            <CardTitle>Booking Status Distribution</CardTitle>
            <CardDescription>Current status of all bookings</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={statusData}
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
                  {statusData.map((entry, index) => (
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

      {/* Charts Row 2 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Advance Booking Distribution</CardTitle>
            <CardDescription>How far in advance clients book</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={advanceBookingData} margin={{ top: 5, right: 30, left: 20, bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45} 
                  textAnchor="end" 
                  height={120}
                  interval={0}
                  tick={{ fontSize: 11 }}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(220, 70%, 50%)" />
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
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={topPickupLocations} margin={{ top: 5, right: 30, left: 20, bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45} 
                  textAnchor="end" 
                  height={120}
                  interval={0}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => value.length > 20 ? value.substring(0, 17) + '...' : value}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(340, 75%, 55%)" />
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
