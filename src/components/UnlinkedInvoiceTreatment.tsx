import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Download, Upload, Camera, CheckCircle, Loader2, Trash2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RecordSupplierPaymentDialog } from "@/components/RecordSupplierPaymentDialog";
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
import { useUserViewScope } from "@/hooks/useUserViewScope";
import { format } from "date-fns";

interface UnlinkedInvoiceTreatmentProps {
  invoice: {
    id: string;
    amount: number;
    amount_paid: number | null;
    supplier_name: string;
    booking_id: string | null;
    invoice_url: string | null;
    payment_proof_url: string | null;
    payment_status?: string;
    updated_at?: string;
  };
}

const sanitizeExtension = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || 'bin';
  return ext.replace(/[^a-z0-9]/g, '');
};

const isPDF = (url: string) => url.toLowerCase().endsWith('.pdf');

export function UnlinkedInvoiceTreatment({ invoice }: UnlinkedInvoiceTreatmentProps) {
  const [uploading, setUploading] = useState(false);
  const [showProofPreview, setShowProofPreview] = useState(false);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { isReadOnly } = useUserViewScope();

  const deleteInvoice = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase
        .from("supplier_invoices")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", invoiceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-invoices"] });
      toast.success("Invoice cancelled successfully");
    },
    onError: () => {
      toast.error("Failed to cancel invoice");
    },
  });

  const uploadProofMutation = useMutation({
    mutationFn: async (file: File) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Validate file
      const formData = new FormData();
      formData.append('file', file);
      const { data: validationData, error: validationError } = await supabase.functions.invoke(
        'validate-upload',
        { body: formData }
      );
      if (validationError || !validationData?.success) {
        throw new Error(validationData?.error || 'File validation failed');
      }

      // Upload to storage
      const sanitizedExt = sanitizeExtension(file.name);
      const fileName = `${user.id}/${invoice.id}/proof_${Date.now()}.${sanitizedExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Update invoice with proof URL and mark as paid
      const { error: updateError } = await supabase
        .from("supplier_invoices")
        .update({ 
          payment_proof_url: fileName,
          payment_status: "paid",
          amount_paid: invoice.amount
        })
        .eq("id", invoice.id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-invoices"] });
      toast.success("Payment proof uploaded and invoice marked as paid");
    },
    onError: (error) => {
      console.error('Upload error:', error);
      toast.error("Failed to upload payment proof");
    },
    onSettled: () => {
      setUploading(false);
    }
  });

  const deletePaymentProof = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("supplier_invoices")
        .update({ payment_proof_url: null })
        .eq("id", invoice.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Payment proof removed");
      setShowProofPreview(false);
      setProofPreviewUrl("");
    },
    onError: (error) => {
      console.error('Delete proof error:', error);
      toast.error("Failed to remove payment proof");
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploading(true);
      uploadProofMutation.mutate(file);
    }
    e.target.value = '';
  };

  const handlePreview = async (url: string, bucket: string = 'invoices') => {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(url, 3600);
      
      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (error) {
      console.error('Preview error:', error);
      toast.error("Failed to preview document");
    }
  };

  const handleProofPreview = async () => {
    if (!invoice.payment_proof_url) return;
    
    try {
      if (isPDF(invoice.payment_proof_url)) {
        // PDF: Open in new tab
        const { data, error } = await supabase.storage
          .from('invoices')
          .createSignedUrl(invoice.payment_proof_url, 3600);
        if (error) throw error;
        window.open(data.signedUrl, '_blank');
      } else {
        // Image: Toggle inline preview
        if (showProofPreview) {
          setShowProofPreview(false);
          setProofPreviewUrl("");
        } else {
          const { data, error } = await supabase.storage
            .from('invoices')
            .createSignedUrl(invoice.payment_proof_url, 3600);
          if (error) throw error;
          setProofPreviewUrl(data.signedUrl);
          setShowProofPreview(true);
        }
      }
    } catch (error) {
      console.error('Preview error:', error);
      toast.error("Failed to preview payment proof");
    }
  };

  const handleDownload = async (url: string, bucket: string = 'invoices') => {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(url);
      
      if (error) throw error;
      
      const fileName = url.split('/').pop() || 'document';
      const blobUrl = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download error:', error);
      toast.error("Failed to download document");
    }
  };

  return (
    <div className="flex flex-col gap-3 pt-2 border-t">
      {/* Invoice Document Section */}
      {invoice.invoice_url && (
        <div className="flex items-center justify-between bg-muted/30 rounded-md p-2 sm:p-3">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm truncate">
              {invoice.invoice_url.split('/').pop() || 'Invoice Document'}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handlePreview(invoice.invoice_url!)}
              className="h-7 w-7 sm:h-8 sm:w-8"
              title="Preview"
            >
              <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDownload(invoice.invoice_url!)}
              className="h-7 w-7 sm:h-8 sm:w-8"
              title="Download"
            >
              <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
            {!isReadOnly && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 sm:h-8 sm:w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    title="Cancel invoice"
                  >
                    <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel this invoice?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove the invoice from the list. You can restore it from the Trash if needed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Invoice</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteInvoice.mutate(invoice.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Cancel Invoice
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      )}

      {/* Payment Proof Section */}
      {invoice.payment_proof_url ? (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-3 bg-success/10 border border-success/20 rounded-lg gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
              <span className="text-sm font-medium text-success">Proof Uploaded</span>
              {invoice.updated_at && invoice.payment_status === 'paid' && (
                <span className="text-xs text-muted-foreground">
                  Paid at: {format(new Date(invoice.updated_at), 'dd MMM yyyy')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleProofPreview}
                className="h-7 w-7 sm:h-8 sm:w-8"
                title={isPDF(invoice.payment_proof_url) ? "Open PDF" : (showProofPreview ? "Hide preview" : "Show preview")}
              >
                {showProofPreview && !isPDF(invoice.payment_proof_url) ? (
                  <EyeOff className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                ) : (
                  <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDownload(invoice.payment_proof_url!)}
                className="h-7 w-7 sm:h-8 sm:w-8"
                title="Download"
              >
                <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
              {!isReadOnly && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 sm:h-8 sm:w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Remove payment proof"
                    >
                      <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove payment proof?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will delete the payment proof file. You can upload a new one afterwards.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deletePaymentProof.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Remove Proof
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
          {/* Inline image preview for payment proof */}
          {showProofPreview && proofPreviewUrl && !isPDF(invoice.payment_proof_url || '') && (
            <div className="border rounded-lg overflow-hidden bg-background">
              <img
                src={proofPreviewUrl}
                alt="Payment proof preview"
                className="w-full h-auto max-h-[500px] object-contain"
              />
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center justify-between bg-muted/30 rounded-md p-2 sm:p-3">
          <span className="text-sm text-muted-foreground">Payment Proof</span>
          {!isReadOnly ? (
            <div className="flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
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
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="h-8"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Upload</span>
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => cameraInputRef.current?.click()}
                disabled={uploading}
                className="h-8"
              >
                <Camera className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">No proof</span>
          )}
        </div>
      )}

      {/* Record Payment Button - hidden for read-only users */}
      {!isReadOnly && (
        <div className="flex items-center gap-2 pt-1">
          <RecordSupplierPaymentDialog
            invoice={{
              id: invoice.id,
              amount: invoice.amount,
              amount_paid: invoice.amount_paid || 0,
              supplier_name: invoice.supplier_name,
              booking_id: invoice.booking_id,
            }}
          />
        </div>
      )}
    </div>
  );
}
