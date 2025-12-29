import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Download, CheckCircle2, Clock, XCircle, AlertCircle, Eye, FileText, CreditCard, Building2, Banknote } from 'lucide-react';
import { ClientPaymentBreakdown } from './ClientPaymentBreakdown';
import { Separator } from '@/components/ui/separator';
import { BankTransferProofUpload } from '@/components/BankTransferProofUpload';
import { useNavigate } from 'react-router-dom';
import { hasPermission } from '@/lib/permissions';
import { PaymentStatusOnlyView } from './PaymentStatusOnlyView';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { PaymentReceiptPDF } from '@/components/PaymentReceiptPDF';
import { useToast } from '@/hooks/use-toast';

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
  payment_method_type?: string;
  proof_url?: string;
  postfinance_transaction_id?: string;
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
  postfinance_transaction_id?: string;
}

interface Booking {
  id: string;
  reference_code: string;
  client_name: string;
  client_email?: string;
  car_model: string;
  car_plate: string;
  amount_total: number;
  amount_paid: number;
  currency: string;
  payment_amount_percent?: number;
  security_deposit_authorized_at?: string;
}

interface PaymentMethod {
  id: string;
  method_type: string;
  display_name: string;
  description?: string;
  fee_percentage: number;
  currency: string;
  requires_conversion: boolean;
}

interface ClientPaymentPanelProps {
  booking: Booking;
  payments: Payment[];
  securityDeposits: SecurityDeposit[];
  paymentMethods: PaymentMethod[];
  permissionLevel?: string;
  appSettings?: any;
}

export function ClientPaymentPanel({ booking, payments, securityDeposits, paymentMethods, permissionLevel, appSettings }: ClientPaymentPanelProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // If delivery driver, show simplified status-only view
  if (!hasPermission(permissionLevel as any, 'view_amounts')) {
    return <PaymentStatusOnlyView payments={payments} securityDeposits={securityDeposits} />;
  }
  
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const getPaymentMethodIcon = (methodType?: string | null) => {
    switch (methodType) {
      case 'visa_mastercard':
        return <CreditCard className="h-4 w-4" />;
      case 'amex':
        return <CreditCard className="h-4 w-4" />;
      case 'bank_transfer':
        return <Building2 className="h-4 w-4" />;
      case 'manual':
        return <Banknote className="h-4 w-4" />;
      default:
        return <CreditCard className="h-4 w-4" />;
    }
  };

  const getPaymentMethodLabel = (methodType?: string | null) => {
    switch (methodType) {
      case 'visa_mastercard':
        return 'Visa/Mastercard';
      case 'amex':
        return 'American Express';
      case 'bank_transfer':
        return 'Bank Transfer';
      case 'manual':
        return 'Manual Payment';
      default:
        return 'Card Payment';
    }
  };

  const getPaymentMethodDisplayName = (methodType?: string | null) => {
    switch (methodType) {
      case 'visa_mastercard':
        return 'Visa/MC';
      case 'amex':
        return 'Amex';
      case 'bank_transfer':
        return 'Bank Transfer';
      default:
        return 'Card';
    }
  };

  const getPaymentStatusBadge = (status?: string, paidAt?: string) => {
    if (paidAt || status === 'paid') {
      return (
        <Badge variant="default" className="gap-1 bg-green-600 text-white">
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
          <Badge variant="warning" className="gap-1">
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
    p.payment_intent === 'down_payment' ||
    p.payment_intent === 'final_payment' ||
    (p.payment_intent !== 'balance_payment' && p.payment_intent !== 'security_deposit')
  );
  
  // Find bank transfer payments
  const bankTransferPayments = payments.filter(p =>
    p.payment_method_type === 'bank_transfer' &&
    p.payment_link_status === 'pending'
  );

  // Check if initial payment is paid
  const isInitialPaymentPaid = initialPayment?.paid_at ? true : false;

  // Find balance payment (paid or unpaid) - support both 'balance_payment' and 'final_payment'
  // CRITICAL: Must have paid_at, payment_link_status === 'paid', AND transaction ID for real payment
  const balancePaymentPaid = payments.find(p => 
    (p.payment_intent === 'balance_payment' || p.payment_intent === 'final_payment') && 
    p.paid_at && 
    p.payment_link_status === 'paid' &&
    (p as any).postfinance_transaction_id // Must have real transaction
  );

  // Find active balance payment link - support both 'balance_payment' and 'final_payment'
  // Must NOT be paid and have active/pending status
  const balancePaymentLink = payments.find(p => 
    (p.payment_intent === 'balance_payment' || p.payment_intent === 'final_payment') && 
    !p.paid_at &&
    ['pending', 'active'].includes(p.payment_link_status || '')
  );

  // Security deposit
  const activeSecurityDeposit = securityDeposits.find(sd => 
    sd.status === 'pending' || sd.status === 'authorized'
  );

  // Find security deposit payment link (for authorization)
  // CRITICAL: NOT paid (security deposits shouldn't be "paid", they're authorized)
  const securityDepositPayment = payments.find(p => 
    p.payment_intent === 'security_deposit' && 
    !p.paid_at && // NOT paid
    ['pending', 'active'].includes(p.payment_link_status || '')
  );

  // Paid payments for history (exclude security deposits AND require real transactions)
  // CRITICAL: Only show payments with actual PostFinance transactions
  const paidPayments = payments.filter(p => 
    p.paid_at && 
    p.payment_link_status === 'paid' && 
    p.payment_intent !== 'security_deposit' &&
    (p as any).postfinance_transaction_id // Must have real transaction
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
        ) : initialPayment?.payment_method_type === 'bank_transfer' ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg mb-3">
              <Clock className="h-4 w-4 text-orange-600" />
              <p className="text-sm text-orange-900 dark:text-orange-100">
                Awaiting bank transfer confirmation
              </p>
            </div>
            
            {initialPayment?.proof_url ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div className="flex-1">
                    <p className="font-medium text-green-900 dark:text-green-100">
                      Payment Proof Uploaded
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Awaiting admin confirmation
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(initialPayment.proof_url, '_blank')}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </Button>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate(`/payment/bank-transfer?payment_id=${initialPayment.id}`)}
                >
                  View Bank Details
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground mb-3">
                  Upload your payment confirmation to help us process your payment faster
                </p>
                <BankTransferProofUpload 
                  paymentId={initialPayment.id} 
                  currentProofUrl={initialPayment.proof_url}
                  onUploadSuccess={() => window.location.reload()}
                />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate(`/payment/bank-transfer?payment_id=${initialPayment.id}`)}
                >
                  View Bank Details
                </Button>
              </div>
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
              {formatCurrency(
                balancePaymentPaid?.amount || balancePaymentLink?.amount || balanceAmount, 
                booking.currency
              )}
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
          ) : (() => {
            // Check if balance is already paid
            const balanceAlreadyPaid = payments.some(p => 
              (p.payment_intent === 'balance_payment' || p.payment_intent === 'final_payment') && 
              p.paid_at
            );
            
            // Check if client has committed to a payment method (uploaded proof or paid)
            const hasCommittedToBalanceMethod = payments.some(p => 
              (p.payment_intent === 'balance_payment' || p.payment_intent === 'final_payment') && 
              (p.proof_url || p.paid_at || p.payment_link_status === 'pending')
            );
            
            // Find all balance payment links (Visa/MC, Amex, Bank Transfer)
            // Only show 'active' options if client hasn't committed to a method
            // Deduplicate by payment_method_type - only show one link per method (most recent)
            // Include both 'active' AND 'pending' status for balance links
            // Bank transfers may stay as 'pending', card payments become 'active'
            const allBalanceLinks = !balanceAlreadyPaid && !hasCommittedToBalanceMethod ? payments.filter(p => 
              (p.payment_intent === 'balance_payment' || p.payment_intent === 'final_payment') && 
              !p.paid_at &&
              ['active', 'pending'].includes(p.payment_link_status || '')
            ) : [];
            
            // Deduplicate: keep only the most recent link per payment_method_type
            const methodMap = new Map<string, Payment>();
            allBalanceLinks.forEach(link => {
              const methodType = link.payment_method_type || 'unknown';
              const existing = methodMap.get(methodType);
              // Keep the more recent one (compare created_at)
              if (!existing || new Date(link.created_at) > new Date(existing.created_at)) {
                methodMap.set(methodType, link);
              }
            });
            const balanceLinks = Array.from(methodMap.values());
            
            return balanceLinks.length > 0 ? (
              <Card className="p-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">Choose Payment Method</h4>
                    <span className="text-sm font-semibold">{formatCurrency(balanceAmount, booking.currency)}</span>
                  </div>
                  
                  {/* Show breakdown once from first link */}
                  {balanceLinks[0] && (
                    <div className="text-xs text-muted-foreground border-t pt-2">
                      <ClientPaymentBreakdown 
                        originalAmount={balanceLinks[0].original_amount || balanceLinks[0].amount}
                        currency={balanceLinks[0].original_currency || balanceLinks[0].currency}
                        feePercentage={balanceLinks[0].fee_percentage}
                        feeAmount={balanceLinks[0].fee_amount}
                        totalAmount={balanceLinks[0].total_amount || balanceLinks[0].amount}
                        convertedAmount={balanceLinks[0].converted_amount}
                        convertedCurrency={balanceLinks[0].currency}
                        conversionRate={balanceLinks[0].conversion_rate_used}
                        paymentIntent={balanceLinks[0].payment_intent}
                      />
                    </div>
                  )}
                  
                  {/* Compact payment method buttons - black with white text */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {balanceLinks.map((link) => {
                      if (link.payment_method_type === 'bank_transfer') {
                        return (
                          <Button 
                            key={link.id}
                            variant="default"
                            size="sm"
                            className="w-full"
                            onClick={() => navigate(`/payment/bank-transfer?payment_id=${link.id}`)}
                          >
                            <Building2 className="h-4 w-4 mr-2" />
                            Bank Transfer
                          </Button>
                        );
                      }
                      
                      return (
                        <Button 
                          key={link.id}
                          variant="default"
                          size="sm"
                          className="w-full"
                          asChild
                        >
                          <a href={link.payment_link_url} target="_blank" rel="noopener noreferrer">
                            {getPaymentMethodIcon(link.payment_method_type)}
                            <span className="ml-2">{getPaymentMethodDisplayName(link.payment_method_type)}</span>
                          </a>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </Card>
            ) : balanceAmount > 0 ? (
              <p className="text-sm text-muted-foreground">
                Balance payment links will be generated after initial payment
              </p>
            ) : null;
          })()}
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

          {activeSecurityDeposit.status === 'pending' && (() => {
            // Check if deposit is already authorized
            const depositAlreadyAuthorized = booking.security_deposit_authorized_at !== null;
            
            // Check if client has committed to a deposit method
            const hasCommittedToDepositMethod = payments.some(p => 
              p.payment_intent === 'security_deposit' && 
              (p.proof_url || p.paid_at || p.payment_link_status === 'pending')
            );
            
            // Find all security deposit authorization links (Visa/MC, Amex)
            // Only show 'active' options if client hasn't committed to a method
            // Deduplicate by payment_method_type - only show one link per method
            const allDepositLinks = !depositAlreadyAuthorized && !hasCommittedToDepositMethod ? payments.filter(p => 
              p.payment_intent === 'security_deposit' && 
              !p.paid_at &&
              ['active'].includes(p.payment_link_status || '')
            ) : [];
            
            // Deduplicate: keep only one link per payment_method_type
            const seenDepositMethods = new Set<string>();
            const depositLinks = allDepositLinks.filter(link => {
              const methodType = link.payment_method_type || 'unknown';
              if (seenDepositMethods.has(methodType)) return false;
              seenDepositMethods.add(methodType);
              return true;
            });
            
            return depositLinks.length > 0 ? (
              <div className="space-y-2 pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  Required authorization (not a charge). Amount will be held and released after rental.
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {depositLinks.map((link) => (
                    <Button 
                      key={link.id}
                      variant="default"
                      size="sm"
                      className="w-full"
                      asChild
                    >
                      <a href={link.payment_link_url} target="_blank" rel="noopener noreferrer">
                        <CreditCard className="h-4 w-4 mr-2" />
                        {getPaymentMethodDisplayName(link.payment_method_type)}
                      </a>
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="pt-3 border-t">
                <p className="text-sm text-muted-foreground">
                  Security deposit authorization links will be generated after initial payment
                </p>
              </div>
            );
          })()}

          {activeSecurityDeposit.status === 'authorized' && (
            <div className="space-y-2 pt-3 border-t">
              <p className="text-sm text-green-600 font-medium">
                ✓ Security deposit has been authorized
              </p>
              <p className="text-xs text-muted-foreground">
                This is a hold on your card, not a charge. The authorization will be released after your rental period unless damages occur.
              </p>
              {activeSecurityDeposit.postfinance_transaction_id && (
                <p className="text-xs text-muted-foreground">
                  Transaction ID: {activeSecurityDeposit.postfinance_transaction_id}
                </p>
              )}
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
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium">
                        {formatCurrency(payment.amount, payment.currency)}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {payment.payment_intent || payment.type}
                      </Badge>
                      {payment.payment_method_type && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          {getPaymentMethodIcon(payment.payment_method_type)}
                          {getPaymentMethodLabel(payment.payment_method_type)}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {new Date(payment.paid_at!).toLocaleDateString()} · {payment.method}
                    </p>
                    {payment.postfinance_transaction_id && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Transaction ID: {payment.postfinance_transaction_id}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {payment.receipt_url && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={payment.receipt_url} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <PDFDownloadLink
                      document={
                        <PaymentReceiptPDF
                          payment={{
                            id: payment.id,
                            amount: payment.amount,
                            currency: payment.currency,
                            paid_at: payment.paid_at!,
                            method: payment.method,
                            type: payment.type,
                            postfinance_transaction_id: payment.postfinance_transaction_id,
                            payment_method_type: payment.payment_method_type,
                          }}
                          booking={{
                            reference_code: booking.reference_code,
                            client_name: booking.client_name,
                            client_email: booking.client_email,
                            car_model: booking.car_model,
                            car_plate: booking.car_plate,
                            amount_total: booking.amount_total,
                            amount_paid: booking.amount_paid,
                            currency: booking.currency,
                          }}
                          appSettings={appSettings}
                        />
                      }
                      fileName={`receipt-${payment.id.substring(0, 8)}.pdf`}
                    >
                      {({ loading }) => (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          disabled={loading}
                          onClick={() => {
                            if (!loading) {
                              toast({
                                title: 'Downloading Receipt',
                                description: 'Your payment receipt is being generated...',
                              });
                            }
                          }}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      )}
                    </PDFDownloadLink>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
