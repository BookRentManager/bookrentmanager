import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Eye, 
  Trash2, 
  FileUp, 
  Camera, 
  Image as ImageIcon,
  CheckCircle 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useUserViewScope } from '@/hooks/useUserViewScope';

interface ContractCardProps {
  bookingId: string;
  title: string;
  documentType: 'rental_contract_delivery' | 'rental_contract_collection';
  existingContract?: any;
  onUploadSuccess: () => void;
}

export function ContractCard({
  bookingId,
  title,
  documentType,
  existingContract,
  onUploadSuccess,
}: ContractCardProps) {
  const { isReadOnly } = useUserViewScope();
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    const maxSize = 50 * 1024 * 1024; // 50MB max
    
    if (file.size > maxSize) {
      toast.error('File too large. Maximum 50MB');
      return;
    }

    setUploading(true);
    try {
      // Get the access token for this booking
      const { data: tokenData } = await supabase
        .from('booking_access_tokens')
        .select('token')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!tokenData?.token) {
        throw new Error('No access token found for this booking');
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('document_type', documentType);
      formData.append('booking_token', tokenData.token);

      const { error } = await supabase.functions.invoke('upload-client-document', {
        body: formData,
      });

      if (error) throw error;

      toast.success('Contract uploaded successfully');
      onUploadSuccess();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload contract');
    } finally {
      setUploading(false);
    }
  };

  const handleView = async () => {
    if (!existingContract?.file_path) return;
    
    setViewing(true);
    try {
      // Generate a signed URL for the private file
      const { data, error } = await supabase.storage
        .from('client-documents')
        .createSignedUrl(existingContract.file_path, 3600); // 1 hour expiry

      if (error) throw error;
      
      // Open in new tab
      window.open(data.signedUrl, '_blank');
    } catch (error: any) {
      console.error('View error:', error);
      toast.error('Failed to open document');
    } finally {
      setViewing(false);
    }
  };

  const handleDelete = async () => {
    if (!existingContract?.id) return;
    
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke('delete-client-document', {
        body: {
          document_id: existingContract.id,
          booking_id: bookingId,
          admin_delete: true, // Flag for admin deletion
        },
      });

      if (error) throw error;

      toast.success('Contract removed successfully');
      setShowDeleteDialog(false);
      onUploadSuccess();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(error.message || 'Failed to remove contract');
    } finally {
      setDeleting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    // Reset input value to allow re-selecting the same file
    e.target.value = '';
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {existingContract ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success" />
                <Badge variant="default" className="bg-success">Uploaded</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {format(new Date(existingContract.created_at), 'PPp')}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleView}
                  disabled={viewing}
                >
                  {viewing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Eye className="h-4 w-4 mr-2" />
                  )}
                  View
                </Button>
                {!isReadOnly && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
          ) : isReadOnly ? (
            <div className="py-4 text-center">
              <p className="text-sm text-muted-foreground">No contract uploaded</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Upload Contract (PDF or Photo)
              </p>
              
              {/* Hidden file inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleInputChange}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleInputChange}
                className="hidden"
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                onChange={handleInputChange}
                className="hidden"
              />

              {uploading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Uploading contract...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2"
                  >
                    <FileUp className="h-4 w-4" />
                    Choose File
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex items-center gap-2"
                  >
                    <Camera className="h-4 w-4" />
                    Take Photo
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => galleryInputRef.current?.click()}
                    className="flex items-center gap-2"
                  >
                    <ImageIcon className="h-4 w-4" />
                    Photo Gallery
                  </Button>
                </div>
              )}
              
              <p className="text-xs text-muted-foreground">
                Supported: PDF, JPG, PNG (Max 50MB)
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Contract?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the uploaded contract. You can upload a new one afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
