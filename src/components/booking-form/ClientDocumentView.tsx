import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Eye, Trash2, FileText, FileImage, File, User, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useState } from 'react';
import { format } from 'date-fns';
import { hasPermission } from '@/lib/permissions';

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
  permissionLevel?: string;
}

export function ClientDocumentView({ documents, token, onDocumentDeleted, permissionLevel }: ClientDocumentViewProps) {
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
      id_card_front: 'ID Card / Passport (Front)',
      id_card_back: 'ID Card / Passport (Back)',
      drivers_license: 'Driver\'s License',
      drivers_license_front: 'Driver\'s License (Front)',
      drivers_license_back: 'Driver\'s License (Back)',
      driver2_license_front: 'Second Driver\'s License (Front)',
      driver2_license_back: 'Second Driver\'s License (Back)',
      driver3_license_front: 'Third Driver\'s License (Front)',
      driver3_license_back: 'Third Driver\'s License (Back)',
      selfie_with_id: 'Selfie with ID',
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

  const supabaseUrl = supabase.storage.from('client-documents').getPublicUrl('').data.publicUrl.replace(/\/$/, '');

  return (
    <div className="space-y-2 sm:space-y-3">
      {documents.map((doc) => {
        const mime_type = doc.file_name.endsWith('.pdf') ? 'application/pdf' : 
                         doc.file_name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? 'image/' : 'other';
        
        return (
          <Card key={doc.id} className="p-2 sm:p-3">
            <div className="flex items-center justify-between gap-2">
              {/* Icon and file info */}
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                {mime_type.startsWith('image/') ? (
                  <FileImage className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0" />
                ) : mime_type === 'application/pdf' ? (
                  <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-destructive flex-shrink-0" />
                ) : (
                  <File className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground flex-shrink-0" />
                )}
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-xs sm:text-sm truncate">{doc.file_name}</p>
                    <Badge variant="secondary" className="text-[10px] sm:text-xs flex-shrink-0">{formatDocumentType(doc.document_type)}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                    <span>{formatFileSize(doc.file_size)}</span>
                    <span>•</span>
                    <span>{format(new Date(doc.created_at), 'MMM dd, yyyy')}</span>
                    {doc.uploaded_by_client_name && (
                      <>
                        <span>•</span>
                        <span>{doc.uploaded_by_client_name}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-1 sm:gap-2 flex-shrink-0">
                {hasPermission(permissionLevel as any, 'download_docs') ? (
                  <>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handlePreview(doc)}
                      className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3"
                    >
                      <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline sm:ml-2 text-xs">Preview</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDownload(doc)}
                      className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3"
                    >
                      <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline sm:ml-2 text-xs">Download</span>
                    </Button>
                    {doc.uploaded_by_type === 'client' && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={deletingId === doc.id}
                            className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            <span className="hidden sm:inline sm:ml-2 text-xs">Delete</span>
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
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground px-3 py-2 bg-muted rounded-md">
                    <FileText className="h-4 w-4" />
                    <span>Document uploaded</span>
                  </div>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
