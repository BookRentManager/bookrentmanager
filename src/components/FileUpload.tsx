import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Camera, FileText, X, Download, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FileUploadProps {
  bucket: "fines" | "invoices";
  onUploadComplete: (url: string, fileName: string) => void;
  currentFile?: string;
  label: string;
}

export function FileUpload({ bucket, onUploadComplete, currentFile, label }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const uploadFile = async (file: File, customName?: string) => {
    try {
      setUploading(true);
      
      const fileExt = file.name.split('.').pop();
      const finalFileName = customName || file.name;
      const filePath = `${Date.now()}_${finalFileName}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Return just the path, not the full URL
      onUploadComplete(filePath, finalFileName);
      toast.success(`${label} uploaded successfully`);
      
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      setFileName("");
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(`Failed to upload ${label.toLowerCase()}`);
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const name = fileName || file.name;
    await uploadFile(file, name);
  };

  const removeFile = async () => {
    if (!currentFile) return;
    
    try {
      // Handle old documents that stored full URLs
      let filePath = currentFile;
      if (currentFile.startsWith('http')) {
        const parts = currentFile.split(`/storage/v1/object/public/${bucket}/`);
        if (parts.length > 1) {
          filePath = parts[1];
        } else {
          toast.error("This document uses an old format. Please re-upload it.");
          return;
        }
      }
      
      const { error } = await supabase.storage
        .from(bucket)
        .remove([filePath]);
      
      if (error) throw error;
      
      onUploadComplete("", "");
      toast.success(`${label} removed`);
    } catch (error: any) {
      console.error('Remove error:', error);
      toast.error("Failed to remove. The file might need to be re-uploaded.");
    }
  };

  const togglePreview = async () => {
    if (showPreview) {
      setShowPreview(false);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl("");
      }
      return;
    }

    if (!currentFile) return;
    
    try {
      // Handle old documents that stored full URLs
      let filePath = currentFile;
      if (currentFile.startsWith('http')) {
        // If it's a full URL, extract the path
        const parts = currentFile.split(`/storage/v1/object/public/${bucket}/`);
        if (parts.length > 1) {
          filePath = parts[1];
        } else {
          toast.error("This document uses an old format. Please re-upload it.");
          return;
        }
      }
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(filePath);
      
      if (error) throw error;
      
      const url = URL.createObjectURL(data);
      setPreviewUrl(url);
      setShowPreview(true);
    } catch (error: any) {
      console.error('Preview error:', error);
      toast.error("Failed to preview. The file might need to be re-uploaded.");
    }
  };

  const downloadFile = async () => {
    if (!currentFile) return;
    
    try {
      // Handle old documents that stored full URLs
      let filePath = currentFile;
      if (currentFile.startsWith('http')) {
        const parts = currentFile.split(`/storage/v1/object/public/${bucket}/`);
        if (parts.length > 1) {
          filePath = parts[1];
        } else {
          toast.error("This document uses an old format. Please re-upload it.");
          return;
        }
      }
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(filePath);
      
      if (error) throw error;
      
      // Extract filename from path (remove timestamp prefix)
      const fileName = filePath.split('_').slice(1).join('_') || 'document';
      
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success(`${label} downloaded`);
    } catch (error: any) {
      console.error('Download error:', error);
      toast.error("Failed to download. The file might need to be re-uploaded.");
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor={`${bucket}-name`}>File Name (optional)</Label>
        <Input
          id={`${bucket}-name`}
          placeholder="Enter custom file name"
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          disabled={uploading}
        />
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={handleFileChange}
            className="hidden"
            id={`${bucket}-file`}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? "Uploading..." : "Upload File"}
          </Button>
        </div>

        <div className="flex-1">
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
            id={`${bucket}-camera`}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
          >
            <Camera className="h-4 w-4 mr-2" />
            Capture Photo
          </Button>
        </div>
      </div>

      {currentFile && (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium truncate max-w-[200px]">
                {currentFile.split('_').slice(1).join('_') || 'Document'}
              </span>
            </div>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={togglePreview}
                title={showPreview ? "Hide preview" : "Show preview"}
              >
                {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={downloadFile}
                title="Download file"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={removeFile}
                title="Remove file"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {showPreview && previewUrl && (
            <div className="border rounded-lg overflow-hidden bg-background">
              <iframe
                src={previewUrl}
                className="w-full h-[600px]"
                title="Document preview"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
