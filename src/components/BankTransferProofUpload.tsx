import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, FileText, Image as ImageIcon, Loader2, X, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';

interface BankTransferProofUploadProps {
  paymentId: string;
  onUploadSuccess?: () => void;
  currentProofUrl?: string;
}

export function BankTransferProofUpload({ 
  paymentId, 
  onUploadSuccess,
  currentProofUrl 
}: BankTransferProofUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only PDF and image files are allowed');
      return;
    }

    setSelectedFile(file);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      const formData = new FormData();
      formData.append('payment_id', paymentId);
      formData.append('file', selectedFile);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const { data, error } = await supabase.functions.invoke('upload-bank-transfer-proof', {
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (error) throw error;

      toast.success('Payment proof uploaded successfully');
      setSelectedFile(null);
      setPreviewUrl(null);
      
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (error) {
      console.error('Error uploading proof:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload payment proof');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {!selectedFile && !currentProofUrl && (
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-4">
              Upload your bank transfer receipt or confirmation
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              PDF, JPG, PNG or WEBP (max 5MB)
            </p>
            <label htmlFor="proof-upload">
              <Button variant="outline" className="cursor-pointer" asChild>
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  Choose File
                </span>
              </Button>
              <input
                id="proof-upload"
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={handleFileSelect}
              />
            </label>
          </div>
        )}

        {selectedFile && (
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 border rounded-lg">
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" className="w-20 h-20 object-cover rounded" />
              ) : (
                <FileText className="h-20 w-20 text-muted-foreground" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                disabled={uploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {uploading && (
              <div className="space-y-2">
                <Progress value={uploadProgress} />
                <p className="text-sm text-center text-muted-foreground">
                  Uploading... {uploadProgress}%
                </p>
              </div>
            )}

            <Button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Payment Proof
                </>
              )}
            </Button>
          </div>
        )}

        {currentProofUrl && !selectedFile && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
              {currentProofUrl.includes('.pdf') ? (
                <FileText className="h-8 w-8 text-green-600" />
              ) : (
                <ImageIcon className="h-8 w-8 text-green-600" />
              )}
              <div className="flex-1">
                <p className="font-medium text-green-900 dark:text-green-100">
                  Payment proof uploaded
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Your payment confirmation has been received
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(currentProofUrl, '_blank')}
              >
                <Download className="h-4 w-4 mr-2" />
                View
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
