import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Camera, Loader2, Receipt, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface ExtrasDocumentUploadProps {
  bookingToken: string;
  bookingId: string;
}

const documentTypes = [
  { value: "extra_km_invoice", label: "Extra Kilometers Invoice" },
  { value: "fuel_balance_invoice", label: "Fuel Balance Invoice" },
  { value: "damage_invoice", label: "Self-Damage Invoice (Below Excess)" },
  { value: "fine_document", label: "Fine/Penalty Document" },
];

export function ExtrasDocumentUpload({ bookingToken, bookingId }: ExtrasDocumentUploadProps) {
  const [selectedType, setSelectedType] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const queryClient = useQueryClient();

  const handleFileSelect = async (file: File, useCamera: boolean = false) => {
    if (!selectedType) {
      toast.error("Please select a document type first");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large. Maximum 10MB");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("document_type", selectedType);
      formData.append("booking_token", bookingToken);
      
      if (amount) {
        formData.append("extra_cost_amount", amount);
      }
      if (notes) {
        formData.append("extra_cost_notes", notes);
      }

      const { data, error } = await supabase.functions.invoke("upload-client-document", {
        body: formData,
      });

      if (error) throw error;

      toast.success("Extra cost document uploaded successfully");
      queryClient.invalidateQueries({ queryKey: ['client-portal-data', bookingId] });
      setFileInputKey(prev => prev + 1);
      setSelectedType("");
      setAmount("");
      setNotes("");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleCameraCapture = async () => {
    if (!selectedType) {
      toast.error("Please select a document type first");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      await new Promise(resolve => setTimeout(resolve, 1000));

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0);

      stream.getTracks().forEach(track => track.stop());

      canvas.toBlob(async (blob) => {
        if (blob) {
          const file = new File([blob], `extras-camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
          await handleFileSelect(file, true);
        }
      }, 'image/jpeg', 0.9);
    } catch (error) {
      console.error("Camera error:", error);
      toast.error("Failed to access camera");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
          <Receipt className="h-5 w-5" />
          Upload Extra Cost Document
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs md:text-sm">
            This section is for post-rental extra costs that may apply to your booking, such as additional 
            kilometers driven, fuel balance adjustments, or minor damages below the insurance excess amount.
          </AlertDescription>
        </Alert>

        <div>
          <label className="text-sm font-medium mb-2 block">Document Type</label>
          <Select value={selectedType} onValueChange={setSelectedType} disabled={uploading}>
            <SelectTrigger className="h-12 md:h-11 text-base md:text-sm">
              <SelectValue placeholder="Select extra cost type" />
            </SelectTrigger>
            <SelectContent className="max-h-[60vh]">
              {documentTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Amount (Optional)</label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={uploading}
              className="h-12 md:h-11 text-base md:text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium mb-2 block">Notes (Optional)</label>
            <Textarea
              placeholder="Description of the extra cost..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={uploading}
              className="min-h-[80px] text-base md:text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="border-2 border-dashed rounded-lg p-6 md:p-8 text-center hover:border-primary/50 transition-colors">
            <input
              key={fileInputKey}
              type="file"
              id="extras-file-upload"
              className="hidden"
              accept="image/*,.pdf"
              onChange={handleFileInputChange}
              disabled={uploading || !selectedType}
            />
            <label
              htmlFor="extras-file-upload"
              className={`cursor-pointer ${!selectedType || uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex flex-col items-center gap-3">
                {uploading ? (
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                ) : (
                  <Upload className="h-10 w-10 text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium text-sm md:text-base">Choose File</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF or Images
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Max 10MB
                  </p>
                </div>
              </div>
            </label>
          </div>

          <Button
            variant="outline"
            onClick={handleCameraCapture}
            disabled={uploading || !selectedType}
            className="h-auto py-8 md:py-10 flex flex-col gap-3"
          >
            <Camera className="h-10 w-10" />
            <div>
              <p className="font-medium text-sm md:text-base">Take Photo</p>
              <p className="text-xs text-muted-foreground">Use camera</p>
            </div>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
