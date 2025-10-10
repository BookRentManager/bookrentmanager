import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { format } from "date-fns";

export default function Bookings() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const filteredBookings = bookings?.filter((booking) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      booking.client_name.toLowerCase().includes(searchLower) ||
      booking.car_plate.toLowerCase().includes(searchLower) ||
      booking.reference_code.toLowerCase().includes(searchLower)
    );
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
      confirmed: { variant: "default", className: "bg-success text-success-foreground" },
      to_be_confirmed: { variant: "secondary", className: "bg-warning text-warning-foreground" },
      cancelled: { variant: "destructive" },
    };
    return variants[status] || { variant: "outline" };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Bookings</h2>
          <p className="text-muted-foreground">Manage your rental reservations</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New Booking
        </Button>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by client, plate, or reference..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredBookings && filteredBookings.length > 0 ? (
              filteredBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{booking.reference_code}</span>
                      <Badge {...getStatusBadge(booking.status)}>
                        {booking.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {booking.client_name} • {booking.car_model} ({booking.car_plate})
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(booking.delivery_datetime), "PPP")} - {format(new Date(booking.collection_datetime), "PPP")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">€{Number(booking.rental_price_gross).toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">
                      Paid: €{Number(booking.amount_paid).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                {searchTerm ? "No bookings found matching your search" : "No bookings yet"}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
