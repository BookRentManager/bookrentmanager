import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowRight } from 'lucide-react';

interface PaymentMethod {
  id: string;
  method_type: string;
  display_name: string;
  description?: string;
  fee_percentage: number;
  currency: string;
  requires_conversion: boolean;
}

interface SelectPaymentMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentMethods: PaymentMethod[];
  amount: number;
  currency: string;
  paymentType: 'balance' | 'security_deposit';
  bookingId: string;
  onSuccess: () => void;
}

export function SelectPaymentMethodDialog({
  open,
  onOpenChange,
  paymentMethods,
  amount,
  currency,
  paymentType,
  bookingId,
  onSuccess,
}: SelectPaymentMethodDialogProps) {
  const { toast } = useToast();
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [manualInstructions, setManualInstructions] = useState('');
  const [loading, setLoading] = useState(false);

  const formatCurrency = (value: number, curr: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: curr,
    }).format(value);
  };

  const calculateTotal = (method: PaymentMethod) => {
    const feeAmount = paymentType === 'security_deposit' ? 0 : (amount * method.fee_percentage) / 100;
    const totalAmount = amount + feeAmount;
    
    if (method.requires_conversion) {
      // Assume 1.03 conversion rate for EUR to CHF (this will be calculated server-side)
      const convertedAmount = totalAmount * 1.03;
      return {
        feeAmount,
        totalAmount,
        convertedAmount,
        displayCurrency: method.currency,
      };
    }
    
    return {
      feeAmount,
      totalAmount,
      convertedAmount: null,
      displayCurrency: currency,
    };
  };

  const handleSubmit = async () => {
    if (!selectedMethod) {
      toast({
        title: 'Selection Required',
        description: 'Please select a payment method',
        variant: 'destructive',
      });
      return;
    }

    const method = paymentMethods.find(m => m.method_type === selectedMethod);
    if (!method) return;

    try {
      setLoading(true);
      
      const payment_intent = paymentType === 'security_deposit' 
        ? 'security_deposit'
        : 'balance_payment';
      
      if (selectedMethod === 'bank_transfer') {
        // Create bank transfer payment
        const { data, error } = await supabase.functions.invoke(
          'create-bank-transfer-payment',
          {
            body: {
              booking_id: bookingId,
              amount,
              payment_type: paymentType === 'security_deposit' ? 'deposit' : 'rental',
              payment_intent,
            }
          }
        );
        
        if (error) throw error;
        
        // Redirect to bank transfer instructions
        window.location.href = data.payment_link_url;
        
      } else if (selectedMethod === 'manual') {
        // Handle manual payment method
        toast({
          title: 'Manual Payment Selected',
          description: 'Admin will be notified of your payment method selection.',
        });
        onSuccess();
        
      } else {
        // Card payment (visa_mastercard or amex)
        if (paymentType === 'security_deposit') {
          // Use authorize-security-deposit function
          const { data, error } = await supabase.functions.invoke(
            'authorize-security-deposit',
            {
              body: {
                booking_id: bookingId,
                amount,
                currency,
                payment_method_type: selectedMethod,
                expires_in_hours: 8760,
              }
            }
          );
          
          if (error) throw error;
          
          // Redirect to payment page
          window.location.href = data.payment_url;
          
        } else {
          // Use create-postfinance-payment-link function for balance payment
          const { data, error } = await supabase.functions.invoke(
            'create-postfinance-payment-link',
            {
              body: {
                booking_id: bookingId,
                amount,
                payment_type: 'rental',
                payment_intent,
                payment_method_type: selectedMethod,
                expires_in_hours: 8760,
              }
            }
          );
          
          if (error) {
            console.error('Payment link creation failed:', error);
            // Show detailed error from edge function
            const errorMessage = error.context?.details || error.message || 'Could not create payment link';
            toast({
              title: 'Payment Link Failed',
              description: errorMessage,
              variant: 'destructive',
            });
            return;
          }
          
          // Redirect to payment page
          if (data?.payment_link) {
            window.location.href = data.payment_link;
          } else {
            throw new Error('No payment link returned from payment processor');
          }
        }
      }
      
      onSuccess();
      
    } catch (error: any) {
      console.error('Payment submission error:', error);
      // Show detailed error message from edge function or generic error
      const errorMessage = error.context?.details || error.message || 'Failed to process payment. Please try again or contact support.';
      
      toast({
        title: 'Payment Submission Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Select Payment Method
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              {paymentType === 'security_deposit' ? 'Authorization Amount' : 'Amount to Pay'}
            </p>
            <p className="text-xl font-semibold">{formatCurrency(amount, currency)}</p>
          </div>

          <div className="space-y-3">
            <Label className="text-base font-semibold">Choose your payment method:</Label>
            
            <RadioGroup value={selectedMethod} onValueChange={setSelectedMethod}>
              {paymentMethods.map((method) => {
                const calculation = calculateTotal(method);
                
                return (
                  <div key={method.id} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <RadioGroupItem value={method.method_type} id={method.method_type} className="mt-1" />
                      <div className="flex-1 space-y-1">
                        <Label htmlFor={method.method_type} className="flex items-center gap-2 cursor-pointer">
                          <span className="font-medium">{method.display_name}</span>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-xs">
                              {calculation.displayCurrency}
                            </Badge>
                            {calculation.feeAmount > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {method.fee_percentage}% fee
                              </Badge>
                            )}
                          </div>
                        </Label>
                        {method.description && (
                          <p className="text-xs text-muted-foreground">{method.description}</p>
                        )}
                        <div className="text-sm font-semibold text-primary mt-2">
                          Total: {formatCurrency(
                            calculation.convertedAmount || calculation.totalAmount, 
                            calculation.displayCurrency
                          )}
                          {calculation.convertedAmount && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({formatCurrency(amount, currency)} @ 1.03 rate)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </RadioGroup>

            {selectedMethod === 'manual' && (
              <div className="space-y-2">
                <Label htmlFor="manual-instructions">Payment Instructions</Label>
                <Textarea
                  id="manual-instructions"
                  value={manualInstructions}
                  onChange={(e) => setManualInstructions(e.target.value)}
                  placeholder="Enter payment instructions (e.g., cash on delivery, crypto wallet address, etc.)"
                  rows={3}
                />
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || !selectedMethod}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Continue to Payment
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
