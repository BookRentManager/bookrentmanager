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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, RotateCcw } from "lucide-react";
import { useUserViewScope } from "@/hooks/useUserViewScope";

interface RecordRefundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  bookingReference: string;
  currency: string;
}

export function RecordRefundDialog({
  open,
  onOpenChange,
  bookingId,
  bookingReference,
  currency,
}: RecordRefundDialogProps) {
  const { isReadOnly } = useUserViewScope();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Read-only users cannot record refunds
  if (isReadOnly) return null;

  const resetForm = () => {
    setAmount("");
    setNotes("");
  };

  const recordRefundMutation = useMutation({
    mutationFn: async () => {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Please enter a valid amount");
      }

      if (!notes.trim()) {
        throw new Error("Please provide details about this refund");
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from("booking_adjustments").insert({
        booking_id: bookingId,
        adjustment_type: "refund",
        amount: parsedAmount,
        notes: notes.trim(),
        created_by: user?.id || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Refund recorded successfully");
      queryClient.invalidateQueries({ queryKey: ["booking-adjustments", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["booking-financials", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["booking", bookingId] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to record refund: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    recordRefundMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <RotateCcw className="h-5 w-5" />
            Record Refund
          </DialogTitle>
          <DialogDescription>
            Record a refund that was issued to the client for this booking. 
            This will be deducted from the net commission.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Booking Reference (read-only) */}
          <div className="space-y-2">
            <Label>Booking Reference</Label>
            <Input value={bookingReference} disabled className="bg-muted" />
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="refund-amount">
              Refund Amount ({currency}) *
            </Label>
            <Input
              id="refund-amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="refund-notes">Reason for Refund *</Label>
            <Textarea
              id="refund-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Client requested early return, partial refund for booking modification, service issue compensation..."
              rows={3}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="destructive"
              disabled={recordRefundMutation.isPending || !amount || !notes.trim()}
            >
              {recordRefundMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Record Refund
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
