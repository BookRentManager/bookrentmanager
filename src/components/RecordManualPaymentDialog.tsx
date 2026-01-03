import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface RecordManualPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  bookingReference: string;
  currency: string;
  amountTotal: number;
  amountPaid: number;
}

type PaymentMethodType = "bank_transfer" | "visa_mastercard" | "amex" | "cash" | "crypto";
type PaymentIntent = "down_payment" | "balance_payment" | "full_payment";

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethodType; label: string }[] = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "visa_mastercard", label: "Card (Visa/Mastercard)" },
  { value: "amex", label: "Card (American Express)" },
  { value: "cash", label: "Cash" },
  { value: "crypto", label: "Crypto" },
];

const PAYMENT_INTENT_OPTIONS: { value: PaymentIntent; label: string }[] = [
  { value: "down_payment", label: "Down Payment" },
  { value: "balance_payment", label: "Balance Payment" },
  { value: "full_payment", label: "Full Payment" },
];

// Map payment method type to legacy method field
const mapToLegacyMethod = (methodType: PaymentMethodType): string => {
  switch (methodType) {
    case "bank_transfer":
      return "bank_transfer";
    case "visa_mastercard":
    case "amex":
      return "card";
    case "cash":
    case "crypto":
    default:
      return "other";
  }
};

export function RecordManualPaymentDialog({
  open,
  onOpenChange,
  bookingId,
  bookingReference,
  currency,
  amountTotal,
  amountPaid,
}: RecordManualPaymentDialogProps) {
  const queryClient = useQueryClient();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("bank_transfer");
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntent>("down_payment");
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [amount, setAmount] = useState<string>("");
  const [transactionRef, setTransactionRef] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const remainingBalance = amountTotal - amountPaid;

  const resetForm = () => {
    setPaymentMethod("bank_transfer");
    setPaymentIntent("down_payment");
    setPaymentDate(new Date());
    setAmount("");
    setTransactionRef("");
    setNotes("");
  };

  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Please enter a valid amount");
      }

      // Include the payment date in the note so it can be used when confirming
      const noteWithDate = notes 
        ? `${notes}\n[Payment Date: ${format(paymentDate, "yyyy-MM-dd")}]`
        : `[Payment Date: ${format(paymentDate, "yyyy-MM-dd")}]`;

      const { error } = await supabase.from("payments").insert({
        booking_id: bookingId,
        type: "rental" as const,
        method: mapToLegacyMethod(paymentMethod) as any,
        payment_method_type: paymentMethod,
        amount: parsedAmount,
        currency: currency,
        payment_intent: paymentIntent,
        payment_link_status: "pending" as any,
        payment_link_id: `manual_${Date.now()}`,
        postfinance_transaction_id: transactionRef || null,
        note: noteWithDate,
      } as any);

      if (error) throw error;
      
      return { paymentDate };
    },
    onSuccess: () => {
      toast.success("Manual payment recorded. Please confirm it to mark as paid.");
      queryClient.invalidateQueries({ queryKey: ["booking-payments", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["booking", bookingId] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to record payment: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    recordPaymentMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Record Manual Payment</DialogTitle>
          <DialogDescription>
            Record a payment that was received outside the automated system.
            The payment will be marked as pending until confirmed.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Booking Reference (read-only) */}
          <div className="space-y-2">
            <Label>Booking Reference</Label>
            <Input value={bookingReference} disabled className="bg-muted" />
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Payment Method</Label>
            <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethodType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Payment Intent */}
          <div className="space-y-2">
            <Label htmlFor="paymentIntent">Payment Type</Label>
            <Select value={paymentIntent} onValueChange={(v) => setPaymentIntent(v as PaymentIntent)}>
              <SelectTrigger>
                <SelectValue placeholder="Select payment type" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_INTENT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Payment Date */}
          <div className="space-y-2">
            <Label>Payment Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !paymentDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {paymentDate ? format(paymentDate, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={paymentDate}
                  onSelect={(date) => date && setPaymentDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">
              Amount ({currency})
              {remainingBalance > 0 && (
                <span className="text-muted-foreground ml-2 font-normal">
                  (Remaining: {currency} {remainingBalance.toFixed(2)})
                </span>
              )}
            </Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          {/* Transaction Reference */}
          <div className="space-y-2">
            <Label htmlFor="transactionRef">Transaction Reference (optional)</Label>
            <Input
              id="transactionRef"
              value={transactionRef}
              onChange={(e) => setTransactionRef(e.target.value)}
              placeholder="e.g., PF-123456, bank reference, etc."
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional details about this payment..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={recordPaymentMutation.isPending || !amount}>
              {recordPaymentMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Recording...
                </>
              ) : (
                "Record Payment"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
