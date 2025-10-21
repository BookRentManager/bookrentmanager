import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Camera, Loader2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface ContractDocumentUploadProps {
  bookingToken: string;
  bookingId: string;
}

const documentTypes = [
  { value: "rental_contract", label: "Rental Contract (PDF)", accept: ".pdf" },
  { value: "rental_contract", label: "Rental Contract (Photo)", accept: "image/*" },
  { value: "car_condition_photo", label: "Car Condition - Before Delivery (Photo)", accept: "image/*" },
  { value: "car_condition_video", label: "Car Condition - Before Delivery (Video)", accept: "video/*" },
  { value: "car_condition_photo", label: "Car Condition - After Return (Photo)", accept: "image/*" },
  { value: "car_condition_video", label: "Car Condition - After Return (Video)", accept: "video/*" },
];

export function ContractDocumentUpload({ bookingToken, bookingId }: ContractDocumentUploadProps) {
  const [selectedType, setSelectedType] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const queryClient = useQueryClient();

  const handleFileSelect = async (file: File, useCamera: boolean = false) => {
    if (!selectedType) {
      toast.error("Please select a document type first");
      return;
    }

    const isVideo = file.type.startsWith('video/');
    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    
    if (file.size > maxSize) {
      toast.error(`File too large. Maximum ${isVideo ? '50MB' : '10MB'} for ${isVideo ? 'videos' : 'images/PDFs'}`);
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("document_type", selectedType);
      formData.append("booking_token", bookingToken);

      const { data, error } = await supabase.functions.invoke("upload-client-document", {
        body: formData,
      });

      if (error) throw error;

      toast.success(`${isVideo ? 'Video' : 'Document'} uploaded successfully`);
      queryClient.invalidateQueries({ queryKey: ['client-portal-data', bookingId] });
      setFileInputKey(prev => prev + 1);
      setSelectedType("");
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
          const file = new File([blob], `camera-capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
          await handleFileSelect(file, true);
        }
      }, 'image/jpeg', 0.9);
    } catch (error) {
      console.error("Camera error:", error);
      toast.error("Failed to access camera");
    }
  };

  const selectedTypeInfo = documentTypes.find(t => t.value === selectedType);
  const acceptAttribute = selectedTypeInfo?.accept || "image/*,.pdf";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
          <FileText className="h-5 w-5" />
          Upload Rental Contract & Car Condition
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Document Type</label>
          <Select value={selectedType} onValueChange={setSelectedType} disabled={uploading}>
            <SelectTrigger className="h-12 md:h-11 text-base md:text-sm">
              <SelectValue placeholder="Select document type" />
            </SelectTrigger>
            <SelectContent className="max-h-[60vh]">
              {documentTypes.map((type, index) => (
                <SelectItem key={`${type.value}-${index}`} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="border-2 border-dashed rounded-lg p-6 md:p-8 text-center hover:border-primary/50 transition-colors">
            <input
              key={fileInputKey}
              type="file"
              id="contract-file-upload"
              className="hidden"
              accept={acceptAttribute}
              onChange={handleFileInputChange}
              disabled={uploading || !selectedType}
            />
            <label
              htmlFor="contract-file-upload"
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
                    PDF, Images, or Videos
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Max 10MB (50MB for videos)
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
