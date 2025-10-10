import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Car, Euro, AlertCircle, FileText, TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [bookingsRes, financialsRes, finesRes, invoicesRes] = await Promise.all([
        supabase.from("bookings").select("*", { count: "exact" }).is("deleted_at", null),
        supabase.from("booking_financials").select("*"),
        supabase.from("fines").select("*", { count: "exact" }).eq("payment_status", "unpaid").is("deleted_at", null),
        supabase.from("supplier_invoices").select("*", { count: "exact" }).eq("payment_status", "to_pay").is("deleted_at", null),
      ]);

      const totalRevenue = financialsRes.data?.reduce((sum, b) => sum + Number(b.amount_paid || 0), 0) || 0;
      const totalCommission = financialsRes.data?.reduce((sum, b) => sum + Number(b.commission_net || 0), 0) || 0;
      const pendingFines = finesRes.count || 0;
      const pendingInvoices = invoicesRes.count || 0;
      const activeBookings = bookingsRes.data?.filter(b => b.status === 'confirmed').length || 0;

      return {
        totalBookings: bookingsRes.count || 0,
        activeBookings,
        totalRevenue,
        totalCommission,
        pendingFines,
        pendingInvoices,
      };
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const kpiCards = [
    {
      title: "Total Bookings",
      value: stats?.totalBookings || 0,
      icon: Car,
      description: `${stats?.activeBookings || 0} active`,
      trend: "up",
    },
    {
      title: "Total Revenue",
      value: `€${(stats?.totalRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: Euro,
      description: "Collected payments",
      trend: "up",
    },
    {
      title: "Net Commission",
      value: `€${(stats?.totalCommission || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: TrendingUp,
      description: "After costs",
      trend: stats?.totalCommission && stats.totalCommission >= 0 ? "up" : "down",
    },
    {
      title: "Pending Fines",
      value: stats?.pendingFines || 0,
      icon: AlertCircle,
      description: "Require payment",
      trend: "neutral",
      variant: "warning" as const,
    },
    {
      title: "Pending Invoices",
      value: stats?.pendingInvoices || 0,
      icon: FileText,
      description: "To be paid",
      trend: "neutral",
      variant: "warning" as const,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Overview of your rental operations</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {kpiCards.map((kpi) => (
          <Card key={kpi.title} className="shadow-card hover:shadow-elevated transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              <kpi.icon className={`h-4 w-4 ${kpi.variant === 'warning' ? 'text-warning' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-muted-foreground">{kpi.description}</p>
                {kpi.trend === "up" && (
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                    <TrendingUp className="h-3 w-3" />
                  </Badge>
                )}
                {kpi.trend === "down" && (
                  <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                    <TrendingDown className="h-3 w-3" />
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Activity log and notifications will appear here
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <a href="/bookings/new" className="block p-3 rounded-md hover:bg-accent transition-colors">
              <div className="font-medium">Create New Booking</div>
              <div className="text-sm text-muted-foreground">Add a new rental reservation</div>
            </a>
            <a href="/fines" className="block p-3 rounded-md hover:bg-accent transition-colors">
              <div className="font-medium">Manage Fines</div>
              <div className="text-sm text-muted-foreground">View and track pending fines</div>
            </a>
            <a href="/invoices" className="block p-3 rounded-md hover:bg-accent transition-colors">
              <div className="font-medium">Review Invoices</div>
              <div className="text-sm text-muted-foreground">Check supplier invoices</div>
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
