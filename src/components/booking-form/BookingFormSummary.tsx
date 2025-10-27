import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar, MapPin, Car, CreditCard, Info } from "lucide-react";
import crownIcon from "@/assets/crown.png";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { calculateRentalDays } from "@/lib/utils";
import { useEffect } from "react";

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
  security_deposit_amount?: number;
  guest_name?: string;
  guest_phone?: string;
  guest_billing_address?: string;
  guest_country?: string;
  guest_company_name?: string;
  rental_day_hour_tolerance?: number;
  className?: string;
}

interface BookingFormSummaryProps {
  booking: BookingSummary;
  className?: string;
  deliveryTime?: string;
  onDeliveryTimeChange?: (time: string) => void;
  collectionTime?: string;
  onCollectionTimeChange?: (time: string) => void;
  deliveryNotes?: string;
  onDeliveryNotesChange?: (notes: string) => void;
  collectionNotes?: string;
  onCollectionNotesChange?: (notes: string) => void;
  onTimeValidation?: (exceedsTolerance: boolean) => void;
}

export const BookingFormSummary = ({ 
  booking, 
  className,
  deliveryTime,
  onDeliveryTimeChange,
  collectionTime,
  onCollectionTimeChange,
  deliveryNotes,
  onDeliveryNotesChange,
  collectionNotes,
  onCollectionNotesChange,
  onTimeValidation
}: BookingFormSummaryProps) => {
  const remainingAmount = booking.amount_total - booking.amount_paid;
  const securityDeposit = booking.security_deposit_amount || 0;

  // Calculate rental duration to show 24-hour warning conditionally
  const deliveryDateTime = new Date(booking.delivery_datetime);
  const collectionDateTime = new Date(booking.collection_datetime);

  // If times are being edited, use the edited times
  let actualCollectionDateTime = collectionDateTime;
  let actualDeliveryDateTime = deliveryDateTime;
  
  if (deliveryTime && collectionTime) {
    const [deliveryHours, deliveryMinutes] = deliveryTime.split(':').map(Number);
    const [collectionHours, collectionMinutes] = collectionTime.split(':').map(Number);
    
    const editedDeliveryDateTime = new Date(deliveryDateTime);
    editedDeliveryDateTime.setHours(deliveryHours, deliveryMinutes, 0, 0);
    
    const editedCollectionDateTime = new Date(collectionDateTime);
    editedCollectionDateTime.setHours(collectionHours, collectionMinutes, 0, 0);
    
    actualCollectionDateTime = editedCollectionDateTime;
    actualDeliveryDateTime = editedDeliveryDateTime;
  }

  // Get the tolerance from booking data (default to 1 if not set)
  const hourTolerance = booking.rental_day_hour_tolerance || 1;

  // Calculate rental days using utility function
  const rentalCalculation = calculateRentalDays(
    actualDeliveryDateTime,
    actualCollectionDateTime,
    hourTolerance
  );

  // Notify parent component when tolerance is exceeded
  useEffect(() => {
    if (onTimeValidation) {
      onTimeValidation(rentalCalculation.exceedsTolerance);
    }
  }, [rentalCalculation.exceedsTolerance, onTimeValidation]);

  return (
    <Card className={`p-6 border-king-gold/30 shadow-king-gold ${className || ''}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-playfair font-bold text-king-gold-dark">Booking Summary</h2>
          <div className="flex flex-col items-end gap-1">
            <Badge 
              variant={booking.status === "confirmed" ? "default" : "secondary"}
              className={booking.status === "confirmed" ? "bg-king-gold text-king-black" : ""}
            >
              {booking.reference_code}
            </Badge>
          </div>
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
          
          {/* Rental Duration Display */}
          <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md p-2">
            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Rental Duration:</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300">
                <Calendar className="h-3 w-3 mr-1" />
                {rentalCalculation.formattedTotal}
              </Badge>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">{rentalCalculation.formattedDuration}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Tolerance: {hourTolerance} hour{hourTolerance !== 1 ? 's' : ''}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          
          {/* Rental day notice - only show if duration exceeds tolerance */}
          {rentalCalculation.exceedsTolerance && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-900 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-200">
              <p className="font-medium mb-1">⏰ Rental Day Policy:</p>
              <p>
                Please note: each rental day covers a maximum of 24 hours, with a {hourTolerance}-hour tolerance.
                Your rental period is <strong>{rentalCalculation.formattedDuration}</strong>, which will be counted as <strong>{rentalCalculation.formattedTotal}</strong>.
                Extra costs may apply. Please contact your Reservation Manager to confirm.
              </p>
            </div>
          )}
          
          <div className="space-y-3 mt-3">
            <div>
              <p className="text-sm font-medium mb-1">Delivery</p>
              <p className="text-sm text-muted-foreground">
                📅 {format(new Date(booking.delivery_datetime), "PPP")}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground">🕐</span>
                {deliveryTime !== undefined && onDeliveryTimeChange ? (
                  <Input
                    type="time"
                    value={deliveryTime}
                    onChange={(e) => onDeliveryTimeChange(e.target.value)}
                    className="w-32 h-8 text-sm"
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(booking.delivery_datetime), "p")}
                  </span>
                )}
              </div>
              {deliveryNotes !== undefined && onDeliveryNotesChange && (
                <div className="mt-2">
                  <Label className="text-xs text-muted-foreground">
                    Delivery Notes (Flight number, hotel, or any relevant info)
                  </Label>
                  <Textarea
                    value={deliveryNotes}
                    onChange={(e) => onDeliveryNotesChange(e.target.value)}
                    placeholder="e.g., Flight LX123, Hotel Marriott, Terminal 2"
                    className="mt-1 text-sm min-h-[60px]"
                    rows={2}
                  />
                </div>
              )}
            </div>
            
            <div>
              <p className="text-sm font-medium mb-1">Collection</p>
              <p className="text-sm text-muted-foreground">
                📅 {format(new Date(booking.collection_datetime), "PPP")}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground">🕐</span>
                {collectionTime !== undefined && onCollectionTimeChange ? (
                  <Input
                    type="time"
                    value={collectionTime}
                    onChange={(e) => onCollectionTimeChange(e.target.value)}
                    className="w-32 h-8 text-sm"
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(booking.collection_datetime), "p")}
                  </span>
                )}
              </div>
              {collectionNotes !== undefined && onCollectionNotesChange && (
                <div className="mt-2">
                  <Label className="text-xs text-muted-foreground">
                    Collection Notes (Flight number, hotel, or any relevant info)
                  </Label>
                  <Textarea
                    value={collectionNotes}
                    onChange={(e) => onCollectionNotesChange(e.target.value)}
                    placeholder="e.g., Flight LX456, Hotel Hilton, Meeting point"
                    className="mt-1 text-sm min-h-[60px]"
                    rows={2}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <Separator />

        {booking.guest_name && (
          <>
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-muted-foreground">Guest Information</h3>
              <div className="space-y-1">
                <p className="font-medium">{booking.guest_name}</p>
                {booking.guest_phone && <p className="text-sm text-muted-foreground">{booking.guest_phone}</p>}
                {booking.guest_country && <p className="text-sm text-muted-foreground">{booking.guest_country}</p>}
                {booking.guest_billing_address && (
                  <p className="text-xs text-muted-foreground">{booking.guest_billing_address}</p>
                )}
                {booking.guest_company_name && (
                  <p className="text-sm text-muted-foreground">{booking.guest_company_name}</p>
                )}
              </div>
            </div>
            <Separator />
          </>
        )}

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

        {securityDeposit > 0 && (
          <>
            <Separator />
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">Security Deposit Required</h4>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                €{Number(securityDeposit).toLocaleString()} will be held before pickup and released after return.
              </p>
            </div>
          </>
        )}
      </div>
    </Card>
  );
};
