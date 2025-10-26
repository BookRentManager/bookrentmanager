import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Car, MapPin, User, CreditCard, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import crownIcon from '@/assets/crown.png';

interface ClientBookingOverviewProps {
  booking: any;
  appSettings?: any;
}

export function ClientBookingOverview({ booking, appSettings }: ClientBookingOverviewProps) {
  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
      draft: { variant: "secondary" },
      confirmed: { variant: "default", className: "bg-green-600 hover:bg-green-700" },
      ongoing: { variant: "default" },
      completed: { variant: "default", className: "bg-green-600 hover:bg-green-700" },
      cancelled: { variant: "destructive" },
    };
    const statusVariant = variants[status] || { variant: "secondary" as const };
    return <Badge variant={statusVariant.variant} className={statusVariant.className}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Booking Status Banner */}
      <Card className="border-king-gold/30 bg-gradient-to-r from-king-black/5 to-king-gold/5">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                Booking Status
              </p>
              <div className="flex flex-wrap gap-2">
                {getStatusBadge(booking.status)}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground mb-1">Reference</p>
              <p className="font-mono font-semibold text-lg text-king-gold-dark">{booking.reference_code}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Client Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Client Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{booking.client_name}</p>
            </div>
            {booking.client_email && (
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{booking.client_email}</p>
              </div>
            )}
            {booking.client_phone && (
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{booking.client_phone}</p>
              </div>
            )}
            {booking.country && (
              <div>
                <p className="text-sm text-muted-foreground">Country</p>
                <p className="font-medium">{booking.country}</p>
              </div>
            )}
          </div>
          
          {booking.billing_address && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-1">Billing Address</p>
                <p className="font-medium">{booking.billing_address}</p>
              </div>
            </>
          )}
          
          {booking.company_name && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-1">Company</p>
                <p className="font-medium">{booking.company_name}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Guest Information */}
      {booking.guest_name && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Guest Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{booking.guest_name}</p>
              </div>
              {booking.guest_phone && (
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{booking.guest_phone}</p>
                </div>
              )}
              {booking.guest_country && (
                <div>
                  <p className="text-sm text-muted-foreground">Country</p>
                  <p className="font-medium">{booking.guest_country}</p>
                </div>
              )}
            </div>
            
            {booking.guest_billing_address && (
              <>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Billing Address</p>
                  <p className="font-medium">{booking.guest_billing_address}</p>
                </div>
              </>
            )}
            
            {booking.guest_company_name && (
              <>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Company</p>
                  <p className="font-medium">{booking.guest_company_name}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Vehicle Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Vehicle Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <p className="text-sm text-muted-foreground">Model</p>
            <p className="font-medium">{booking.car_model}</p>
          </div>
        </CardContent>
      </Card>

      {/* Rental Period */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Rental Period
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Delivery</p>
            <p className="font-medium">{format(new Date(booking.delivery_datetime), 'PPP p')}</p>
          </div>
          <Separator />
          <div>
            <p className="text-sm text-muted-foreground mb-1">Collection</p>
            <p className="font-medium">{format(new Date(booking.collection_datetime), 'PPP p')}</p>
          </div>
        </CardContent>
      </Card>

      {/* Locations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Locations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Delivery Location</p>
            <p className="font-medium">{booking.delivery_location}</p>
            {booking.delivery_info && (
              <p className="text-sm text-muted-foreground mt-1">{booking.delivery_info}</p>
            )}
          </div>
          <Separator />
          <div>
            <p className="text-sm text-muted-foreground mb-1">Collection Location</p>
            <p className="font-medium">{booking.collection_location}</p>
            {booking.collection_info && (
              <p className="text-sm text-muted-foreground mt-1">{booking.collection_info}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Security Deposit */}
      {booking.security_deposit_amount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Security Deposit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Amount</p>
                <p className="font-medium text-lg">{formatCurrency(booking.security_deposit_amount, booking.currency)}</p>
              </div>
              {booking.security_deposit_authorized_at && (
                <Badge variant="default" className="gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Authorized
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              This amount will be pre-authorized on your card but not charged unless damages occur.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Payment Summary */}
      <Card className="border-king-gold/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-playfair text-king-gold-dark">
            <CreditCard className="h-5 w-5 text-king-gold" />
            Payment Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Total Amount</span>
            <span className="font-semibold text-lg">{formatCurrency(booking.amount_total, booking.currency)}</span>
          </div>
          <Separator className="bg-king-gold/20" />
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Amount Paid</span>
            <span className="font-semibold text-king-gold">{formatCurrency(booking.amount_paid, booking.currency)}</span>
          </div>
          {booking.amount_total - booking.amount_paid > 0 && (
            <>
              <Separator className="bg-king-gold/20" />
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Balance Due</span>
                <span className="font-semibold text-orange-600">
                  {formatCurrency(booking.amount_total - booking.amount_paid, booking.currency)}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Terms & Conditions Acceptance */}
      {booking.tc_accepted_at && (
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-muted-foreground">
                Terms & Conditions accepted on {format(new Date(booking.tc_accepted_at), 'PPP')}
              </span>
            </div>
            {booking.tc_accepted_ip && (
              <p className="text-xs text-muted-foreground mt-1 ml-6">
                IP: {booking.tc_accepted_ip}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
