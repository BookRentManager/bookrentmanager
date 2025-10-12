import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Users,
  DollarSign,
  FileText,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowLeft
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function SupplierAnalytics() {
  const navigate = useNavigate();

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

  // Filter active bookings for supplier analytics
  const activeBookings = bookings?.filter(b => 
    b.status === 'confirmed' || b.status === 'ongoing' || b.status === 'completed'
  ) || [];

  const isLoading = loadingInvoices || loadingBookings;

  const calculateSupplierMetrics = () => {
    if (!supplierInvoices || !bookings) {
      return null;
    }

    const supplierStats = supplierInvoices.reduce((acc, invoice) => {
      const supplier = invoice.supplier_name;
      
      if (!acc[supplier]) {
        acc[supplier] = {
          supplier,
          totalPaid: 0,
          totalPending: 0,
          invoiceCount: 0,
          bookingIds: new Set(),
          amounts: [],
          paidInvoices: 0,
          pendingInvoices: 0,
          partiallyPaidInvoices: 0,
        };
      }

      const amount = Number(invoice.amount || 0);
      acc[supplier].invoiceCount += 1;
      acc[supplier].amounts.push(amount);

      // Track payment status
      if (invoice.payment_status === 'paid') {
        acc[supplier].totalPaid += amount;
        acc[supplier].paidInvoices += 1;
      } else if (invoice.payment_status === 'to_pay') {
        acc[supplier].totalPending += amount;
        acc[supplier].pendingInvoices += 1;
      } else if (invoice.payment_status === 'partially_paid') {
        acc[supplier].partiallyPaidInvoices += 1;
        acc[supplier].totalPending += amount;
      }

      // Track unique bookings
      if (invoice.booking_id) {
        acc[supplier].bookingIds.add(invoice.booking_id);
      }

      return acc;
    }, {} as Record<string, any>);

    // Calculate averages and sort
    const supplierMetrics = Object.values(supplierStats).map((stat: any) => {
      const avgCost = stat.amounts.reduce((sum: number, a: number) => sum + a, 0) / stat.amounts.length;
      const totalAmount = stat.totalPaid + stat.totalPending;

      return {
        supplier: stat.supplier,
        totalPaid: stat.totalPaid,
        totalPending: stat.totalPending,
        totalAmount,
        invoiceCount: stat.invoiceCount,
        bookingCount: stat.bookingIds.size,
        avgCost,
        paidInvoices: stat.paidInvoices,
        pendingInvoices: stat.pendingInvoices,
        partiallyPaidInvoices: stat.partiallyPaidInvoices,
      };
    }).sort((a, b) => b.totalAmount - a.totalAmount);

    return supplierMetrics;
  };

  const supplierMetrics = calculateSupplierMetrics();

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
          <h2 className="text-3xl font-bold tracking-tight">Supplier Analytics</h2>
          <p className="text-muted-foreground">Supplier performance and cost analysis</p>
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!supplierMetrics || supplierMetrics.length === 0) {
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
          <h2 className="text-3xl font-bold tracking-tight">Supplier Analytics</h2>
          <p className="text-muted-foreground">Supplier performance and cost analysis</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">No supplier data available</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalSuppliers = supplierMetrics.length;
  const totalPaid = supplierMetrics.reduce((sum, s) => sum + s.totalPaid, 0);
  const totalPending = supplierMetrics.reduce((sum, s) => sum + s.totalPending, 0);
  const totalInvoices = supplierMetrics.reduce((sum, s) => sum + s.invoiceCount, 0);
  const mostExpensive = supplierMetrics[0];
  const leastExpensive = supplierMetrics[supplierMetrics.length - 1];

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
        <h2 className="text-3xl font-bold tracking-tight">Supplier Analytics</h2>
        <p className="text-muted-foreground">Supplier performance and cost analysis</p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Suppliers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSuppliers}</div>
            <p className="text-xs text-muted-foreground mt-1">Active suppliers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</div>
            <p className="text-xs text-muted-foreground mt-1">Completed payments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Pending</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(totalPending)}</div>
            <p className="text-xs text-muted-foreground mt-1">Outstanding invoices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInvoices}</div>
            <p className="text-xs text-muted-foreground mt-1">All supplier invoices</p>
          </CardContent>
        </Card>
      </div>

      {/* Most/Least Expensive Suppliers */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Most Expensive Supplier</CardTitle>
            <TrendingUp className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate">{mostExpensive.supplier}</div>
            <div className="flex justify-between items-center mt-2">
              <p className="text-sm text-muted-foreground">Total Amount:</p>
              <p className="font-semibold text-red-600">{formatCurrency(mostExpensive.totalAmount)}</p>
            </div>
            <div className="flex justify-between items-center mt-1">
              <p className="text-sm text-muted-foreground">Avg. Cost:</p>
              <p className="font-semibold">{formatCurrency(mostExpensive.avgCost)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Least Expensive Supplier</CardTitle>
            <TrendingDown className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate">{leastExpensive.supplier}</div>
            <div className="flex justify-between items-center mt-2">
              <p className="text-sm text-muted-foreground">Total Amount:</p>
              <p className="font-semibold text-green-600">{formatCurrency(leastExpensive.totalAmount)}</p>
            </div>
            <div className="flex justify-between items-center mt-1">
              <p className="text-sm text-muted-foreground">Avg. Cost:</p>
              <p className="font-semibold">{formatCurrency(leastExpensive.avgCost)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Total Paid by Supplier Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Total Amount by Supplier (Paid + Pending)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={supplierMetrics}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="supplier" className="text-xs" angle={-45} textAnchor="end" height={100} />
              <YAxis className="text-xs" />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Legend />
              <Bar dataKey="totalPaid" fill="hsl(var(--chart-2))" name="Paid" stackId="a" />
              <Bar dataKey="totalPending" fill="hsl(var(--chart-1))" name="Pending" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Average Cost per Supplier */}
      <Card>
        <CardHeader>
          <CardTitle>Average Invoice Cost per Supplier</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={supplierMetrics}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="supplier" className="text-xs" angle={-45} textAnchor="end" height={100} />
              <YAxis className="text-xs" />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Bar dataKey="avgCost" fill="hsl(var(--primary))" name="Avg Cost" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Supplier Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Supplier Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {supplierMetrics.map((supplier) => (
              <div key={supplier.supplier} className="border rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold text-lg">{supplier.supplier}</h4>
                  <span className="text-sm text-muted-foreground">
                    {supplier.bookingCount} bookings | {supplier.invoiceCount} invoices
                  </span>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground flex items-center gap-1">
                      <DollarSign className="h-3 w-3" /> Total Amount
                    </p>
                    <p className="font-semibold">{formatCurrency(supplier.totalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-green-600" /> Paid
                    </p>
                    <p className="font-semibold text-green-600">{formatCurrency(supplier.totalPaid)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3 text-orange-600" /> Pending
                    </p>
                    <p className="font-semibold text-orange-600">{formatCurrency(supplier.totalPending)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Avg. Cost</p>
                    <p className="font-semibold">{formatCurrency(supplier.avgCost)}</p>
                  </div>
                </div>

                {/* Payment Status Breakdown */}
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-2">Payment Status Breakdown:</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-green-600" />
                      <span className="text-muted-foreground">Paid:</span>
                      <span className="font-semibold">{supplier.paidInvoices}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-orange-600" />
                      <span className="text-muted-foreground">Pending:</span>
                      <span className="font-semibold">{supplier.pendingInvoices}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 text-yellow-600" />
                      <span className="text-muted-foreground">Partial:</span>
                      <span className="font-semibold">{supplier.partiallyPaidInvoices}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Payment Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Payment Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={[
                  { 
                    name: 'Paid', 
                    value: supplierMetrics.reduce((sum, s) => sum + s.paidInvoices, 0) 
                  },
                  { 
                    name: 'Pending', 
                    value: supplierMetrics.reduce((sum, s) => sum + s.pendingInvoices, 0) 
                  },
                  { 
                    name: 'Partially Paid', 
                    value: supplierMetrics.reduce((sum, s) => sum + s.partiallyPaidInvoices, 0) 
                  },
                ]}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                <Cell fill="hsl(var(--chart-2))" />
                <Cell fill="hsl(var(--chart-1))" />
                <Cell fill="hsl(var(--chart-3))" />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
