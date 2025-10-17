import { useNavigate, Routes, Route } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart3,
  TrendingUp,
  Car,
  Users,
  Calendar,
  MapPin,
  CreditCard
} from "lucide-react";
import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy load report pages
const GeneralDashboard = lazy(() => import("./reports/GeneralDashboard"));
const FinancialReports = lazy(() => import("./reports/FinancialReports"));
const CarPerformance = lazy(() => import("./reports/CarPerformance"));
const SupplierAnalytics = lazy(() => import("./reports/SupplierAnalytics"));
const ClientAnalytics = lazy(() => import("./reports/ClientAnalytics"));
const BookingTrends = lazy(() => import("./reports/BookingTrends"));
const PaymentAnalytics = lazy(() => import("./reports/PaymentAnalytics"));

const LoadingFallback = () => (
  <div className="space-y-4">
    <Skeleton className="h-8 w-48" />
    <Skeleton className="h-4 w-64" />
  </div>
);

function ReportsIndex() {
  const navigate = useNavigate();

  const reportSections = [
    {
      title: "General Dashboard",
      description: "Overview of key business metrics including revenue, bookings, and conversion rates",
      icon: BarChart3,
      path: "/reports/general-dashboard",
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      title: "Financial Reports",
      description: "Revenue analysis, profitability metrics, and cash flow tracking",
      icon: TrendingUp,
      path: "/reports/financial",
      color: "text-green-600",
      bgColor: "bg-green-50"
    },
    {
      title: "Car Performance",
      description: "Performance by model and individual vehicle analysis",
      icon: Car,
      path: "/reports/car-performance",
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    },
    {
      title: "Supplier Analytics",
      description: "Supplier performance and cost analysis",
      icon: Users,
      path: "/reports/supplier-analytics",
      color: "text-orange-600",
      bgColor: "bg-orange-50"
    },
    {
      title: "Client Analytics",
      description: "Client behavior, lifetime value, and payment patterns",
      icon: Users,
      path: "/reports/client-analytics",
      color: "text-indigo-600",
      bgColor: "bg-indigo-50"
    },
    {
      title: "Booking Trends",
      description: "Seasonal trends, demand patterns, and booking behavior",
      icon: Calendar,
      path: "/reports/booking-trends",
      color: "text-cyan-600",
      bgColor: "bg-cyan-50"
    },
    {
      title: "Payment Analytics",
      description: "Payment methods, fee revenue, and conversion rate analysis",
      icon: CreditCard,
      path: "/reports/payment-analytics",
      color: "text-emerald-600",
      bgColor: "bg-emerald-50"
    },
    {
      title: "Location Analysis",
      description: "Coming soon - Performance by pickup/dropoff location",
      icon: MapPin,
      path: "#",
      color: "text-red-600",
      bgColor: "bg-red-50",
      disabled: true
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Reports</h2>
        <p className="text-muted-foreground">Comprehensive analytics and insights for your business</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {reportSections.map((section) => (
          <Card
            key={section.title}
            className={`cursor-pointer transition-all hover:shadow-lg ${
              section.disabled ? 'opacity-60 cursor-not-allowed' : 'hover-scale'
            }`}
            onClick={() => !section.disabled && navigate(section.path)}
          >
            <CardHeader>
              <div className={`w-12 h-12 rounded-lg ${section.bgColor} flex items-center justify-center mb-4`}>
                <section.icon className={`h-6 w-6 ${section.color}`} />
              </div>
              <CardTitle className="text-xl">{section.title}</CardTitle>
              <CardDescription className="text-sm">
                {section.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {section.disabled ? (
                <p className="text-xs text-muted-foreground italic">Available soon</p>
              ) : (
                <p className="text-sm font-medium text-primary">Click to view details →</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function Reports() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route index element={<ReportsIndex />} />
        <Route path="general-dashboard" element={<GeneralDashboard />} />
        <Route path="financial" element={<FinancialReports />} />
        <Route path="car-performance" element={<CarPerformance />} />
        <Route path="supplier-analytics" element={<SupplierAnalytics />} />
        <Route path="client-analytics" element={<ClientAnalytics />} />
        <Route path="booking-trends" element={<BookingTrends />} />
        <Route path="payment-analytics" element={<PaymentAnalytics />} />
      </Routes>
    </Suspense>
  );
}

