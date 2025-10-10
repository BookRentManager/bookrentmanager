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

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const isPDF = documentUrl.toLowerCase().endsWith('.pdf');

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
      
      const blob = new Blob([data], { type: isPDF ? 'application/pdf' : data.type });
      const url = URL.createObjectURL(blob);
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
          {isPDF ? (
            <object
              data={`${previewUrl}#toolbar=0`}
              type="application/pdf"
              className="w-full h-[500px]"
              title="Document preview"
            >
              <div className="flex flex-col items-center justify-center h-[500px] gap-4">
                <FileText className="h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">PDF preview not supported in this browser.</p>
                <Button onClick={downloadFile} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </object>
          ) : (
            <iframe
              src={previewUrl}
              className="w-full h-[500px]"
              title="Document preview"
            />
          )}
        </div>
      )}
    </div>
  );
}
