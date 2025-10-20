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

  // Calculate amounts
  const initialPaymentAmount = booking.payment_amount_percent 
    ? (booking.amount_total * booking.payment_amount_percent) / 100 
    : booking.amount_total;
  const balanceAmount = booking.amount_total - booking.amount_paid;

  // Find initial payment
  const initialPayment = payments.find(p => 
    p.payment_intent === 'client_payment' || 
    (p.payment_intent !== 'balance_payment' && p.payment_intent !== 'security_deposit')
  );

  // Find balance payment link
  const balancePayment = payments.find(p => 
    p.payment_intent === 'balance_payment' && 
    (p.payment_link_status === 'pending' || p.payment_link_status === 'active')
  );

  // Find security deposit authorization
  const activeSecurityDeposit = securityDeposits.find(sd => 
    sd.status === 'pending' || sd.status === 'authorized'
  );

  // Find security deposit payment link
  const securityDepositPayment = payments.find(p => 
    p.payment_intent === 'security_deposit' && 
    (p.payment_link_status === 'pending' || p.payment_link_status === 'active')
  );

  // Paid payments for history
  const paidPayments = payments.filter(p => p.paid_at);

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
              {formatCurrency(booking.amount_paid, booking.currency)}
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
      </Card>

      {/* Initial Payment Status */}
      {initialPayment && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Initial Payment</h3>
            {getPaymentStatusBadge(initialPayment.payment_link_status, initialPayment.paid_at)}
          </div>

          {initialPayment.paid_at ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Paid on {new Date(initialPayment.paid_at).toLocaleDateString()}
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
          ) : (
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
          )}
        </Card>
      )}

      {/* Balance Payment */}
      {balancePayment && balancePayment.payment_link_url && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Balance Payment</h3>
            {getPaymentStatusBadge(balancePayment.payment_link_status)}
          </div>

          <ClientPaymentBreakdown
            originalAmount={balancePayment.original_amount || balancePayment.amount}
            currency={balancePayment.original_currency || balancePayment.currency}
            feePercentage={balancePayment.fee_percentage}
            feeAmount={balancePayment.fee_amount}
            totalAmount={balancePayment.total_amount || balancePayment.amount}
            convertedAmount={balancePayment.converted_amount}
            convertedCurrency={balancePayment.currency}
            conversionRate={balancePayment.conversion_rate_used}
            paymentIntent="balance_payment"
          />

          <Button className="w-full mt-4" asChild>
            <a href={balancePayment.payment_link_url} target="_blank" rel="noopener noreferrer">
              Pay Balance
              <ExternalLink className="h-4 w-4 ml-2" />
            </a>
          </Button>

          {balancePayment.payment_link_expires_at && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Link expires: {new Date(balancePayment.payment_link_expires_at).toLocaleString()}
            </p>
          )}
        </Card>
      )}

      {/* Security Deposit */}
      {activeSecurityDeposit && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Security Deposit</h3>
            {getDepositStatusBadge(activeSecurityDeposit.status)}
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-semibold">
                {formatCurrency(activeSecurityDeposit.amount, activeSecurityDeposit.currency)}
              </span>
            </div>

            {activeSecurityDeposit.status === 'pending' && (
              <div className="space-y-3 pt-3 border-t">
                <p className="text-sm text-muted-foreground">
                  A security deposit authorization is required. Your card will not be charged unless damages are incurred.
                </p>
                
                {securityDepositPayment?.payment_link_url && (
                  <>
                    {securityDepositPayment.fee_amount && securityDepositPayment.fee_amount > 0 && (
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Deposit Amount</span>
                          <span>{formatCurrency(securityDepositPayment.original_amount || securityDepositPayment.amount, securityDepositPayment.original_currency || securityDepositPayment.currency)}</span>
                        </div>
                        {securityDepositPayment.fee_percentage && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Processing Fee ({securityDepositPayment.fee_percentage}%)</span>
                            <span>{formatCurrency(securityDepositPayment.fee_amount, securityDepositPayment.currency)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-semibold pt-1 border-t">
                          <span>Total to Authorize</span>
                          <span>{formatCurrency(securityDepositPayment.total_amount || securityDepositPayment.amount, securityDepositPayment.currency)}</span>
                        </div>
                      </div>
                    )}
                    
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
                  </>
                )}
              </div>
            )}

            {activeSecurityDeposit.status === 'authorized' && (
              <div className="space-y-2 pt-3 border-t">
                <p className="text-sm text-green-600">
                  ✓ Security deposit authorized
                </p>
                {activeSecurityDeposit.expires_at && (
                  <p className="text-xs text-muted-foreground">
                    Authorization expires: {new Date(activeSecurityDeposit.expires_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}
          </div>
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
