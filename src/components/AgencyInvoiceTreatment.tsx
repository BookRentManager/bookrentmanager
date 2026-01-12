import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, Download, Upload, Camera, Trash2, CheckCircle, FileText, CreditCard, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useUserViewScope } from "@/hooks/useUserViewScope";

interface AgencyInvoice {
  id: string;
  amount: number;
  amount_paid: number | null;
  invoice_url: string | null;
  payment_proof_url: string | null;
  payment_status: string;
}

interface AgencyInvoiceTreatmentProps {
  invoice: AgencyInvoice;
  agencyId: string;
}

const sanitizeExtension = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
  return allowedExts.includes(ext) ? ext : 'bin';
};

// Inline payment recording component for agency invoices
function RecordAgencyPaymentButton({ invoice, agencyId }: { invoice: AgencyInvoice; agencyId: string }) {
  const [open, setOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const queryClient = useQueryClient();

  const remaining = Number(invoice.amount) - Number(invoice.amount_paid || 0);

  const recordPaymentMutation = useMutation({
    mutationFn: async (amount: number) => {
      const newAmountPaid = Number(invoice.amount_paid || 0) + amount;
      const isPaid = newAmountPaid >= Number(invoice.amount);
      
      const { error } = await supabase
        .from("agency_invoices")
        .update({
          amount_paid: newAmountPaid,
          payment_status: isPaid ? "paid" : "to_pay",
        })
        .eq("id", invoice.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency-invoices", agencyId] });
      queryClient.invalidateQueries({ queryKey: ["agency-stats"] });
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
            <p className="text-sm font-medium">Agency Commission</p>
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
                onClick={() => setPaymentAmount(remaining.toFixed(2))}
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

export function AgencyInvoiceTreatment({ invoice, agencyId }: AgencyInvoiceTreatmentProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { isReadOnly } = useUserViewScope();

  const deleteInvoiceMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("agency_invoices")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", invoice.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency-invoices", agencyId] });
      queryClient.invalidateQueries({ queryKey: ["agency-stats"] });
      toast.success("Invoice cancelled");
    },
    onError: (error) => {
      console.error("Delete error:", error);
      toast.error("Failed to cancel invoice");
    },
  });

  const uploadProofMutation = useMutation({
    mutationFn: async (file: File) => {
      setUploading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const formData = new FormData();
      formData.append('file', file);

      const { data: validationData, error: validationError } = await supabase.functions.invoke(
        'validate-upload',
        { body: formData }
      );

      if (validationError || !validationData?.success) {
        throw new Error(validationData?.error || 'File validation failed');
      }

      const sanitizedExt = sanitizeExtension(file.name);
      const fileName = `agency-invoices/${user.id}/${Date.now()}_proof.${sanitizedExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from("agency_invoices")
        .update({
          payment_proof_url: fileName,
          payment_status: "paid",
          amount_paid: invoice.amount,
        })
        .eq("id", invoice.id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency-invoices", agencyId] });
      queryClient.invalidateQueries({ queryKey: ["agency-stats"] });
      toast.success("Payment proof uploaded - Invoice marked as paid");
    },
    onError: (error) => {
      console.error('Upload error:', error);
      toast.error("Failed to upload payment proof");
    },
    onSettled: () => {
      setUploading(false);
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadProofMutation.mutateAsync(file);
    }
  };

  const handlePreview = async (url: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("invoices")
        .createSignedUrl(url, 3600);
      
      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (error) {
      console.error('Preview error:', error);
      toast.error("Failed to preview document");
    }
  };

  const handleDownload = async (url: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("invoices")
        .download(url);
      
      if (error) throw error;
      
      const blobUrl = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = 'document';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      
      toast.success("Document downloaded");
    } catch (error) {
      console.error('Download error:', error);
      toast.error("Failed to download document");
    }
  };

  return (
    <div className="space-y-4">
      {/* Invoice Document Section */}
      {invoice.invoice_url && (
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Invoice Document</span>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePreview(invoice.invoice_url!)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDownload(invoice.invoice_url!)}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Payment Proof Section */}
      {invoice.payment_proof_url ? (
        <div className="flex items-center justify-between p-3 bg-success/10 border border-success/20 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-success" />
            <span className="text-sm font-medium text-success">Payment Proof</span>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePreview(invoice.payment_proof_url!)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDownload(invoice.payment_proof_url!)}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : !isReadOnly ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Upload payment proof (marks as paid)</p>
          <div className="flex gap-2 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? "Uploading..." : "Upload"}
            </Button>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => cameraInputRef.current?.click()}
              disabled={uploading}
            >
              <Camera className="h-4 w-4 mr-2" />
              Camera
            </Button>
          </div>
        </div>
      ) : null}

      {/* Actions */}
      {!isReadOnly && (
        <div className="flex gap-2 pt-2 border-t">
          {(invoice.amount - (invoice.amount_paid || 0)) > 0 && (
            <RecordAgencyPaymentButton
              invoice={invoice}
              agencyId={agencyId}
            />
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel Invoice?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will mark the invoice as cancelled. This action can be undone from the Trash.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep Invoice</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteInvoiceMutation.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Cancel Invoice
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
