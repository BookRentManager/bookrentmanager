import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Car, CreditCard } from "lucide-react";

interface BookingSummary {
  reference_code: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  car_model: string;
  car_plate: string;
  delivery_datetime: string;
  collection_datetime: string;
  delivery_location: string;
  collection_location: string;
  amount_total: number;
  amount_paid: number;
  currency: string;
  status: string;
}

interface BookingFormSummaryProps {
  booking: BookingSummary;
}

export const BookingFormSummary = ({ booking }: BookingFormSummaryProps) => {
  const remainingAmount = booking.amount_total - booking.amount_paid;

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Booking Summary</h2>
          <Badge variant={booking.status === "confirmed" ? "default" : "secondary"}>
            {booking.reference_code}
          </Badge>
        </div>

        <Separator />

        {/* Client Information */}
        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-muted-foreground">Client Information</h3>
          <div className="space-y-1">
            <p className="font-medium">{booking.client_name}</p>
            <p className="text-sm text-muted-foreground">{booking.client_email}</p>
            <p className="text-sm text-muted-foreground">{booking.client_phone}</p>
          </div>
        </div>

        <Separator />

        {/* Vehicle Information */}
        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
            <Car className="h-4 w-4" />
            Vehicle
          </h3>
          <div className="space-y-1">
            <p className="font-medium">{booking.car_model}</p>
            <p className="text-sm text-muted-foreground">Plate: {booking.car_plate}</p>
          </div>
        </div>

        <Separator />

        {/* Rental Period */}
        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Rental Period
          </h3>
          <div className="space-y-2">
            <div>
              <p className="text-sm font-medium">Delivery</p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(booking.delivery_datetime), "PPpp")}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Collection</p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(booking.collection_datetime), "PPpp")}
              </p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Locations */}
        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Locations
          </h3>
          <div className="space-y-2">
            <div>
              <p className="text-sm font-medium">Delivery Location</p>
              <p className="text-sm text-muted-foreground">{booking.delivery_location}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Collection Location</p>
              <p className="text-sm text-muted-foreground">{booking.collection_location}</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Payment Summary */}
        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Payment Summary
          </h3>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>Total Amount:</span>
              <span className="font-medium">
                {booking.currency} {booking.amount_total.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Paid:</span>
              <span className="font-medium text-green-600">
                {booking.currency} {booking.amount_paid.toFixed(2)}
              </span>
            </div>
            {remainingAmount > 0 && (
              <div className="flex justify-between text-sm pt-2 border-t">
                <span className="font-semibold">Remaining:</span>
                <span className="font-semibold text-orange-600">
                  {booking.currency} {remainingAmount.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};
