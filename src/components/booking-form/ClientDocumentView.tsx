import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Eye, Trash2, FileText, User, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useState } from 'react';

interface Document {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  document_type: string;
  uploaded_by_type: 'admin' | 'client';
  uploaded_by_client_name?: string;
  created_at: string;
}

interface ClientDocumentViewProps {
  documents: Document[];
  token: string;
  onDocumentDeleted: () => void;
}

export function ClientDocumentView({ documents, token, onDocumentDeleted }: ClientDocumentViewProps) {
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDocumentType = (type: string) => {
    const types: Record<string, string> = {
      id_card: 'ID Card / Passport',
      drivers_license: 'Driver\'s License',
      proof_of_address: 'Proof of Address',
      insurance: 'Insurance',
      other: 'Other',
    };
    return types[type] || type;
  };

  const handleDownload = async (document: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('client-documents')
        .download(document.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.file_name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Download started',
        description: `Downloading ${document.file_name}`,
      });
    } catch (error: any) {
      console.error('Download error:', error);
      toast({
        title: 'Download failed',
        description: error.message || 'Failed to download document',
        variant: 'destructive',
      });
    }
  };

  const handlePreview = async (document: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('client-documents')
        .download(document.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      window.open(url, '_blank');
    } catch (error: any) {
      console.error('Preview error:', error);
      toast({
        title: 'Preview failed',
        description: error.message || 'Failed to preview document',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (documentId: string) => {
    setDeletingId(documentId);
    try {
      const { error } = await supabase.functions.invoke('delete-client-document', {
        body: { token, document_id: documentId },
      });

      if (error) throw error;

      toast({
        title: 'Document deleted',
        description: 'The document has been removed',
      });

      onDocumentDeleted();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({
        title: 'Delete failed',
        description: error.message || 'Failed to delete document',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  if (documents.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No documents uploaded yet</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <Card key={doc.id} className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <FileText className="h-8 w-8 text-primary shrink-0 mt-1" />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h4 className="font-medium truncate">{doc.file_name}</h4>
                  <Badge variant="outline" className="shrink-0">
                    {formatDocumentType(doc.document_type)}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                  <span>{formatFileSize(doc.file_size)}</span>
                  <span>•</span>
                  <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                </div>

                <div className="mt-2">
                  {doc.uploaded_by_type === 'admin' ? (
                    <Badge variant="secondary" className="gap-1">
                      <Shield className="h-3 w-3" />
                      Uploaded by Admin
                    </Badge>
                  ) : (
                    <Badge variant="default" className="gap-1">
                      <User className="h-3 w-3" />
                      Uploaded by You
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2 shrink-0">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handlePreview(doc)}
                title="Preview"
              >
                <Eye className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={() => handleDownload(doc)}
                title="Download"
              >
                <Download className="h-4 w-4" />
              </Button>

              {doc.uploaded_by_type === 'client' && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={deletingId === doc.id}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete document?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{doc.file_name}"? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(doc.id)}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
