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
import { Loader2, Ticket } from "lucide-react";
import { useUserViewScope } from "@/hooks/useUserViewScope";

interface IssueVoucherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  bookingReference: string;
  currency: string;
}

export function IssueVoucherDialog({
  open,
  onOpenChange,
  bookingId,
  bookingReference,
  currency,
}: IssueVoucherDialogProps) {
  const { isReadOnly } = useUserViewScope();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Read-only users cannot issue vouchers
  if (isReadOnly) return null;

  const resetForm = () => {
    setAmount("");
    setNotes("");
  };

  const issueVoucherMutation = useMutation({
    mutationFn: async () => {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Please enter a valid amount");
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from("booking_adjustments").insert({
        booking_id: bookingId,
        adjustment_type: "voucher",
        amount: parsedAmount,
        notes: notes.trim() || null,
        created_by: user?.id || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Voucher credit issued successfully");
      queryClient.invalidateQueries({ queryKey: ["booking-adjustments", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["booking-financials", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["booking", bookingId] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to issue voucher: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    issueVoucherMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-purple-700">
            <Ticket className="h-5 w-5" />
            Issue Voucher Credit
          </DialogTitle>
          <DialogDescription>
            Issue a voucher credit for this client. The voucher amount will be 
            deducted from the net commission for this booking.
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
            <Label htmlFor="voucher-amount">
              Voucher Amount ({currency}) *
            </Label>
            <Input
              id="voucher-amount"
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
            <Label htmlFor="voucher-notes">Notes (optional)</Label>
            <Textarea
              id="voucher-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Compensation for service delay, goodwill gesture, loyalty reward..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="bg-purple-600 hover:bg-purple-700"
              disabled={issueVoucherMutation.isPending || !amount}
            >
              {issueVoucherMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Issuing...
                </>
              ) : (
                <>
                  <Ticket className="h-4 w-4 mr-2" />
                  Issue Voucher
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
