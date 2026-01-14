import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface NotifyFineDialogProps {
  fineId: string;
  bookingId?: string;
  displayName: string;
  amount?: number;
}

export function NotifyFineDialog({ fineId, bookingId, displayName, amount }: NotifyFineDialogProps) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  const notifyFineMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("fines")
        .update({
          payment_status: "notified",
          notified_at: new Date().toISOString(),
          notification_notes: notes.trim() || null,
        })
        .eq("id", fineId);

      if (error) throw error;
    },
    onSuccess: () => {
      if (bookingId) {
        queryClient.invalidateQueries({ queryKey: ["booking-fines", bookingId] });
      }
      queryClient.invalidateQueries({ queryKey: ["fines"] });
      toast.success("Fine marked as notified to client");
      setOpen(false);
      setNotes("");
    },
    onError: (error) => {
      console.error("Notify fine error:", error);
      toast.error("Failed to update fine status");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="text-amber-600 border-amber-300 hover:bg-amber-50"
        >
          <Send className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Mark as Notified</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Notify Fine to Client</DialogTitle>
          <DialogDescription>
            Mark this fine as notified. The client will receive the fine directly at their billing address from the authorities.
            {amount && (
              <span className="block mt-2 font-medium text-foreground">
                Fine amount: €{Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="notification-notes">Notes (optional)</Label>
            <Textarea
              id="notification-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="E.g., Fine forwarded to client's Zurich address on..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => notifyFineMutation.mutate()}
            disabled={notifyFineMutation.isPending}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {notifyFineMutation.isPending ? "Updating..." : "Confirm Notification"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
