import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileUpload } from "./FileUpload";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";

interface FineUploadDialogProps {
  fineId: string;
  bookingId: string;
  currentDocumentUrl?: string;
  currentPaymentProofUrl?: string;
  paymentStatus: string;
}

export function FineUploadDialog({ 
  fineId, 
  bookingId,
  currentDocumentUrl, 
  currentPaymentProofUrl,
  paymentStatus 
}: FineUploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [documentUrl, setDocumentUrl] = useState(currentDocumentUrl || "");
  const [paymentProofUrl, setPaymentProofUrl] = useState(currentPaymentProofUrl || "");
  const queryClient = useQueryClient();

  const updateFineMutation = useMutation({
    mutationFn: async () => {
      const updates: any = {
        document_url: documentUrl || null,
      };

      // If payment proof is uploaded, mark as paid
      if (paymentProofUrl) {
        updates.payment_status = "paid";
      }

      const { error } = await supabase
        .from("fines")
        .update(updates)
        .eq("id", fineId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-fines", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["fines"] });
      toast.success("Fine updated successfully");
      setOpen(false);
    },
    onError: (error) => {
      console.error('Update error:', error);
      toast.error("Failed to update fine");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-2" />
          Manage Files
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Fine Documents</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div>
            <h4 className="font-semibold mb-3">Fine Document</h4>
            <FileUpload
              bucket="fines"
              label="Fine Document"
              currentFile={documentUrl}
              onUploadComplete={(url) => setDocumentUrl(url)}
            />
          </div>

          {paymentStatus === "unpaid" && (
            <div>
              <h4 className="font-semibold mb-3">Payment Confirmation</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Upload payment proof to mark this fine as paid
              </p>
              <FileUpload
                bucket="fines"
                label="Payment Proof"
                currentFile={paymentProofUrl}
                onUploadComplete={(url) => setPaymentProofUrl(url)}
              />
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => updateFineMutation.mutate()}>
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
