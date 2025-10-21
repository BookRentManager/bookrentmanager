import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Download, CheckCircle2, Clock, XCircle, AlertCircle } from 'lucide-react';
import { ClientPaymentBreakdown } from './ClientPaymentBreakdown';
import { Separator } from '@/components/ui/separator';

interface Payment {
  id: string;
  type: string;
  method: string;
  amount: number;
  currency: string;
  original_amount?: number;
  original_currency?: string;
  fee_amount?: number;
  fee_percentage?: number;
  total_amount?: number;
  converted_amount?: number;
  conversion_rate_used?: number;
  payment_intent?: string;
  payment_link_url?: string;
  payment_link_status?: string;
  payment_link_expires_at?: string;
  paid_at?: string;
  receipt_url?: string;
  created_at: string;
}

interface SecurityDeposit {
  id: string;
  amount: number;
  currency: string;
  status: string;
  authorization_id: string;
  authorized_at?: string;
  expires_at?: string;
}

interface Booking {
  amount_total: number;
  amount_paid: number;
  currency: string;
  payment_amount_percent?: number;
}

interface ClientPaymentPanelProps {
  booking: Booking;
  payments: Payment[];
  securityDeposits: SecurityDeposit[];
}

export function ClientPaymentPanel({ booking, payments, securityDeposits }: ClientPaymentPanelProps) {
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const getPaymentStatusBadge = (status?: string, paidAt?: string) => {
    if (paidAt) {
      return (
        <Badge variant="default" className="gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Paid
        </Badge>
      );
    }
    
    switch (status) {
      case 'pending':
      case 'active':
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case 'cancelled':
      case 'expired':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            {status === 'expired' ? 'Expired' : 'Cancelled'}
          </Badge>
        );
      default:
        return null;
    }
  };

  const getDepositStatusBadge = (status: string) => {
    switch (status) {
      case 'authorized':
        return (
          <Badge variant="default" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Authorized
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case 'released':
        return (
          <Badge variant="outline" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Released
          </Badge>
        );
      case 'captured':
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Captured
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Calculate amounts (exclude security deposits from payment calculations)
  const actualPaidPayments = payments.filter(p => 
    p.paid_at && p.payment_intent !== 'security_deposit'
  );
  const actualAmountPaid = actualPaidPayments.reduce((sum, p) => sum + p.amount, 0);
  const initialPaymentAmount = booking.payment_amount_percent 
    ? (booking.amount_total * booking.payment_amount_percent) / 100 
    : booking.amount_total;
  const balanceAmount = booking.amount_total - actualAmountPaid;
  const balancePaymentPercent = booking.payment_amount_percent 
    ? 100 - booking.payment_amount_percent 
    : 0;

  // Find initial payment (first non-balance, non-security-deposit payment)
  const initialPayment = payments.find(p => 
    p.payment_intent === 'client_payment' || 
    (p.payment_intent !== 'balance_payment' && p.payment_intent !== 'security_deposit')
  );

  // Check if initial payment is paid
  const isInitialPaymentPaid = initialPayment?.paid_at ? true : false;

// Find balance payment (paid or unpaid) - support both 'balance_payment' and 'final_payment'
const balancePaymentPaid = payments.find(p => 
  (p.payment_intent === 'balance_payment' || p.payment_intent === 'final_payment') && 
  p.paid_at &&
  p.payment_link_status === 'paid'
);

// Find active balance payment link - support both 'balance_payment' and 'final_payment'
const balancePaymentLink = payments.find(p => 
  (p.payment_intent === 'balance_payment' || p.payment_intent === 'final_payment') && 
  !p.paid_at &&
  (p.payment_link_status === 'pending' || p.payment_link_status === 'active')
);

  // Security deposit
  const activeSecurityDeposit = securityDeposits.find(sd => 
    sd.status === 'pending' || sd.status === 'authorized'
  );

  const securityDepositPayment = payments.find(p => 
    p.payment_intent === 'security_deposit' && 
    (p.payment_link_status === 'pending' || p.payment_link_status === 'active')
  );

  // Paid payments for history (exclude security deposits - they're authorizations, not payments)
  // CRITICAL: Only show payments that are fully completed (paid_at AND payment_link_status === 'paid')
  const paidPayments = payments.filter(p => 
    p.paid_at && 
    p.payment_link_status === 'paid' && 
    p.payment_intent !== 'security_deposit'
  );

  return (
    <div className="space-y-6">
      {/* Payment Summary */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Payment Summary</h3>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Total Booking Amount</span>
            <span className="font-semibold">{formatCurrency(booking.amount_total, booking.currency)}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Amount Paid</span>
            <span className="font-semibold text-green-600">
              {formatCurrency(actualAmountPaid, booking.currency)}
            </span>
          </div>

          {balanceAmount > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Balance Due</span>
              <span className="font-semibold text-orange-600">
                {formatCurrency(balanceAmount, booking.currency)}
              </span>
            </div>
          )}
        </div>
        
        <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
          Note: Security deposit is an authorization and is not included in payment totals
        </p>
      </Card>

      {/* First Payment (Initial Payment) */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">First Payment</h3>
            {booking.payment_amount_percent && (
              <p className="text-sm text-muted-foreground">
                {booking.payment_amount_percent}% of total amount
              </p>
            )}
          </div>
          {getPaymentStatusBadge(
            initialPayment?.payment_link_status, 
            initialPayment?.paid_at
          )}
        </div>

        <div className="flex justify-between items-center mb-3">
          <span className="text-muted-foreground">Amount</span>
          <span className="font-semibold">
            {formatCurrency(initialPaymentAmount, booking.currency)}
          </span>
        </div>

        {isInitialPaymentPaid && initialPayment ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Paid on {new Date(initialPayment.paid_at!).toLocaleDateString()}
            </p>
            {initialPayment.receipt_url && (
              <Button variant="outline" size="sm" asChild>
                <a href={initialPayment.receipt_url} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4 mr-2" />
                  Download Receipt
                </a>
              </Button>
            )}
          </div>
        ) : initialPayment?.payment_link_url ? (
          <div className="space-y-3">
            <ClientPaymentBreakdown
              originalAmount={initialPayment.original_amount || initialPayment.amount}
              currency={initialPayment.original_currency || initialPayment.currency}
              feePercentage={initialPayment.fee_percentage}
              feeAmount={initialPayment.fee_amount}
              totalAmount={initialPayment.total_amount || initialPayment.amount}
              convertedAmount={initialPayment.converted_amount}
              convertedCurrency={initialPayment.currency}
              conversionRate={initialPayment.conversion_rate_used}
              paymentIntent={initialPayment.payment_intent || 'client_payment'}
            />
            <Button className="w-full" asChild>
              <a href={initialPayment.payment_link_url} target="_blank" rel="noopener noreferrer">
                Pay Now
                <ExternalLink className="h-4 w-4 ml-2" />
              </a>
            </Button>
            {initialPayment.payment_link_expires_at && (
              <p className="text-xs text-muted-foreground text-center">
                Link expires: {new Date(initialPayment.payment_link_expires_at).toLocaleString()}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Payment pending - payment link will be provided
          </p>
        )}
      </Card>

      {/* Balance Payment - Only show if there's a balance to pay */}
      {booking.payment_amount_percent && booking.payment_amount_percent < 100 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">Balance Payment</h3>
              {balancePaymentPercent > 0 && (
                <p className="text-sm text-muted-foreground">
                  {balancePaymentPercent}% of total amount
                </p>
              )}
            </div>
            {getPaymentStatusBadge(
              balancePaymentLink?.payment_link_status, 
              balancePaymentPaid?.paid_at
            )}
          </div>

          <div className="flex justify-between items-center mb-3">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-semibold">
              {formatCurrency(balanceAmount, booking.currency)}
            </span>
          </div>

          {balancePaymentPaid ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Paid on {new Date(balancePaymentPaid.paid_at!).toLocaleDateString()}
              </p>
              {balancePaymentPaid.receipt_url && (
                <Button variant="outline" size="sm" asChild>
                  <a href={balancePaymentPaid.receipt_url} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4 mr-2" />
                    Download Receipt
                  </a>
                </Button>
              )}
            </div>
          ) : balancePaymentLink?.payment_link_url ? (
            <div className="space-y-3">
              <ClientPaymentBreakdown
                originalAmount={balancePaymentLink.original_amount || balancePaymentLink.amount}
                currency={balancePaymentLink.original_currency || balancePaymentLink.currency}
                feePercentage={balancePaymentLink.fee_percentage}
                feeAmount={balancePaymentLink.fee_amount}
                totalAmount={balancePaymentLink.total_amount || balancePaymentLink.amount}
                convertedAmount={balancePaymentLink.converted_amount}
                convertedCurrency={balancePaymentLink.currency}
                conversionRate={balancePaymentLink.conversion_rate_used}
                paymentIntent="balance_payment"
              />
              <Button className="w-full" asChild>
                <a href={balancePaymentLink.payment_link_url} target="_blank" rel="noopener noreferrer">
                  Pay Balance
                  <ExternalLink className="h-4 w-4 ml-2" />
                </a>
              </Button>
              {balancePaymentLink.payment_link_expires_at && (
                <p className="text-xs text-muted-foreground text-center">
                  Link expires: {new Date(balancePaymentLink.payment_link_expires_at).toLocaleString()}
                </p>
              )}
            </div>
          ) : balanceAmount > 0 ? (
            <p className="text-sm text-muted-foreground">
              Balance payment pending - payment link will be provided
            </p>
          ) : null}
        </Card>
      )}

      {/* Security Deposit - Separated and uses "Authorized" terminology */}
      {activeSecurityDeposit && (
        <Card className="p-6 border-2 border-primary/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Security Deposit</h3>
            {getDepositStatusBadge(activeSecurityDeposit.status)}
          </div>

          <div className="flex justify-between items-center mb-3">
            <span className="text-muted-foreground">Authorization Amount</span>
            <span className="font-semibold">
              {formatCurrency(activeSecurityDeposit.amount, activeSecurityDeposit.currency)}
            </span>
          </div>

          {activeSecurityDeposit.status === 'pending' && securityDepositPayment?.payment_link_url && (
            <div className="space-y-3 pt-3 border-t">
              <p className="text-sm text-muted-foreground">
                A security deposit authorization is required. Your card will not be charged unless damages are incurred.
              </p>
              
              <Button className="w-full" asChild>
                <a href={securityDepositPayment.payment_link_url} target="_blank" rel="noopener noreferrer">
                  Authorize Security Deposit
                  <ExternalLink className="h-4 w-4 ml-2" />
                </a>
              </Button>
              
              {securityDepositPayment.payment_link_expires_at && (
                <p className="text-xs text-muted-foreground text-center">
                  Link expires: {new Date(securityDepositPayment.payment_link_expires_at).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {activeSecurityDeposit.status === 'authorized' && (
            <div className="space-y-2 pt-3 border-t">
              <p className="text-sm text-green-600 font-medium">
                ✓ Security deposit has been authorized
              </p>
              <p className="text-xs text-muted-foreground">
                This is a hold on your card, not a charge. The authorization will be released after your rental period unless damages occur.
              </p>
              {activeSecurityDeposit.expires_at && (
                <p className="text-xs text-muted-foreground">
                  Authorization expires: {new Date(activeSecurityDeposit.expires_at).toLocaleDateString()}
                </p>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Payment History */}
      {paidPayments.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Payment History</h3>
          
          <div className="space-y-3">
            {paidPayments.map((payment, index) => (
              <div key={payment.id}>
                {index > 0 && <Separator className="my-3" />}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">
                        {formatCurrency(payment.amount, payment.currency)}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {payment.payment_intent || payment.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {new Date(payment.paid_at!).toLocaleDateString()} · {payment.method}
                    </p>
                  </div>
                  {payment.receipt_url && (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={payment.receipt_url} target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
