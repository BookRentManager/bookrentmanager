import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, CreditCard } from "lucide-react";

interface RecordSupplierPaymentDialogProps {
  invoice: {
    id: string;
    amount: number;
    amount_paid?: number | null;
    supplier_name: string;
    booking_id?: string | null;
  };
}

export function RecordSupplierPaymentDialog({ invoice }: RecordSupplierPaymentDialogProps) {
  const [open, setOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const queryClient = useQueryClient();

  const remaining = Number(invoice.amount) - Number(invoice.amount_paid || 0);

  const recordPaymentMutation = useMutation({
    mutationFn: async (amount: number) => {
      const newAmountPaid = Number(invoice.amount_paid || 0) + amount;
      const isPaid = newAmountPaid >= Number(invoice.amount);
      
      const { error } = await supabase
        .from("supplier_invoices")
        .update({
          amount_paid: newAmountPaid,
          payment_status: isPaid ? "paid" : "to_pay",
        })
        .eq("id", invoice.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      if (invoice.booking_id) {
        queryClient.invalidateQueries({ queryKey: ["supplier-invoices", invoice.booking_id] });
      }
      toast.success("Payment recorded successfully");
      setOpen(false);
      setPaymentAmount("");
    },
    onError: (error) => {
      console.error("Record payment error:", error);
      toast.error("Failed to record payment");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (amount > remaining) {
      toast.error(`Payment amount cannot exceed remaining balance of €${remaining.toFixed(2)}`);
      return;
    }
    recordPaymentMutation.mutate(amount);
  };

  const handlePayFull = () => {
    setPaymentAmount(remaining.toFixed(2));
  };

  if (remaining <= 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <CreditCard className="h-4 w-4" />
          Record Payment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 bg-muted/50 rounded-lg space-y-1">
            <p className="text-sm font-medium">{invoice.supplier_name}</p>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Total:</span>
              <span>€{Number(invoice.amount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Paid:</span>
              <span>€{Number(invoice.amount_paid || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-medium text-orange-600">
              <span>Remaining:</span>
              <span>€{remaining.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-amount">Payment Amount (EUR)</Label>
            <div className="flex gap-2">
              <Input
                id="payment-amount"
                type="number"
                step="0.01"
                min="0.01"
                max={remaining}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
                required
              />
              <Button 
                type="button" 
                variant="secondary" 
                onClick={handlePayFull}
                className="whitespace-nowrap"
              >
                Pay Full
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={recordPaymentMutation.isPending}>
              {recordPaymentMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Recording...
                </>
              ) : (
                "Record Payment"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
