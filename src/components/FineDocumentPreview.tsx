import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, Download, FileText } from "lucide-react";

interface FineDocumentPreviewProps {
  documentUrl: string;
  displayName: string;
  bucket?: string;
}

export function FineDocumentPreview({ documentUrl, displayName, bucket = "fines" }: FineDocumentPreviewProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const togglePreview = async () => {
    if (showPreview) {
      setShowPreview(false);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl("");
      }
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(documentUrl);
      
      if (error) throw error;
      
      const url = URL.createObjectURL(data);
      setPreviewUrl(url);
      setShowPreview(true);
    } catch (error) {
      console.error('Preview error:', error);
      toast.error("Failed to preview document");
    }
  };

  const downloadFile = async () => {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(documentUrl);
      
      if (error) throw error;
      
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = displayName || 'document';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success("Document downloaded");
    } catch (error) {
      console.error('Download error:', error);
      toast.error("Failed to download document");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{displayName}</span>
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
        </div>
      </div>

      {showPreview && previewUrl && (
        <div className="border rounded-lg overflow-hidden bg-background">
          <iframe
            src={previewUrl}
            className="w-full h-[500px]"
            title="Document preview"
          />
        </div>
      )}
    </div>
  );
}
