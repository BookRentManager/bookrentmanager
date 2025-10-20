import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface ClientPaymentBreakdownProps {
  originalAmount: number;
  currency: string;
  feePercentage?: number;
  feeAmount?: number;
  totalAmount: number;
  convertedAmount?: number;
  convertedCurrency?: string;
  conversionRate?: number;
  paymentIntent: string;
}

export function ClientPaymentBreakdown({
  originalAmount,
  currency,
  feePercentage,
  feeAmount,
  totalAmount,
  convertedAmount,
  convertedCurrency,
  conversionRate,
  paymentIntent
}: ClientPaymentBreakdownProps) {
  const formatCurrency = (amount: number, curr: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: curr,
    }).format(amount);
  };

  const getPaymentIntentLabel = (intent: string) => {
    const labels: Record<string, string> = {
      client_payment: 'Initial Payment',
      balance_payment: 'Balance Payment',
      security_deposit: 'Security Deposit',
    };
    return labels[intent] || intent;
  };

  return (
    <Card className="p-4">
      <h4 className="font-semibold mb-3">{getPaymentIntentLabel(paymentIntent)}</h4>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Amount</span>
          <span className="font-medium">{formatCurrency(originalAmount, currency)}</span>
        </div>

        {feePercentage && feePercentage > 0 && feeAmount && feeAmount > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Processing Fee ({feePercentage}%)</span>
            <span className="font-medium">{formatCurrency(feeAmount, currency)}</span>
          </div>
        )}

        {convertedAmount && convertedCurrency && conversionRate && (
          <>
            <Separator className="my-2" />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal ({currency})</span>
              <span className="font-medium">{formatCurrency(totalAmount, currency)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                Exchange Rate (1 {currency} = {conversionRate.toFixed(4)} {convertedCurrency})
              </span>
            </div>
          </>
        )}

        <Separator className="my-2" />

        {convertedAmount && convertedCurrency ? (
          <div className="flex justify-between text-base font-semibold">
            <span>Total to Pay</span>
            <span>{formatCurrency(convertedAmount, convertedCurrency)}</span>
          </div>
        ) : (
          <div className="flex justify-between text-base font-semibold">
            <span>Total to Pay</span>
            <span>{formatCurrency(totalAmount, currency)}</span>
          </div>
        )}
      </div>

      {paymentIntent === 'security_deposit' && (
        <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
          This is a pre-authorization only. Your card will not be charged unless damages are incurred.
        </p>
      )}
    </Card>
  );
}
