import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Camera, CheckCircle, Eye, EyeOff, Download, FileText, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useUserViewScope } from "@/hooks/useUserViewScope";
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

interface FinePaymentProofProps {
  fineId: string;
  bookingId?: string;
  currentProofUrl?: string;
  paidAt?: string;
}

export function FinePaymentProof({ fineId, bookingId, currentProofUrl, paidAt }: FinePaymentProofProps) {
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isPDF, setIsPDF] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { isReadOnly } = useUserViewScope();

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

      // Server-side validation
      const formData = new FormData();
      formData.append('file', file);

      const { data: validationData, error: validationError } = await supabase.functions.invoke(
        'validate-upload',
        { body: formData }
      );

      if (validationError || !validationData?.success) {
        throw new Error(validationData?.error || 'File validation failed');
      }

      // Sanitize file extension to prevent injection attacks
      const sanitizeExtension = (filename: string): string => {
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
        return allowedExts.includes(ext) ? ext : 'bin';
      };

      const sanitizedExt = sanitizeExtension(file.name);
      const fileName = `${user.id}/${Date.now()}_proof.${sanitizedExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('fines')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Update fine with payment proof and mark as paid
      const { error: updateError } = await supabase
        .from("fines")
        .update({
          payment_proof_url: fileName,
          payment_status: "paid",
        })
        .eq("id", fineId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      if (bookingId) {
        queryClient.invalidateQueries({ queryKey: ["booking-fines", bookingId] });
      }
      queryClient.invalidateQueries({ queryKey: ["fines"] });
      toast.success("Payment proof uploaded - Fine marked as paid");
    },
    onError: (error) => {
      console.error('Upload error:', error);
      toast.error("Failed to upload payment proof");
    },
    onSettled: () => {
      setUploading(false);
    },
  });

  const deleteProofMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("fines")
        .update({ payment_proof_url: null })
        .eq("id", fineId);

      if (error) throw error;
    },
    onSuccess: () => {
      if (bookingId) {
        queryClient.invalidateQueries({ queryKey: ["booking-fines", bookingId] });
      }
      queryClient.invalidateQueries({ queryKey: ["fines"] });
      toast.success("Payment proof removed");
      setShowPreview(false);
      setPreviewUrl("");
    },
    onError: (error) => {
      console.error('Delete proof error:', error);
      toast.error("Failed to remove payment proof");
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
            .from("fines")
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
        .from("fines")
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
      <div className="space-y-2">
        <div className="flex items-center justify-between p-2 sm:p-3 bg-success/10 border border-success/20 rounded-lg">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 min-w-0">
              <span className="text-xs sm:text-sm font-medium text-success">Proof Uploaded</span>
              {paidAt && (
                <span className="text-xs text-muted-foreground">
                  Paid at: {format(new Date(paidAt), 'dd MMM yyyy')}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-0.5 flex-shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 sm:h-8 sm:w-8"
              onClick={togglePreview}
              title={isPDF ? "Download PDF" : (showPreview ? "Hide preview" : "Show preview")}
            >
              {isPDF ? <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : (showPreview ? <EyeOff className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />)}
            </Button>
            {!isPDF && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 sm:h-8 sm:w-8"
                onClick={downloadFile}
                title="Download payment proof"
              >
                <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
            )}
            {!isReadOnly && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
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
                      onClick={() => deleteProofMutation.mutate()}
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

  // Hide upload section for read-only users
  if (isReadOnly) {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs sm:text-sm text-muted-foreground">Payment Proof</Label>
        <p className="text-xs text-muted-foreground">No proof uploaded</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs sm:text-sm">Payment Proof</Label>
      <div className="flex flex-wrap gap-2">
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
          className="h-8 px-2 sm:px-3"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">
            {uploading ? "Uploading..." : "Upload"}
          </span>
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
          className="h-8 px-2 sm:px-3"
          onClick={() => cameraInputRef.current?.click()}
          disabled={uploading}
        >
          <Camera className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Photo</span>
        </Button>
      </div>
    </div>
  );
}
