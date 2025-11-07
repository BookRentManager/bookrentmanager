import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Car, MapPin, User, CreditCard, CheckCircle, HelpCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import crownIcon from '@/assets/crown.png';
import { calculateRentalDays } from '@/lib/utils';
import { hasPermission } from '@/lib/permissions';

interface ClientBookingOverviewProps {
  booking: any;
  appSettings?: any;
  payments?: any[];
  permissionLevel?: string;
}

export function ClientBookingOverview({ booking, appSettings, payments, permissionLevel }: ClientBookingOverviewProps) {
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

  const rentalCalculation = calculateRentalDays(
    new Date(booking.delivery_datetime),
    new Date(booking.collection_datetime),
    booking.rental_day_hour_tolerance || 1
  );

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
                {booking.status === 'confirmed' && payments?.some((p: any) => 
                  p.payment_link_status === 'pending' && p.payment_intent !== 'security_deposit'
                ) && (
                  <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-200">
                    Pending Payment
                  </Badge>
                )}
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
            {hasPermission(permissionLevel as any, 'view_confidential') && booking.client_email && (
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{booking.client_email}</p>
              </div>
            )}
            {hasPermission(permissionLevel as any, 'view_confidential') && booking.client_phone && (
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
          
          {hasPermission(permissionLevel as any, 'view_confidential') && booking.billing_address && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-1">Billing Address</p>
                <p className="font-medium">{booking.billing_address}</p>
              </div>
            </>
          )}
          
          {hasPermission(permissionLevel as any, 'view_confidential') && booking.company_name && (
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
      {hasPermission(permissionLevel as any, 'view_confidential') && booking.guest_name && (
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
          <Separator />
          <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md p-2">
            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Rental Duration:</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300">
                <Calendar className="h-3 w-3 mr-1" />
                {rentalCalculation.formattedTotal}
              </Badge>
              <span className="text-xs text-muted-foreground">
                ({rentalCalculation.formattedDuration})
              </span>
            </div>
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
      {hasPermission(permissionLevel as any, 'view_amounts') && booking.security_deposit_amount > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Security Deposit
              </CardTitle>
              
              {/* Help Button with Policy Details */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 shrink-0"
                    aria-label="Security deposit policy information"
                  >
                    <HelpCircle className="h-5 w-5 text-primary" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 md:w-96 z-50 bg-background" align="end">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm">Security Deposit Policy</h4>
                    
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <p>
                        A refundable security deposit is held as a <span className="font-medium text-foreground">pre-authorization</span> on your credit/debit card before vehicle pickup.
                      </p>
                      
                      <div className="pt-2 border-t">
                        <p className="font-medium text-foreground mb-1">Release Timeline:</p>
                        <p>The deposit will be released within <span className="font-medium text-foreground">7-14 business days</span> after the vehicle is returned in its original condition, subject to inspection.</p>
                      </div>
                      
                      <div className="pt-2 border-t">
                        <p className="font-medium text-foreground mb-1">The deposit may be used to cover:</p>
                        <ul className="list-disc list-inside space-y-1 ml-1">
                          <li>Vehicle damages</li>
                          <li>Traffic fines or toll fees</li>
                          <li>Missing fuel</li>
                          <li>Contract violations</li>
                          <li>Late return fees</li>
                        </ul>
                      </div>
                      
                      <div className="pt-2 border-t">
                        <p className="font-medium text-foreground mb-1">Important Notes:</p>
                        <ul className="list-disc list-inside space-y-1 ml-1">
                          <li>This is a hold, not a charge</li>
                          <li>The amount depends on the vehicle type</li>
                          <li>A valid credit/debit card is required</li>
                          <li>Release time depends on your bank</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
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
            
            {/* Help indicator */}
            <div className="mt-3 pt-3 border-t flex items-center gap-2 text-xs text-muted-foreground">
              <HelpCircle className="h-3 w-3" />
              <span>Click the help icon above for detailed policy information</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Summary */}
      {hasPermission(permissionLevel as any, 'view_amounts') && (
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
      )}

      {/* Terms & Conditions Acceptance */}
      {hasPermission(permissionLevel as any, 'view_confidential') && booking.tc_accepted_at && (
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
