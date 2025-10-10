import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, Download, FileText, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface FineDocumentPreviewProps {
  fineId: string;
  bookingId: string;
  documentUrl: string;
  displayName: string;
  bucket?: string;
}

export function FineDocumentPreview({ fineId, bookingId, documentUrl, displayName, bucket = "fines" }: FineDocumentPreviewProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const queryClient = useQueryClient();


  const togglePreview = async () => {
    if (showPreview) {
      setShowPreview(false);
      setPreviewUrl("");
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(documentUrl, 3600); // 1 hour expiry
      
      if (error) throw error;
      
      setPreviewUrl(data.signedUrl);
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

  const deleteFine = useMutation({
    mutationFn: async () => {
      // Soft delete
      const { error } = await supabase
        .from("fines")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", fineId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-fines", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["fines"] });
      toast.success("Fine removed");
    },
    onError: (error) => {
      console.error('Delete error:', error);
      toast.error("Failed to remove fine");
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm font-medium truncate">{displayName}</span>
        </div>
        <div className="flex gap-1 flex-shrink-0">
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
            onClick={() => deleteFine.mutate()}
            disabled={deleteFine.isPending}
            title="Remove fine"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
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
