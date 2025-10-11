import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Car,
  TrendingUp,
  DollarSign,
  Calendar,
  AlertCircle,
  Wrench,
  FileText,
  ArrowLeft,
  Percent
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { differenceInDays, parseISO } from "date-fns";

export default function CarPerformance() {
  const navigate = useNavigate();

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

  const isLoading = loadingBookings || loadingFinancials || loadingFines || loadingExpenses || loadingInvoices;

  const calculateModelMetrics = () => {
    if (!bookings || !financials || !fines || !expenses || !supplierInvoices) {
      return null;
    }

    const modelStats = bookings.reduce((acc, booking) => {
      const model = booking.car_model;
      const financial = financials.find(f => f.id === booking.id);
      
      if (!acc[model]) {
        acc[model] = {
          model,
          bookings: 0,
          revenue: 0,
          profit: 0,
          totalDays: 0,
          prices: [],
        };
      }

      acc[model].bookings += 1;
      acc[model].revenue += Number(financial?.amount_total || 0);
      acc[model].profit += Number(financial?.commission_net || 0);
      acc[model].prices.push(Number(financial?.rental_price_gross || 0));

      // Calculate days rented
      const days = differenceInDays(
        parseISO(booking.collection_datetime),
        parseISO(booking.delivery_datetime)
      );
      acc[model].totalDays += days;

      return acc;
    }, {} as Record<string, any>);

    // Calculate averages and utilization
    const modelMetrics = Object.values(modelStats).map((stat: any) => {
      const avgPrice = stat.prices.reduce((sum: number, p: number) => sum + p, 0) / stat.prices.length;
      // Simplified utilization: days rented / (bookings * 30) as rough estimate
      const potentialDays = stat.bookings * 30;
      const utilizationRate = (stat.totalDays / potentialDays) * 100;

      return {
        model: stat.model,
        bookings: stat.bookings,
        revenue: stat.revenue,
        avgPrice,
        utilizationRate: Math.min(utilizationRate, 100),
        profit: stat.profit,
      };
    }).sort((a, b) => b.revenue - a.revenue);

    return modelMetrics;
  };

  const calculateCarMetrics = () => {
    if (!bookings || !financials || !fines || !expenses || !supplierInvoices) {
      return null;
    }

    const carStats = bookings.reduce((acc, booking) => {
      const plate = booking.car_plate;
      const financial = financials.find(f => f.id === booking.id);
      
      if (!acc[plate]) {
        acc[plate] = {
          plate,
          model: booking.car_model,
          bookings: 0,
          revenue: 0,
          profit: 0,
          daysRented: 0,
          finesAmount: 0,
          maintenanceExpenses: 0,
          supplierInvoicesAmount: 0,
          firstRentalDate: null as Date | null,
        };
      }

      acc[plate].bookings += 1;
      acc[plate].revenue += Number(financial?.amount_total || 0);
      acc[plate].profit += Number(financial?.commission_net || 0);

      // Track first rental date
      const deliveryDate = parseISO(booking.delivery_datetime);
      if (!acc[plate].firstRentalDate || deliveryDate < acc[plate].firstRentalDate) {
        acc[plate].firstRentalDate = deliveryDate;
      }

      // Calculate days rented
      const days = differenceInDays(
        parseISO(booking.collection_datetime),
        parseISO(booking.delivery_datetime)
      );
      acc[plate].daysRented += days;

      // Add fines for this car
      const carFines = fines.filter(f => f.car_plate === plate);
      acc[plate].finesAmount += carFines.reduce((sum, f) => sum + Number(f.amount || 0), 0);

      // Add maintenance expenses for this booking
      const maintenanceExp = expenses.filter(e => 
        e.booking_id === booking.id
      );
      acc[plate].maintenanceExpenses += maintenanceExp.reduce((sum, e) => sum + Number(e.amount || 0), 0);

      // Add supplier invoices for this car
      const carInvoices = supplierInvoices.filter(inv => inv.car_plate === plate);
      acc[plate].supplierInvoicesAmount += carInvoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);

      return acc;
    }, {} as Record<string, any>);

    // Calculate utilization rate: days rented / days since first rental
    const today = new Date();
    const carMetrics = Object.values(carStats).map((stat: any) => {
      let utilizationRate = 0;
      if (stat.firstRentalDate) {
        const daysSinceFirstRental = differenceInDays(today, stat.firstRentalDate);
        utilizationRate = daysSinceFirstRental > 0 ? (stat.daysRented / daysSinceFirstRental) * 100 : 0;
      }

      return {
        ...stat,
        utilizationRate: Math.min(utilizationRate, 100),
      };
    }).sort((a, b) => b.revenue - a.revenue);

    return carMetrics;
  };

  const modelMetrics = calculateModelMetrics();
  const carMetrics = calculateCarMetrics();

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
          <h2 className="text-3xl font-bold tracking-tight">Car Performance</h2>
          <p className="text-muted-foreground">Performance analysis by model and vehicle</p>
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!modelMetrics || !carMetrics) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Car Performance</h2>
          <p className="text-muted-foreground">Performance analysis by model and vehicle</p>
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
        <h2 className="text-3xl font-bold tracking-tight">Car Performance</h2>
        <p className="text-muted-foreground">Performance analysis by model and vehicle</p>
      </div>

      <Tabs defaultValue="model" className="space-y-4">
        <TabsList>
          <TabsTrigger value="model">By Car Model</TabsTrigger>
          <TabsTrigger value="plate">By Specific Car</TabsTrigger>
        </TabsList>

        <TabsContent value="model" className="space-y-4">
          {/* Model Overview Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Models</CardTitle>
                <Car className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{modelMetrics.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Different car models</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Top Model</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold truncate">{modelMetrics[0]?.model}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {modelMetrics[0]?.bookings} bookings
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Highest Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(modelMetrics[0]?.revenue || 0)}</div>
                <p className="text-xs text-muted-foreground mt-1">{modelMetrics[0]?.model}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Best Utilization</CardTitle>
                <Percent className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.max(...modelMetrics.map(m => m.utilizationRate)).toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">Peak model usage</p>
              </CardContent>
            </Card>
          </div>

          {/* Revenue by Model Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue by Car Model</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={modelMetrics}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="model" className="text-xs" angle={-45} textAnchor="end" height={100} />
                  <YAxis className="text-xs" />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend />
                  <Bar dataKey="revenue" fill="hsl(var(--chart-1))" name="Revenue" />
                  <Bar dataKey="profit" fill="hsl(var(--chart-2))" name="Profit" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Model Details Table */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Model Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {modelMetrics.map((model) => (
                  <div key={model.model} className="border rounded-lg p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <h4 className="font-semibold text-lg">{model.model}</h4>
                      <span className="text-sm text-muted-foreground">{model.bookings} bookings</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Revenue</p>
                        <p className="font-semibold">{formatCurrency(model.revenue)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Avg. Price</p>
                        <p className="font-semibold">{formatCurrency(model.avgPrice)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Profit</p>
                        <p className="font-semibold text-green-600">{formatCurrency(model.profit)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Utilization</p>
                        <p className="font-semibold">{model.utilizationRate.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Profit/Booking</p>
                        <p className="font-semibold">{formatCurrency(model.profit / model.bookings)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Most Popular Models */}
          <Card>
            <CardHeader>
              <CardTitle>Most Popular Models (By Bookings)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={modelMetrics.slice(0, 5)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ model, bookings }) => `${model}: ${bookings}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="bookings"
                  >
                    {modelMetrics.slice(0, 5).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plate" className="space-y-4">
          {/* Car Overview Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Cars</CardTitle>
                <Car className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{carMetrics.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Individual vehicles</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Top Performer</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold truncate">{carMetrics[0]?.plate}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatCurrency(carMetrics[0]?.revenue || 0)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Fines</CardTitle>
                <AlertCircle className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(carMetrics.reduce((sum, c) => sum + c.finesAmount, 0))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Across all cars</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Maintenance Costs</CardTitle>
                <Wrench className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(carMetrics.reduce((sum, c) => sum + c.maintenanceExpenses, 0))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Total expenses</p>
              </CardContent>
            </Card>
          </div>

          {/* Car Details Table */}
          <Card>
            <CardHeader>
              <CardTitle>Individual Car Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {carMetrics.map((car) => (
                  <div key={car.plate} className="border rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-semibold text-lg">{car.plate}</h4>
                        <p className="text-sm text-muted-foreground">{car.model}</p>
                      </div>
                      <span className="text-sm text-muted-foreground">{car.bookings} bookings</span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground flex items-center gap-1">
                          <DollarSign className="h-3 w-3" /> Revenue
                        </p>
                        <p className="font-semibold">{formatCurrency(car.revenue)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" /> Profit
                        </p>
                        <p className="font-semibold text-green-600">{formatCurrency(car.profit)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Days Rented
                        </p>
                        <p className="font-semibold">{car.daysRented}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground flex items-center gap-1">
                          <Percent className="h-3 w-3" /> Utilization
                        </p>
                        <p className="font-semibold">{car.utilizationRate.toFixed(1)}%</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm pt-2 border-t">
                      <div>
                        <p className="text-muted-foreground flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> Fines
                        </p>
                        <p className="font-semibold text-orange-600">{formatCurrency(car.finesAmount)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground flex items-center gap-1">
                          <Wrench className="h-3 w-3" /> Maintenance
                        </p>
                        <p className="font-semibold">{formatCurrency(car.maintenanceExpenses)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground flex items-center gap-1">
                          <FileText className="h-3 w-3" /> Invoices
                        </p>
                        <p className="font-semibold">{formatCurrency(car.supplierInvoicesAmount)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Performers by Revenue */}
          <Card>
            <CardHeader>
              <CardTitle>Top 10 Cars by Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={carMetrics.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="plate" className="text-xs" angle={-45} textAnchor="end" height={100} />
                  <YAxis className="text-xs" />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend />
                  <Bar dataKey="revenue" fill="hsl(var(--chart-1))" name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
