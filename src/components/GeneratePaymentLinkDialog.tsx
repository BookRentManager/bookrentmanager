import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface GeneratePaymentLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  amountTotal: number;
  amountPaid: number;
  paymentAmountPercent?: number | null;
  onSuccess: () => void;
}

export function GeneratePaymentLinkDialog({
  open,
  onOpenChange,
  bookingId,
  amountTotal,
  amountPaid,
  paymentAmountPercent,
  onSuccess,
}: GeneratePaymentLinkDialogProps) {
  const [loading, setLoading] = useState(false);
  const [paymentIntent, setPaymentIntent] = useState<string>("down_payment");
  const [amount, setAmount] = useState<number>(0);
  const [paymentType, setPaymentType] = useState<string>("rental");
  const [paymentMethodType, setPaymentMethodType] = useState<string>("visa_mastercard");
  const [expiresInHours, setExpiresInHours] = useState(8760); // 1 year default
  const [description, setDescription] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [manualPaymentInstructions, setManualPaymentInstructions] = useState("");

  const downPaymentAmount = paymentAmountPercent 
    ? (amountTotal * paymentAmountPercent) / 100 
    : 0;
  const remainingAmount = amountTotal - amountPaid;

  // Update amount when payment intent changes
  const handlePaymentIntentChange = (value: string) => {
    setPaymentIntent(value);
    if (value === "down_payment") {
      setAmount(downPaymentAmount);
    } else if (value === "final_payment") {
      setAmount(remainingAmount);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Handle manual payment method separately
      if (paymentMethodType === 'manual') {
        // Create manual payment record directly
        const { data, error } = await supabase
          .from('payments')
          .insert({
            booking_id: bookingId,
            type: paymentType as any,
            method: 'other' as any,
            payment_method_type: 'manual',
            amount,
            currency: 'EUR',
            payment_intent: paymentIntent,
            payment_link_status: 'pending' as any,
            payment_link_id: `manual_${Date.now()}`,
            payment_link_url: '',
          } as any)
          .select()
          .single();

        if (error) throw error;

        // Update booking with manual payment instructions
        if (manualPaymentInstructions) {
          await supabase
            .from('bookings')
            .update({ manual_payment_instructions: manualPaymentInstructions })
            .eq('id', bookingId);
        }

        toast.success("Manual payment request created successfully");
        onSuccess();
        onOpenChange(false);
      } else {
        // Use existing edge function for card/bank transfer payments
        const { data, error } = await supabase.functions.invoke('create-postfinance-payment-link', {
          body: {
            booking_id: bookingId,
            amount,
            payment_type: paymentType,
            payment_intent: paymentIntent,
            payment_method_type: paymentMethodType,
            expires_in_hours: expiresInHours,
            description,
            send_email: sendEmail,
          },
        });

        if (error) throw error;

        toast.success("Payment link generated successfully");
        
        // Copy link to clipboard
        if (data?.payment_link) {
          await navigator.clipboard.writeText(data.payment_link);
          toast.info("Payment link copied to clipboard");
        }

        onSuccess();
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error('Error generating payment link:', error);
      toast.error(error.message || "Failed to generate payment link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Generate Payment Link</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {paymentAmountPercent && downPaymentAmount > 0 && (
            <Alert>
              <Lightbulb className="h-4 w-4" />
              <AlertDescription>
                Suggested: Down Payment (€{downPaymentAmount.toFixed(2)} - {paymentAmountPercent}%)
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="payment_intent">Payment Intent</Label>
            <Select value={paymentIntent} onValueChange={handlePaymentIntentChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="down_payment">
                  Down Payment {paymentAmountPercent && `(${paymentAmountPercent}%)`}
                </SelectItem>
                <SelectItem value="final_payment">Final Payment</SelectItem>
                <SelectItem value="additional_payment">Custom Amount</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (EUR)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_type">Payment Type</Label>
            <Select value={paymentType} onValueChange={setPaymentType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deposit">Security Deposit</SelectItem>
                <SelectItem value="rental">Rental Fee</SelectItem>
                <SelectItem value="additional">Additional Charges</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_method">Payment Method</Label>
            <Select value={paymentMethodType} onValueChange={setPaymentMethodType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="visa_mastercard">Visa/Mastercard (EUR, 2% fee)</SelectItem>
                <SelectItem value="amex">American Express (CHF, 3.5% fee)</SelectItem>
                <SelectItem value="manual">Manual Payment (Cash/Crypto)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {paymentMethodType === 'manual' && (
            <div className="space-y-2">
              <Label htmlFor="manual_instructions">Payment Instructions</Label>
              <Textarea
                id="manual_instructions"
                value={manualPaymentInstructions}
                onChange={(e) => setManualPaymentInstructions(e.target.value)}
                placeholder="E.g., Cash payment on delivery, Bitcoin wallet: bc1q..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                These instructions will be shown to you in the webapp. You'll confirm receipt manually.
              </p>
            </div>
          )}

          {paymentMethodType !== 'manual' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="expires">Link Expiry (hours)</Label>
                <Input
                  id="expires"
                  type="number"
                  value={expiresInHours}
                  onChange={(e) => setExpiresInHours(parseInt(e.target.value))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Down payment for BMW X5 rental"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="send_email"
                  checked={sendEmail}
                  onCheckedChange={(checked) => setSendEmail(checked as boolean)}
                />
                <Label htmlFor="send_email" className="cursor-pointer">
                  Send payment link via email to client
                </Label>
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Generating..." : "Generate Link"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
