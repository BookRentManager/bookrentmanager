import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Camera, CheckCircle } from "lucide-react";

interface FinePaymentProofProps {
  fineId: string;
  bookingId: string;
  currentProofUrl?: string;
}

export function FinePaymentProof({ fineId, bookingId, currentProofUrl }: FinePaymentProofProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const uploadProofMutation = useMutation({
    mutationFn: async (file: File) => {
      setUploading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}_proof.${fileExt}`;
      
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
      queryClient.invalidateQueries({ queryKey: ["booking-fines", bookingId] });
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadProofMutation.mutateAsync(file);
    }
  };

  if (currentProofUrl) {
    return (
      <div className="flex items-center gap-2 text-sm text-success">
        <CheckCircle className="h-4 w-4" />
        <span>Payment proof uploaded</span>
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
