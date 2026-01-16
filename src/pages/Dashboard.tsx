import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Car, Euro, AlertCircle, FileText, TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useUserViewScope } from "@/hooks/useUserViewScope";
import { useState, useMemo } from "react";
type PeriodFilter = 'all_time' | string; // string for year values like '2026', '2025'

export default function Dashboard() {
  const { isRestrictedStaff } = useUserViewScope();
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all_time');
  const { data: rawStats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    refetchOnMount: 'always',
    queryFn: async () => {
      const [bookingsRes, financialsRes, finesRes, invoicesRes] = await Promise.all([
        supabase.from("bookings").select("*").is("deleted_at", null),
        supabase.from("booking_financials").select("*"),
        supabase.from("fines").select("*", { count: "exact" }).eq("payment_status", "unpaid").is("deleted_at", null),
        supabase.from("supplier_invoices").select("*", { count: "exact" }).eq("payment_status", "to_pay").is("deleted_at", null),
      ]);

      return {
        allBookings: bookingsRes.data || [],
        financials: financialsRes.data || [],
        pendingFines: finesRes.count || 0,
        pendingInvoices: invoicesRes.count || 0,
      };
    },
  });

  // Extract available years from booking data
  const availableYears = useMemo(() => {
    if (!rawStats?.allBookings) return [new Date().getFullYear()];
    const years = new Set(rawStats.allBookings.map(b => 
      new Date(b.created_at).getFullYear()
    ));
    // Always include current year, sort descending (newest first)
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [rawStats?.allBookings]);

  // Calculate date boundaries based on period filter
  const getDateBoundaries = (period: PeriodFilter) => {
    if (period === 'all_time') {
      return { start: null, end: null };
    }
    // Period is a year string like '2026'
    const year = parseInt(period);
    return { 
      start: new Date(year, 0, 1), 
      end: new Date(year, 11, 31, 23, 59, 59) 
    };
  };

  // Calculate stats based on period filter
  const stats = useMemo(() => {
    if (!rawStats) return null;

    const { allBookings, financials, pendingFines, pendingInvoices } = rawStats;
    const { start, end } = getDateBoundaries(periodFilter);
    
    // Filter out imported bookings from all calculations
    const regularBookings = allBookings.filter(b => !b.imported_from_email);
    const importedCount = allBookings.filter(b => b.imported_from_email).length;
    
    // Apply period filter
    const periodFilteredBookings = start && end 
      ? regularBookings.filter(b => {
          const date = new Date(b.created_at);
          return date >= start && date <= end;
        })
      : regularBookings;
    
    const confirmedCount = periodFilteredBookings.filter(b => b.status === 'confirmed').length;
    const draftCount = periodFilteredBookings.filter(b => b.status === 'draft').length;
    const cancelledCount = periodFilteredBookings.filter(b => b.status === 'cancelled').length;
    const ongoingCount = periodFilteredBookings.filter(b => b.status === 'ongoing').length;
    const completedCount = periodFilteredBookings.filter(b => b.status === 'completed').length;

    // Only include active bookings (confirmed, ongoing, completed) in financial calculations
    const activeFinancials = financials.filter(f => {
      const booking = periodFilteredBookings.find(b => b.id === f.id);
      return booking && (booking.status === 'confirmed' || booking.status === 'ongoing' || booking.status === 'completed');
    }) || [];

    const totalRevenueExpected = activeFinancials.reduce((sum, f) => sum + Number(f.amount_total || 0), 0);
    const totalRevenueReceived = activeFinancials.reduce((sum, f) => {
      const booking = periodFilteredBookings.find(b => b.id === f.id);
      return sum + Number(booking?.amount_paid || 0);
    }, 0);
    const totalCommission = activeFinancials.reduce((sum, f) => sum + Number(f.commission_net || 0), 0);
    
    // Calculate Net Commission (after extra_deduction)
    const totalNetCommission = activeFinancials.reduce((sum, f) => {
      const booking = periodFilteredBookings.find(b => b.id === f.id);
      const extraDeduction = Number(booking?.extra_deduction || 0);
      return sum + Number(f.commission_net || 0) - extraDeduction;
    }, 0);

    // Calculate this month's values (always show current month for comparison)
    const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const currentMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);
    
    const currentMonthFinancials = financials.filter(f => {
      const booking = regularBookings.find(b => b.id === f.id);
      return booking && 
        new Date(booking.created_at) >= currentMonthStart && 
        new Date(booking.created_at) <= currentMonthEnd &&
        (booking.status === 'confirmed' || booking.status === 'ongoing' || booking.status === 'completed');
    });

    const currentMonthRevenueExpected = currentMonthFinancials.reduce((sum, f) => sum + Number(f.amount_total || 0), 0);
    const currentMonthRevenueReceived = currentMonthFinancials.reduce((sum, f) => {
      const booking = regularBookings.find(b => b.id === f.id);
      return sum + Number(booking?.amount_paid || 0);
    }, 0);

    const currentMonthCommission = currentMonthFinancials.reduce((sum, f) => sum + Number(f.commission_net || 0), 0);
    
    const currentMonthNetCommission = currentMonthFinancials.reduce((sum, f) => {
      const booking = regularBookings.find(b => b.id === f.id);
      const extraDeduction = Number(booking?.extra_deduction || 0);
      return sum + Number(f.commission_net || 0) - extraDeduction;
    }, 0);

    return {
      totalBookings: periodFilteredBookings.length,
      importedCount,
      confirmedCount,
      draftCount,
      cancelledCount,
      ongoingCount,
      completedCount,
      totalRevenueExpected,
      totalRevenueReceived,
      totalCommission,
      totalNetCommission,
      currentMonthRevenueExpected,
      currentMonthRevenueReceived,
      currentMonthCommission,
      currentMonthNetCommission,
      pendingFines,
      pendingInvoices,
    };
  }, [rawStats, periodFilter]);


  if (isLoading) {
    return (
      <div className="space-y-6 md:space-y-8">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="shadow-card">
              <CardHeader className="px-4 md:px-6">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent className="px-4 md:px-6">
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // For restricted staff, show only booking counts
  const restrictedKpiCards = [
    {
      title: "My Bookings",
      value: stats?.confirmedCount || 0,
      icon: Car,
      description: "Confirmed bookings",
      trend: "neutral" as const,
      secondaryStats: {
        draft: stats?.draftCount || 0,
        cancelled: stats?.cancelledCount || 0,
        total: stats?.totalBookings || 0,
      },
    },
  ];

  // Full KPI cards for admins and unrestricted users
  const fullKpiCards = [
    {
      title: "Bookings",
      value: stats?.confirmedCount || 0,
      icon: Car,
      description: "Confirmed bookings",
      trend: "neutral" as const,
      secondaryStats: {
        draft: stats?.draftCount || 0,
        cancelled: stats?.cancelledCount || 0,
        total: stats?.totalBookings || 0,
      },
    },
    {
      title: "Revenue",
      value: `€${(stats?.totalRevenueExpected || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: Euro,
      description: "Expected from active bookings",
      trend: "up" as const,
      monthlyValue: stats?.currentMonthRevenueExpected || 0,
      netValue: stats?.totalRevenueReceived || 0,
      netDescription: "Revenue Received",
      netMonthlyValue: stats?.currentMonthRevenueReceived || 0,
    },
    {
      title: "Total Profit",
      value: `€${(stats?.totalCommission || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: TrendingUp,
      description: "Base Commission (Before deductions)",
      monthlyValue: stats?.currentMonthCommission || 0,
      netValue: stats?.totalNetCommission || 0,
      netDescription: "Net Commission (After all costs)",
      netMonthlyValue: stats?.currentMonthNetCommission || 0,
      trend: stats?.totalCommission && stats.totalCommission >= 0 ? "up" as const : "down" as const,
    },
    {
      title: "Pending Fines",
      value: stats?.pendingFines || 0,
      icon: AlertCircle,
      description: "Require payment",
      trend: "neutral" as const,
      variant: "warning" as const,
    },
    {
      title: "Pending Invoices",
      value: stats?.pendingInvoices || 0,
      icon: FileText,
      description: "To be paid",
      trend: "neutral" as const,
      variant: "warning" as const,
    },
  ];

  const kpiCards = isRestrictedStaff ? restrictedKpiCards : fullKpiCards;

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-sm md:text-base text-muted-foreground">Overview of your rental operations</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={periodFilter === 'all_time' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriodFilter('all_time')}
          >
            All Time
          </Button>
          {availableYears.map(year => (
            <Button
              key={year}
              variant={periodFilter === year.toString() ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriodFilter(year.toString())}
            >
              {year}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {kpiCards.map((kpi) => (
          <Card key={kpi.title} className="shadow-card hover:shadow-elevated transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 md:px-6">
              <CardTitle className="text-xs md:text-sm font-medium">{kpi.title}</CardTitle>
              <kpi.icon className={`h-4 w-4 ${kpi.variant === 'warning' ? 'text-warning' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent className="px-4 md:px-6">
              <div className="text-xl md:text-2xl font-bold">{kpi.value}</div>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-muted-foreground">{kpi.description}</p>
                {kpi.trend === "up" && (
                  <Badge variant="success" className="px-1.5">
                    <TrendingUp className="h-3 w-3" />
                  </Badge>
                )}
                {kpi.trend === "down" && (
                  <Badge variant="destructive" className="px-1.5">
                    <TrendingDown className="h-3 w-3" />
                  </Badge>
                )}
              </div>
              
              {kpi.monthlyValue !== undefined && (
                <p className="text-[10px] text-muted-foreground">
                  This month: €{kpi.monthlyValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              )}
              
              {kpi.netValue !== undefined && (
                <>
                  <div className="text-lg font-semibold mt-2 text-primary">
                    €{kpi.netValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {kpi.netDescription}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    This month: €{(kpi.netMonthlyValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </>
              )}
              
              {kpi.secondaryStats && (
                <div className="mt-3 pt-3 border-t">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Draft:</span>
                    <span className="font-medium">{kpi.secondaryStats.draft}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Cancelled:</span>
                    <span className="font-medium">{kpi.secondaryStats.cancelled}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold mt-2 pt-2 border-t">
                    <span>Total Bookings:</span>
                    <span>{kpi.secondaryStats.total}</span>
                  </div>
                  {stats?.importedCount && stats.importedCount > 0 && (
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      + {stats.importedCount} imported (excluded from statistics)
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <a href="/bookings" className="block p-4 rounded-lg border hover:shadow-card hover:border-accent transition-all hover:scale-[1.02]">
            <div className="font-medium text-sm md:text-base">Show Bookings</div>
            <div className="text-xs md:text-sm text-muted-foreground">View all bookings</div>
          </a>
          {!isRestrictedStaff && (
            <>
              <a href="/fines" className="block p-4 rounded-lg border hover:shadow-card hover:border-accent transition-all hover:scale-[1.02]">
                <div className="font-medium text-sm md:text-base">Manage Fines</div>
                <div className="text-xs md:text-sm text-muted-foreground">View and track pending fines</div>
              </a>
              <a href="/invoices" className="block p-4 rounded-lg border hover:shadow-card hover:border-accent transition-all hover:scale-[1.02]">
                <div className="font-medium text-sm md:text-base">Review Invoices</div>
                <div className="text-xs md:text-sm text-muted-foreground">Check supplier invoices</div>
              </a>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
