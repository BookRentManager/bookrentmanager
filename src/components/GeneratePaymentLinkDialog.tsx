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
  const [expiresInHours, setExpiresInHours] = useState(48);
  const [description, setDescription] = useState("");
  const [sendEmail, setSendEmail] = useState(true);

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
      const { data, error } = await supabase.functions.invoke('create-postfinance-payment-link', {
        body: {
          booking_id: bookingId,
          amount,
          payment_type: paymentType,
          payment_intent: paymentIntent,
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
