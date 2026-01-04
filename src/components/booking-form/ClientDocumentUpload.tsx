import { useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Camera, File, X, CheckCircle, Circle, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';

interface ClientDocumentUploadProps {
  token: string;
  bookingId: string;
  clientName: string;
  onUploadComplete: () => void;
  onDocumentUploaded?: (document: any) => void;
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

export function ClientDocumentUpload({ token, bookingId, clientName, onUploadComplete, onDocumentUploaded, documentRequirements, uploadedDocuments = [] }: ClientDocumentUploadProps) {
  // Generate all document types based on requirements (for status display)
  const getAllRequiredDocumentTypes = () => {
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

  // Filter out already uploaded document types for the dropdown
  const uploadedTypes = uploadedDocuments.map(d => d.document_type);
  const allRequiredTypes = getAllRequiredDocumentTypes();
  const availableDocTypes = allRequiredTypes.filter(
    type => !uploadedTypes.includes(type.value)
  );
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  // Refs for file inputs (more reliable on mobile than label htmlFor)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Key for resetting file inputs
  const [inputKey, setInputKey] = useState(0);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Please select a file smaller than 10MB',
          variant: 'destructive',
        });
        setInputKey(prev => prev + 1);
        return;
      }
      
      if (!documentType) {
        toast({
          title: 'Select document type first',
          description: 'Please select what type of document this is before uploading',
          variant: 'destructive',
        });
        setInputKey(prev => prev + 1);
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
        setInputKey(prev => prev + 1);
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

      const { data, error } = await supabase.functions.invoke('upload-client-document', {
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (error) throw error;

      toast({
        title: '✓ Document uploaded',
        description: `${file.name} has been uploaded successfully`,
      });

      // Immediately update parent state with the new document (optimistic update)
      if (data?.document && onDocumentUploaded) {
        onDocumentUploaded(data.document);
      }

      setTimeout(() => {
        setSelectedFile(null);
        setDocumentType('');
        setUploadProgress(0);
        setInputKey(prev => prev + 1);
      }, 1500);
      
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
      setInputKey(prev => prev + 1);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    setDeleting(documentId);
    try {
      const { error } = await supabase.functions.invoke('delete-client-document', {
        body: { token, document_id: documentId, documentId }
      });

      if (error) throw error;

      toast({
        title: 'Document removed',
        description: 'You can now upload a new document of this type',
      });
      
      onUploadComplete();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({
        title: 'Delete failed',
        description: error.message || 'Failed to remove document',
        variant: 'destructive',
      });
    } finally {
      setDeleting(null);
    }
  };

  // Detect iOS to completely omit capture attribute (avoids black screen bug on all iOS browsers)
  // Uses multiple detection methods to catch all iOS browsers including DuckDuckGo, Firefox, Chrome, etc.
  const isIOS = typeof navigator !== 'undefined' && (
    // Standard iOS device detection
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iOS 13+ iPad reports as MacIntel with touch support
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
    // Any mobile WebKit browser that's not Android (catches DuckDuckGo, etc. on iOS)
    (/AppleWebKit/.test(navigator.userAgent) && /Mobile/.test(navigator.userAgent) && !/Android/.test(navigator.userAgent))
  );

  // Handler for clicking file upload area
  const handleFileClick = () => {
    if (!documentType) {
      toast({
        title: 'Select document type first',
        description: 'Please select what type of document this is before uploading',
        variant: 'destructive',
      });
      return;
    }
    if (!uploading) {
      fileInputRef.current?.click();
    }
  };

  // Handler for clicking camera area
  const handleCameraClick = () => {
    if (!documentType) {
      toast({
        title: 'Select document type first',
        description: 'Please select what type of document this is before uploading',
        variant: 'destructive',
      });
      return;
    }
    if (!uploading) {
      cameraInputRef.current?.click();
    }
  };

  // Find document by type
  const getDocumentByType = (docType: string) => {
    return uploadedDocuments.find(d => d.document_type === docType);
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Upload Documents</h3>
      
      <div className="space-y-4">
        {/* Document Status Summary */}
        {allRequiredTypes.length > 0 && documentRequirements && (
          <div className="space-y-2 mb-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-sm font-medium text-muted-foreground mb-2">Document Status:</p>
            {allRequiredTypes.map(type => {
              const isUploaded = uploadedTypes.includes(type.value);
              const doc = getDocumentByType(type.value);
              const isDeleting = doc && deleting === doc.id;
              
              return (
                <div key={type.value} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-2">
                    {isUploaded ? (
                      <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className={`text-sm ${isUploaded ? 'text-green-700 font-medium' : 'text-muted-foreground'}`}>
                      {type.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isUploaded ? (
                      <>
                        <span className="text-xs text-green-600 font-medium">Uploaded</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => doc && handleDeleteDocument(doc.id)}
                          disabled={isDeleting}
                        >
                          {isDeleting ? (
                            <span className="text-xs">...</span>
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </>
                    ) : (
                      documentRequirements?.upload_timing === 'mandatory' && (
                        <span className="text-xs text-amber-600 font-medium">Required</span>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Upload form - only show if there are documents left to upload */}
        {availableDocTypes.length > 0 ? (
          <>
            <div>
              <Label htmlFor="document-type">
                Document Type {documentRequirements?.upload_timing === 'mandatory' && <span className="text-destructive">*</span>}
              </Label>
              <Select value={documentType} onValueChange={setDocumentType} disabled={uploading}>
                <SelectTrigger id="document-type">
                  <SelectValue placeholder="Select document type first" />
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
                {/* File Upload - using ref for better mobile compatibility */}
                <div>
                  <input
                    ref={fileInputRef}
                    key={`file-${inputKey}`}
                    type="file"
                    id="file-upload"
                    className="sr-only"
                    onChange={handleFileSelect}
                    accept="image/*,.pdf,.doc,.docx"
                    disabled={uploading}
                  />
                  <div 
                    onClick={handleFileClick}
                    className={`block ${documentType && !uploading ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleFileClick()}
                  >
                    <div className={`border-2 border-dashed rounded-lg p-6 md:p-8 transition-colors text-center ${
                      documentType && !uploading ? 'hover:border-primary active:bg-muted/50' : ''
                    }`}>
                      <Upload className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm md:text-base font-medium">Choose File</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        PDF, images, or documents
                      </p>
                    </div>
                  </div>
                </div>

                {/* Camera Capture - using ref and dynamic capture mode */}
                <div>
                  <input
                    ref={cameraInputRef}
                    key={`camera-${inputKey}`}
                    type="file"
                    id="camera-capture"
                    className="sr-only"
                    onChange={handleCameraCapture}
                    accept="image/*"
                    {...(!isIOS && { 
                      capture: documentType === 'selfie_with_id' ? 'user' : 'environment' 
                    })}
                    disabled={uploading}
                  />
                  <div 
                    onClick={handleCameraClick}
                    className={`block ${documentType && !uploading ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleCameraClick()}
                  >
                    <div className={`border-2 border-dashed rounded-lg p-6 md:p-8 transition-colors text-center ${
                      documentType && !uploading ? 'hover:border-primary active:bg-muted/50' : ''
                    }`}>
                      <Camera className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm md:text-base font-medium">Take Photo</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {documentType === 'selfie_with_id' ? 'Front camera (selfie)' : 'Use your camera'}
                      </p>
                    </div>
                  </div>
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
          </>
        ) : (
          <div className="text-center py-4 bg-green-50 rounded-lg border border-green-200">
            <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="text-green-700 font-medium">All required documents uploaded!</p>
            <p className="text-sm text-green-600 mt-1">You're all set for this section.</p>
          </div>
        )}
      </div>
    </Card>
  );
}
