import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, Eye } from 'lucide-react';
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

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor={`photos-${documentType}`}>
          Upload Photos ({existingPhotos.length}/{maxPhotos})
        </Label>
        <Input
          id={`photos-${documentType}`}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            const files = e.target.files;
            if (files && files.length > 0) handleFileUpload(files);
          }}
          disabled={uploading || existingPhotos.length >= maxPhotos}
          className="cursor-pointer mt-2"
        />
        {uploading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Uploading photos...</span>
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
              <a
                key={photo.id}
                href={photo.file_path}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative block aspect-square overflow-hidden rounded-lg border-2 border-border hover:border-king-gold transition-all"
              >
                <img
                  src={photo.file_path}
                  alt="Car condition"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                  <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
