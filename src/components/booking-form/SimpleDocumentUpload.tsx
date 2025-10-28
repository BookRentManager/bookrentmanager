import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Upload, Check, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

interface SimpleDocumentUploadProps {
  label: string;
  documentType: string;
  token: string;
  bookingId: string;
  onUploadComplete: () => void;
  isUploaded: boolean;
}

export function SimpleDocumentUpload({
  label,
  documentType,
  token,
  bookingId,
  onUploadComplete,
  isUploaded,
}: SimpleDocumentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadFile = async (file: File) => {
    if (!file) return;

    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) {
      toast.error("File size must be less than 20MB");
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('token', token);
      formData.append('bookingId', bookingId);
      formData.append('document_type', documentType);

      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const { data, error } = await supabase.functions.invoke('upload-client-document', {
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (error) throw error;

      toast.success(`${label} uploaded successfully`);
      onUploadComplete();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload document');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  if (isUploaded) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-600" />
            <span className="text-sm text-green-700 font-medium">{label}</span>
          </div>
          <span className="text-xs text-green-600">Uploaded</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <Label className="text-sm font-medium">{label}</Label>
        
        {uploading ? (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              Uploading... {progress}%
            </p>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => document.getElementById(`file-${documentType}`)?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Choose File
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => document.getElementById(`camera-${documentType}`)?.click()}
            >
              <Camera className="h-4 w-4 mr-2" />
              Take Photo
            </Button>
          </div>
        )}

        <input
          id={`file-${documentType}`}
          type="file"
          accept="image/*,.pdf"
          onChange={handleFileSelect}
          className="hidden"
        />
        <input
          id={`camera-${documentType}`}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleCameraCapture}
          className="hidden"
        />
      </CardContent>
    </Card>
  );
}
