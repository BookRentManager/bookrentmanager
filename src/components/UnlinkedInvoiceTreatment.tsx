import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Eye, Download, Upload, Camera, CheckCircle, Loader2, Trash2 } from "lucide-react";
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

interface UnlinkedInvoiceTreatmentProps {
  invoice: {
    id: string;
    amount: number;
    amount_paid: number | null;
    supplier_name: string;
    booking_id: string | null;
    invoice_url: string | null;
    payment_proof_url: string | null;
  };
}

const sanitizeExtension = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || 'bin';
  return ext.replace(/[^a-z0-9]/g, '');
};

export function UnlinkedInvoiceTreatment({ invoice }: UnlinkedInvoiceTreatmentProps) {
  const [uploading, setUploading] = useState(false);
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
        <div className="flex items-center justify-between bg-muted/30 rounded-md p-2">
          <span className="text-sm text-muted-foreground">📄 Invoice Document</span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePreview(invoice.invoice_url!)}
              className="h-8"
            >
              <Eye className="h-4 w-4 mr-1" />
              View
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDownload(invoice.invoice_url!)}
              className="h-8"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Payment Proof Section */}
      <div className="flex items-center justify-between bg-muted/30 rounded-md p-2">
        <span className="text-sm text-muted-foreground">📤 Payment Proof</span>
        {invoice.payment_proof_url ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-success flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Uploaded
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePreview(invoice.payment_proof_url!)}
              className="h-8"
            >
              <Eye className="h-4 w-4 mr-1" />
              View
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDownload(invoice.payment_proof_url!)}
              className="h-8"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          !isReadOnly ? (
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
                    Upload
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
          )
        )}
      </div>

      {/* Action Buttons - hidden for read-only users */}
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
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Cancel Invoice
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
        </div>
      )}
    </div>
  );
}
