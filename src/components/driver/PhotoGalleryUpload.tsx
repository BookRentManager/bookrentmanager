import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, FileUp, Camera, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

interface PhotoGalleryUploadProps {
  bookingId: string;
  token: string;
  documentType: 'car_condition_delivery_photo' | 'car_condition_collection_photo';
  existingPhotos: any[];
  onUploadSuccess: () => void;
  maxPhotos: number;
}

export function PhotoGalleryUpload({
  bookingId,
  token,
  documentType,
  existingPhotos,
  onUploadSuccess,
  maxPhotos,
}: PhotoGalleryUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (files: FileList) => {
    const filesArray = Array.from(files);
    
    if (existingPhotos.length + filesArray.length > maxPhotos) {
      toast.error(`Maximum ${maxPhotos} photos allowed`);
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB per image
    const oversizedFiles = filesArray.filter(f => f.size > maxSize);
    
    if (oversizedFiles.length > 0) {
      toast.error('Some files are too large. Maximum 10MB per photo');
      return;
    }

    setUploading(true);
    try {
      for (const file of filesArray) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('document_type', documentType);
        formData.append('booking_token', token);

        const { error } = await supabase.functions.invoke('upload-client-document', {
          body: formData,
        });

        if (error) throw error;
      }

      toast.success(`${filesArray.length} photo(s) uploaded successfully`);
      onUploadSuccess();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload photos');
    } finally {
      setUploading(false);
    }
  };

  const handleViewPhoto = async (filePath: string) => {
    setViewingPhoto(filePath);
    try {
      // Generate a signed URL for the private file
      const { data, error } = await supabase.storage
        .from('client-documents')
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (error) throw error;
      
      // Open in new tab
      window.open(data.signedUrl, '_blank');
    } catch (error: any) {
      console.error('View error:', error);
      toast.error('Failed to open photo');
    } finally {
      setViewingPhoto(null);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) handleFileUpload(files);
    // Reset input value to allow re-selecting the same files
    e.target.value = '';
  };

  const isDisabled = uploading || existingPhotos.length >= maxPhotos;

  return (
    <div className="space-y-4">
      <div>
        <Label>
          Upload Photos ({existingPhotos.length}/{maxPhotos})
        </Label>
        
        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
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
          multiple
          onChange={handleInputChange}
          className="hidden"
        />

        {uploading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-3 py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Uploading photos...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 mt-3">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isDisabled}
              className="flex items-center justify-center gap-2 w-full"
            >
              <FileUp className="h-4 w-4" />
              Choose Files
            </Button>
            <Button
              variant="outline"
              onClick={() => cameraInputRef.current?.click()}
              disabled={isDisabled}
              className="flex items-center justify-center gap-2 w-full"
            >
              <Camera className="h-4 w-4" />
              Take Photo
            </Button>
            <Button
              variant="outline"
              onClick={() => galleryInputRef.current?.click()}
              disabled={isDisabled}
              className="flex items-center justify-center gap-2 w-full"
            >
              <ImageIcon className="h-4 w-4" />
              Photo Gallery
            </Button>
          </div>
        )}
        
        {!uploading && (
          <p className="text-xs text-muted-foreground mt-2">
            Supported formats: JPG, PNG (Max 10MB per photo)
          </p>
        )}
      </div>

      {existingPhotos.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-3">Uploaded Photos ({existingPhotos.length})</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {existingPhotos.map((photo) => (
              <button
                key={photo.id}
                onClick={() => handleViewPhoto(photo.file_path)}
                disabled={viewingPhoto === photo.file_path}
                className="group relative block aspect-square overflow-hidden rounded-lg border-2 border-border hover:border-king-gold transition-all disabled:opacity-50"
              >
                {viewingPhoto === photo.file_path ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <>
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                      <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
