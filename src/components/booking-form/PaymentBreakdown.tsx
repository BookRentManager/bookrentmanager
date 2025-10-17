import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PaymentBreakdownProps {
  bookingId: string;
  paymentIntent: 'client_payment' | 'balance_payment' | 'deposit';
  selectedPaymentMethod: string | null;
  amountOverride?: number;
  currency?: string;
}

interface CalculationResult {
  original_amount: number;
  fee_percentage: number;
  fee_amount: number;
  total_amount: number;
  currency: string;
  converted_amount: number | null;
  conversion_rate: number | null;
  final_currency: string;
  payment_method_display_name: string;
}

export const PaymentBreakdown = ({
  bookingId,
  paymentIntent,
  selectedPaymentMethod,
  amountOverride,
  currency = 'EUR',
}: PaymentBreakdownProps) => {
  const [loading, setLoading] = useState(false);
  const [calculation, setCalculation] = useState<CalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedPaymentMethod) {
      setCalculation(null);
      return;
    }

    const calculateAmount = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: calcError } = await supabase.functions.invoke('calculate-payment-amount', {
          body: {
            booking_id: bookingId,
            payment_intent: paymentIntent,
            payment_method_type: selectedPaymentMethod,
            amount_override: amountOverride,
          },
        });

        if (calcError) throw calcError;
        if (data.error) throw new Error(data.error);

        setCalculation(data);
      } catch (err: any) {
        console.error('Calculation error:', err);
        setError(err.message || 'Failed to calculate payment amount');
      } finally {
        setLoading(false);
      }
    };

    calculateAmount();
  }, [bookingId, paymentIntent, selectedPaymentMethod, amountOverride]);

  if (!selectedPaymentMethod) {
    return (
      <Card className="p-4 bg-muted/30">
        <p className="text-sm text-muted-foreground text-center">
          Select a payment method to see the breakdown
        </p>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Calculating...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!calculation) {
    return null;
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">Payment Breakdown</h4>
        <Badge variant="outline">{calculation.payment_method_display_name}</Badge>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Rental Amount:</span>
          <span className="font-medium">
            {calculation.currency} {calculation.original_amount.toFixed(2)}
          </span>
        </div>

        {calculation.fee_percentage > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Processing Fee ({calculation.fee_percentage}%):
            </span>
            <span className="font-medium">
              {calculation.currency} {calculation.fee_amount.toFixed(2)}
            </span>
          </div>
        )}

        <div className="border-t pt-2">
          <div className="flex justify-between font-semibold">
            <span>Total Amount:</span>
            <span>
              {calculation.currency} {calculation.total_amount.toFixed(2)}
            </span>
          </div>
        </div>

        {calculation.converted_amount && calculation.conversion_rate && (
          <>
            <div className="border-t pt-2 space-y-1">
              <p className="text-xs text-muted-foreground">Currency Conversion</p>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Exchange Rate:</span>
                <span>1 {calculation.currency} = {calculation.conversion_rate.toFixed(4)} {calculation.final_currency}</span>
              </div>
              <div className="flex justify-between font-semibold text-base">
                <span>Amount to Pay:</span>
                <span className="text-primary">
                  {calculation.final_currency} {calculation.converted_amount.toFixed(2)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {calculation.fee_percentage > 0 && (
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            <AlertCircle className="h-3 w-3 inline mr-1" />
            Processing fee applies to this payment method
          </p>
        </div>
      )}

      {calculation.converted_amount && (
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            <AlertCircle className="h-3 w-3 inline mr-1" />
            Amount will be charged in {calculation.final_currency}
          </p>
        </div>
      )}
    </Card>
  );
};