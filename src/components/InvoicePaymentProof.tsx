import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Camera, CheckCircle, Eye, EyeOff, Download } from "lucide-react";

interface InvoicePaymentProofProps {
  invoiceId: string;
  bookingId: string;
  currentProofUrl?: string;
}

export function InvoicePaymentProof({ invoiceId, bookingId, currentProofUrl }: InvoicePaymentProofProps) {
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isPDF, setIsPDF] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (currentProofUrl) {
      setIsPDF(currentProofUrl.toLowerCase().endsWith('.pdf'));
    }
  }, [currentProofUrl]);

  const uploadProofMutation = useMutation({
    mutationFn: async (file: File) => {
      setUploading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}_proof.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Update invoice with payment proof and mark as paid
      const { error: updateError } = await supabase
        .from("supplier_invoices")
        .update({
          payment_proof_url: fileName,
          payment_status: "paid",
        })
        .eq("id", invoiceId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-invoices", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
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

  const togglePreview = async () => {
    if (!currentProofUrl) return;

    try {
      if (isPDF) {
        await downloadFile();
      } else {
        if (showPreview) {
          setShowPreview(false);
          setPreviewUrl("");
        } else {
          const { data, error } = await supabase.storage
            .from("invoices")
            .createSignedUrl(currentProofUrl, 3600);
          
          if (error) throw error;
          
          setPreviewUrl(data.signedUrl);
          setShowPreview(true);
        }
      }
    } catch (error) {
      console.error('Preview error:', error);
      toast.error("Failed to preview payment proof");
    }
  };

  const downloadFile = async () => {
    if (!currentProofUrl) return;

    try {
      const { data, error } = await supabase.storage
        .from("invoices")
        .download(currentProofUrl);
      
      if (error) throw error;
      
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'payment-proof';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success("Payment proof downloaded");
    } catch (error) {
      console.error('Download error:', error);
      toast.error("Failed to download payment proof");
    }
  };

  if (currentProofUrl) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-success/10 border border-success/20 rounded-lg">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
            <span className="text-sm font-medium text-success truncate">Payment Proof Uploaded</span>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={togglePreview}
              title={isPDF ? "Download PDF" : (showPreview ? "Hide preview" : "Show preview")}
            >
              {isPDF ? <Download className="h-4 w-4" /> : (showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />)}
            </Button>
            {!isPDF && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={downloadFile}
                title="Download payment proof"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {showPreview && previewUrl && !isPDF && (
          <div className="border rounded-lg overflow-hidden bg-background">
            <img
              src={previewUrl}
              alt="Payment proof preview"
              className="w-full h-auto max-h-[500px] object-contain"
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm">Add Payment Proof (marks as paid)</Label>
      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? "Uploading..." : "Upload Proof"}
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
          type="button"
          variant="outline"
          size="sm"
          onClick={() => cameraInputRef.current?.click()}
          disabled={uploading}
        >
          <Camera className="h-4 w-4 mr-2" />
          Take Photo
        </Button>
      </div>
    </div>
  );
}
