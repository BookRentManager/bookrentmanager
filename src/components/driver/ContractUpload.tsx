import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Eye, Upload, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ContractUploadProps {
  bookingId: string;
  token: string;
  documentType: 'rental_contract_delivery' | 'rental_contract_collection';
  existingContract?: any;
  onUploadSuccess: () => void;
}

export function ContractUpload({
  bookingId,
  token,
  documentType,
  existingContract,
  onUploadSuccess,
}: ContractUploadProps) {
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (file: File) => {
    const maxSize = 50 * 1024 * 1024; // 50MB max
    
    if (file.size > maxSize) {
      toast.error('File too large. Maximum 50MB');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('document_type', documentType);
      formData.append('booking_token', token);

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

  if (existingContract) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-success" />
          <Badge variant="default" className="bg-success text-white">Uploaded</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Uploaded: {format(new Date(existingContract.created_at), 'PPp')}
        </p>
        <Button variant="outline" size="sm" asChild>
          <a href={existingContract.file_path} target="_blank" rel="noopener noreferrer">
            <Eye className="h-4 w-4 mr-2" />
            View Contract
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Label htmlFor={`contract-${documentType}`}>
        Upload Contract (PDF or Photo)
      </Label>
      <Input
        id={`contract-${documentType}`}
        type="file"
        accept=".pdf,image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
        }}
        disabled={uploading}
        className="cursor-pointer"
      />
      {uploading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Uploading contract...</span>
        </div>
      )}
      {!uploading && (
        <p className="text-xs text-muted-foreground">
          Supported formats: PDF, JPG, PNG (Max 50MB)
        </p>
      )}
    </div>
  );
}
