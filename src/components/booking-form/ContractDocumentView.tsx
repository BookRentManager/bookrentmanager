import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Eye, Download, Trash2, FileText, Image, Video } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface Document {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  document_type: string;
  uploaded_at: string;
  uploaded_by_type: 'admin' | 'client';
  uploaded_by_client_name?: string;
  mime_type?: string;
}

interface ContractDocumentViewProps {
  documents: Document[];
  bookingToken: string;
  bookingId: string;
}

export function ContractDocumentView({ documents, bookingToken, bookingId }: ContractDocumentViewProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const queryClient = useQueryClient();

  const contractDocs = documents.filter(d => d.document_type === 'rental_contract');
  const beforeDelivery = documents.filter(d => 
    (d.document_type === 'car_condition_photo' || d.document_type === 'car_condition_video') &&
    d.file_name.toLowerCase().includes('before')
  );
  const afterReturn = documents.filter(d => 
    (d.document_type === 'car_condition_photo' || d.document_type === 'car_condition_video') &&
    d.file_name.toLowerCase().includes('after')
  );

  const handlePreview = (doc: Document) => {
    const bucketUrl = `${supabase.storage.from('client-documents').getPublicUrl(doc.file_path).data.publicUrl}`;
    window.open(bucketUrl, '_blank');
  };

  const handleDownload = async (doc: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('client-documents')
        .download(doc.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success("Document downloaded");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download document");
    }
  };

  const handleDelete = async () => {
    if (!documentToDelete) return;

    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("delete-client-document", {
        body: { document_id: documentToDelete, booking_token: bookingToken }
      });

      if (error) throw error;

      toast.success("Document deleted");
      queryClient.invalidateQueries({ queryKey: ['client-portal-data', bookingId] });
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error(error.message || "Failed to delete document");
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileIcon = (mimeType?: string) => {
    if (mimeType?.startsWith('video/')) return <Video className="h-5 w-5 md:h-4 md:w-4" />;
    if (mimeType?.startsWith('image/')) return <Image className="h-5 w-5 md:h-4 md:w-4" />;
    return <FileText className="h-5 w-5 md:h-4 md:w-4" />;
  };

  const DocumentCard = ({ doc }: { doc: Document }) => (
    <Card className="p-3 md:p-4">
      <div className="flex flex-col sm:flex-row items-start gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0 w-full sm:w-auto">
          <div className="mt-1">{getFileIcon(doc.mime_type)}</div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{doc.file_name}</p>
            <div className="flex flex-wrap gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {doc.document_type.replace(/_/g, ' ')}
              </Badge>
              <span className="text-xs text-muted-foreground">{formatFileSize(doc.file_size)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatDate(doc.uploaded_at)}
            </p>
            <Badge variant="secondary" className="text-xs mt-2">
              {doc.uploaded_by_type === 'admin' ? 'Uploaded by Admin' : 'Uploaded by You'}
            </Badge>
          </div>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="default"
            onClick={() => handlePreview(doc)}
            className="flex-1 sm:flex-initial h-12 sm:h-10"
          >
            <Eye className="h-5 w-5 sm:h-4 sm:w-4" />
            <span className="ml-2 hidden sm:inline">Preview</span>
          </Button>
          <Button
            variant="outline"
            size="default"
            onClick={() => handleDownload(doc)}
            className="flex-1 sm:flex-initial h-12 sm:h-10"
          >
            <Download className="h-5 w-5 sm:h-4 sm:w-4" />
            <span className="ml-2 hidden sm:inline">Download</span>
          </Button>
          {doc.uploaded_by_type === 'client' && (
            <Button
              variant="outline"
              size="default"
              onClick={() => {
                setDocumentToDelete(doc.id);
                setDeleteDialogOpen(true);
              }}
              className="h-12 sm:h-10"
            >
              <Trash2 className="h-5 w-5 sm:h-4 sm:w-4 text-destructive" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );

  if (documents.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No contract documents uploaded yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {contractDocs.length > 0 && (
          <div>
            <h3 className="font-semibold mb-3 text-sm md:text-base">Rental Contract</h3>
            <div className="space-y-3">
              {contractDocs.map(doc => <DocumentCard key={doc.id} doc={doc} />)}
            </div>
          </div>
        )}

        {beforeDelivery.length > 0 && (
          <div>
            <h3 className="font-semibold mb-3 text-sm md:text-base">Car Condition - Before Delivery</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {beforeDelivery.map(doc => <DocumentCard key={doc.id} doc={doc} />)}
            </div>
          </div>
        )}

        {afterReturn.length > 0 && (
          <div>
            <h3 className="font-semibold mb-3 text-sm md:text-base">Car Condition - After Return</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {afterReturn.map(doc => <DocumentCard key={doc.id} doc={doc} />)}
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this document? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
