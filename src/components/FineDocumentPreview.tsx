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
  const [isPDF, setIsPDF] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    setIsPDF(documentUrl.toLowerCase().endsWith('.pdf'));
  }, [documentUrl]);


  const togglePreview = async () => {
    try {
      if (isPDF) {
        // Download PDF directly
        await downloadFile();
      } else {
        // Toggle inline preview for images
        if (showPreview) {
          setShowPreview(false);
          setPreviewUrl("");
        } else {
          const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(documentUrl, 3600);
          
          if (error) throw error;
          
          setPreviewUrl(data.signedUrl);
          setShowPreview(true);
        }
      }
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
              title="Download file"
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
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

      {showPreview && previewUrl && !isPDF && (
        <div className="border rounded-lg overflow-hidden bg-background">
          <img
            src={previewUrl}
            alt="Document preview"
            className="w-full h-auto max-h-[500px] object-contain"
          />
        </div>
      )}
    </div>
  );
}
