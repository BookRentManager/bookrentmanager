import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart3,
  TrendingUp,
  Car,
  Users,
  Calendar,
  MapPin
} from "lucide-react";

export default function Reports() {
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
      description: "Coming soon - Performance by model and individual vehicle",
      icon: Car,
      path: "#",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      disabled: true
    },
    {
      title: "Supplier Analytics",
      description: "Coming soon - Supplier performance and cost analysis",
      icon: Users,
      path: "#",
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      disabled: true
    },
    {
      title: "Booking Trends",
      description: "Coming soon - Seasonal trends and demand patterns",
      icon: Calendar,
      path: "#",
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
      disabled: true
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

