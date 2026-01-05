import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
type PaymentIntent = "down_payment" | "balance_payment" | "full_payment" | "extras" | "fines" | "other";

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
  { value: "extras", label: "Extras" },
  { value: "fines", label: "Fines" },
  { value: "other", label: "Other" },
];

// Map payment method type to legacy method field (database enum: card, wire, pos, other)
const mapToLegacyMethod = (methodType: PaymentMethodType): "card" | "wire" | "pos" | "other" => {
  switch (methodType) {
    case "bank_transfer":
      return "wire"; // Bank transfers use the 'wire' enum value
    case "visa_mastercard":
    case "amex":
      return "card";
    case "cash":
      return "pos"; // Point of sale
    case "crypto":
    default:
      return "other";
  }
};

// Map payment intent to database payment_type enum (deposit, balance, full)
const mapIntentToType = (intent: PaymentIntent): "deposit" | "balance" | "full" => {
  switch (intent) {
    case "down_payment":
      return "deposit";
    case "balance_payment":
      return "balance";
    case "full_payment":
    case "extras":
    case "fines":
    case "other":
      return "full"; // Map extras, fines, other to 'full' as they're standalone payments
    default:
      return "deposit";
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
  const [paymentDescription, setPaymentDescription] = useState<string>("");
  const [selectedFineId, setSelectedFineId] = useState<string>("");

  const remainingBalance = amountTotal - amountPaid;

  // Fetch fines for this booking when fines payment type is selected
  const { data: bookingFines } = useQuery({
    queryKey: ["booking-fines-for-payment", bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fines")
        .select("id, fine_number, display_name, amount, payment_status")
        .eq("booking_id", bookingId)
        .is("deleted_at", null)
        .eq("payment_status", "unpaid")
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open && paymentIntent === "fines",
  });

  const resetForm = () => {
    setPaymentMethod("bank_transfer");
    setPaymentIntent("down_payment");
    setPaymentDate(new Date());
    setAmount("");
    setTransactionRef("");
    setNotes("");
    setPaymentDescription("");
    setSelectedFineId("");
  };

  // Check if we need the description field
  const showDescriptionField = ["extras", "fines", "other"].includes(paymentIntent);

  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Please enter a valid amount");
      }

      // Build note with date and description
      let noteContent = notes || "";
      if (paymentDescription) {
        noteContent = paymentDescription + (noteContent ? `\n${noteContent}` : "");
      }
      const noteWithDate = noteContent 
        ? `${noteContent}\n[Payment Date: ${format(paymentDate, "yyyy-MM-dd")}]`
        : `[Payment Date: ${format(paymentDate, "yyyy-MM-dd")}]`;

      const insertData: Record<string, any> = {
        booking_id: bookingId,
        type: mapIntentToType(paymentIntent),
        method: mapToLegacyMethod(paymentMethod),
        payment_method_type: paymentMethod,
        amount: parsedAmount,
        currency: currency,
        payment_intent: paymentIntent,
        payment_link_status: "pending",
        payment_link_id: `manual_${Date.now()}`,
        postfinance_transaction_id: transactionRef || null,
        note: noteWithDate,
      };

      // Add fine_id if fines payment type and a fine is selected
      if (paymentIntent === "fines" && selectedFineId) {
        insertData.fine_id = selectedFineId;
      }

      const { error } = await supabase.from("payments").insert(insertData as any);

      if (error) throw error;
      
      return { paymentDate };
    },
    onSuccess: () => {
      toast.success("Manual payment recorded. Please confirm it to mark as paid.");
      queryClient.invalidateQueries({ queryKey: ["booking-payments", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["booking", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["fines"] });
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
            {showDescriptionField && (
              <p className="text-xs text-muted-foreground mt-1">
                {paymentIntent === "extras" && "e.g., Additional days, extra driver, fuel, etc."}
                {paymentIntent === "fines" && "e.g., Parking fine, traffic violation, toll, etc."}
                {paymentIntent === "other" && "e.g., Damage repair, cleaning fee, etc."}
              </p>
            )}
          </div>

          {/* Fine Selector - Only show for fines payment type */}
          {paymentIntent === "fines" && (
            <div className="space-y-2">
              <Label htmlFor="selectFine">Link to Specific Fine (optional)</Label>
              <Select value={selectedFineId} onValueChange={setSelectedFineId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a fine to link..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No specific fine</SelectItem>
                  {bookingFines?.map((fine) => (
                    <SelectItem key={fine.id} value={fine.id}>
                      {fine.display_name || fine.fine_number || `Fine ${fine.id.slice(0, 8)}`}
                      {fine.amount && ` - ${currency} ${fine.amount}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {bookingFines?.length === 0 && (
                <p className="text-xs text-muted-foreground">No unpaid fines found for this booking</p>
              )}
            </div>
          )}

          {/* Payment Description - Only show for extras, fines, other */}
          {showDescriptionField && (
            <div className="space-y-2">
              <Label htmlFor="paymentDescription">Payment For (optional)</Label>
              <Input
                id="paymentDescription"
                value={paymentDescription}
                onChange={(e) => setPaymentDescription(e.target.value)}
                placeholder={
                  paymentIntent === "extras" ? "e.g., 2 extra rental days, child seat" :
                  paymentIntent === "fines" ? "e.g., Parking violation - Milan center" :
                  "e.g., Late return fee"
                }
              />
            </div>
          )}

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
            <Label htmlFor="notes">Payment Details</Label>
            <p className="text-sm text-muted-foreground">
              Record how this payment was received for future reference.
            </p>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., 'Paid in Crypto 100 USDT', 'Paid €3000 cash at delivery', 'Wire transfer from company account'"
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
