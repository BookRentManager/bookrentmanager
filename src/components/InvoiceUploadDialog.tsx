import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileUpload } from "./FileUpload";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";

interface InvoiceUploadDialogProps {
  invoiceId: string;
  bookingId: string;
  currentInvoiceUrl?: string;
  currentPaymentProofUrl?: string;
  paymentStatus: string;
}

export function InvoiceUploadDialog({ 
  invoiceId, 
  bookingId,
  currentInvoiceUrl, 
  currentPaymentProofUrl,
  paymentStatus 
}: InvoiceUploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [invoiceUrl, setInvoiceUrl] = useState(currentInvoiceUrl || "");
  const [paymentProofUrl, setPaymentProofUrl] = useState(currentPaymentProofUrl || "");
  const queryClient = useQueryClient();

  const updateInvoiceMutation = useMutation({
    mutationFn: async () => {
      const updates: any = {
        invoice_url: invoiceUrl || null,
      };

      // If payment proof is uploaded, mark as paid
      if (paymentProofUrl) {
        updates.payment_status = "paid";
        updates.payment_proof_url = paymentProofUrl;
      }

      const { error } = await supabase
        .from("supplier_invoices")
        .update(updates)
        .eq("id", invoiceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-invoices", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice updated successfully");
      setOpen(false);
    },
    onError: (error) => {
      console.error('Update error:', error);
      toast.error("Failed to update invoice");
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
          <DialogTitle>Upload Invoice Documents</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div>
            <h4 className="font-semibold mb-3">Invoice Document</h4>
            <FileUpload
              bucket="invoices"
              label="Invoice Document"
              currentFile={invoiceUrl}
              onUploadComplete={(url) => setInvoiceUrl(url)}
            />
          </div>

          {paymentStatus === "to_pay" && (
            <div>
              <h4 className="font-semibold mb-3">Payment Confirmation</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Upload payment proof to mark this invoice as paid
              </p>
              <FileUpload
                bucket="invoices"
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
            <Button onClick={() => updateInvoiceMutation.mutate()}>
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
