import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Camera, File, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';

interface ClientDocumentUploadProps {
  token: string;
  bookingId: string;
  clientName: string;
  onUploadComplete: () => void;
  documentRequirements?: any;
  uploadedDocuments?: any[];
}

const DOCUMENT_TYPES: Array<{ value: string; label: string; required?: boolean }> = [
  { value: 'id_card', label: 'ID Card / Passport' },
  { value: 'drivers_license', label: 'Driver\'s License' },
  { value: 'proof_of_address', label: 'Proof of Address' },
  { value: 'insurance', label: 'Insurance Document' },
  { value: 'other', label: 'Other Document' },
];

export function ClientDocumentUpload({ token, bookingId, clientName, onUploadComplete, documentRequirements, uploadedDocuments = [] }: ClientDocumentUploadProps) {
  // Generate dynamic document types based on requirements
  const getAvailableDocumentTypes = () => {
    if (!documentRequirements) return DOCUMENT_TYPES;
    
    const types: Array<{ value: string; label: string; required?: boolean }> = [];
    
    // ID Card/Passport
    if (documentRequirements.id_passport?.enabled) {
      if (documentRequirements.id_passport?.front_back) {
        types.push({ value: 'id_card_front', label: 'ID Card / Passport (Front)', required: true });
        types.push({ value: 'id_card_back', label: 'ID Card / Passport (Back)', required: true });
      } else {
        types.push({ value: 'id_card', label: 'ID Card / Passport', required: true });
      }
    }
    
    // Driver's License
    if (documentRequirements.drivers_license?.enabled) {
      if (documentRequirements.drivers_license?.front_back) {
        types.push({ value: 'drivers_license_front', label: 'Driver\'s License (Front)', required: true });
        types.push({ value: 'drivers_license_back', label: 'Driver\'s License (Back)', required: true });
      } else {
        types.push({ value: 'drivers_license', label: 'Driver\'s License', required: true });
      }
    }
    
    // Selfie with ID
    if (documentRequirements.selfie_with_id?.enabled) {
      types.push({ value: 'selfie_with_id', label: 'Selfie with ID', required: true });
    }
    
    // Proof of Address
    if (documentRequirements.proof_of_address?.enabled) {
      types.push({ value: 'proof_of_address', label: 'Proof of Address', required: true });
    }
    
    return types.length > 0 ? types : DOCUMENT_TYPES;
  };

  // Filter out already uploaded document types
  const uploadedTypes = uploadedDocuments.map(d => d.document_type);
  const availableDocTypes = getAvailableDocumentTypes().filter(
    type => !uploadedTypes.includes(type.value)
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Please select a file smaller than 10MB',
          variant: 'destructive',
        });
        e.target.value = '';
        return;
      }
      
      if (!documentType) {
        toast({
          title: 'Select document type first',
          description: 'Please select what type of document this is before uploading',
          variant: 'destructive',
        });
        e.target.value = '';
        return;
      }
      
      setSelectedFile(file);
      uploadFile(file);
    }
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!documentType) {
        toast({
          title: 'Select document type first',
          description: 'Please select what type of document this is before uploading',
          variant: 'destructive',
        });
        e.target.value = '';
        return;
      }
      
      setSelectedFile(file);
      uploadFile(file);
    }
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('token', token);
      formData.append('file', file);
      formData.append('document_type', documentType);
      formData.append('client_name', clientName);

      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const { error } = await supabase.functions.invoke('upload-client-document', {
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (error) throw error;

      toast({
        title: '✓ Document uploaded',
        description: `${file.name} has been uploaded successfully`,
      });

      setTimeout(() => {
        setSelectedFile(null);
        setDocumentType(''); // Reset dropdown
        setUploadProgress(0);
      }, 2000);
      
      onUploadComplete();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload document',
        variant: 'destructive',
      });
      setSelectedFile(null);
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Upload Documents</h3>
      
      <div className="space-y-4">
        <div>
          <Label htmlFor="document-type">
            Document Type {documentRequirements?.upload_timing === 'mandatory' && <span className="text-destructive">*</span>}
          </Label>
          <Select value={documentType} onValueChange={setDocumentType} disabled={uploading || availableDocTypes.length === 0}>
            <SelectTrigger id="document-type">
              <SelectValue placeholder={availableDocTypes.length === 0 ? "All documents uploaded" : "Select document type first"} />
            </SelectTrigger>
            <SelectContent>
              {availableDocTypes.map(type => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                  {type.required && documentRequirements?.upload_timing === 'mandatory' && ' *'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!documentType && (
            <p className="text-sm text-muted-foreground mt-1">
              ⚠️ Please select a document type before choosing a file
            </p>
          )}
        </div>

        {selectedFile ? (
          <div className={`border rounded-lg p-4 transition-all ${
            uploadProgress === 100 
              ? 'bg-green-50 border-green-500 border-2' 
              : 'bg-muted/50'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <File className={`h-8 w-8 ${uploadProgress === 100 ? 'text-green-600' : 'text-primary'}`} />
                <div>
                  <p className={`font-medium ${uploadProgress === 100 ? 'text-green-600' : ''}`}>
                    {selectedFile.name}
                    {uploadProgress === 100 && ' ✓'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              </div>
              {!uploading && uploadProgress !== 100 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            {uploading && (
              <div className="mt-4">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-sm font-medium text-primary mt-2">
                  {uploadProgress === 100 ? '✓ Upload complete!' : `Uploading... ${uploadProgress}%`}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <input
                type="file"
                id="file-upload"
                className="hidden"
                onChange={handleFileSelect}
                accept="image/*,.pdf,.doc,.docx"
                disabled={!documentType}
              />
              <Label htmlFor="file-upload" className={documentType ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}>
                <div className={`border-2 border-dashed rounded-lg p-6 md:p-8 transition-colors text-center ${
                  documentType ? 'hover:border-primary' : ''
                }`}>
                  <Upload className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm md:text-base font-medium">Choose File</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, images, or documents
                  </p>
                </div>
              </Label>
            </div>

            <div>
              <input
                type="file"
                id="camera-capture"
                className="hidden"
                onChange={handleCameraCapture}
                accept="image/*"
                capture="environment"
                disabled={!documentType}
              />
              <Label htmlFor="camera-capture" className={documentType ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}>
                <div className={`border-2 border-dashed rounded-lg p-6 md:p-8 transition-colors text-center ${
                  documentType ? 'hover:border-primary' : ''
                }`}>
                  <Camera className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm md:text-base font-medium">Take Photo</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Use your camera
                  </p>
                </div>
              </Label>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground text-center">
            Max file size: 10MB. Accepted formats: PDF, JPG, PNG, DOC, DOCX
          </p>
          <p className="text-xs font-medium text-primary text-center">
            ⚡ Files upload automatically when selected
          </p>
        </div>
      </div>
    </Card>
  );
}
