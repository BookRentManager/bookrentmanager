import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Camera, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const DOCUMENT_TYPES = [
  { value: "id_card", label: "ID Card" },
  { value: "drivers_license", label: "Driver's License" },
  { value: "passport", label: "Passport" },
  { value: "other", label: "Other" },
] as const;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];

interface DocumentUploadProps {
  bookingId: string;
  currentDocumentCount: number;
}

type DocumentTypeValue = "id_card" | "drivers_license" | "passport" | "other";

export function DocumentUpload({ bookingId, currentDocumentCount }: DocumentUploadProps) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [documentType, setDocumentType] = useState<DocumentTypeValue | "">("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile || !documentType) {
        throw new Error("Please select a file and document type");
      }

      if (currentDocumentCount >= 5) {
        throw new Error("Maximum 5 documents allowed per booking");
      }

      // Validate file type
      if (!ALLOWED_TYPES.includes(selectedFile.type)) {
        throw new Error("Only PDF, JPG, and PNG files are allowed");
      }

      // Validate file size
      if (selectedFile.size > MAX_FILE_SIZE) {
        throw new Error("File size must be less than 10MB");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Sanitize file extension
      const fileExt = selectedFile.name.split('.').pop()?.toLowerCase();
      const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png'];
      if (!fileExt || !allowedExtensions.includes(fileExt)) {
        throw new Error("Invalid file type");
      }

      // Create file path: client-documents/{bookingId}/{documentType}_{timestamp}_{filename}
      const timestamp = Date.now();
      const sanitizedFileName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${bookingId}/${documentType}_${timestamp}_${sanitizedFileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("client-documents")
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // Insert record into database
      const { error: dbError } = await supabase
        .from("booking_documents")
        .insert([{
          booking_id: bookingId,
          document_type: documentType as DocumentTypeValue,
          file_name: selectedFile.name,
          file_path: filePath,
          file_size: selectedFile.size,
          mime_type: selectedFile.type,
          uploaded_by: user.id,
        }]);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-documents", bookingId] });
      toast({
        title: "Success",
        description: "Document uploaded successfully",
      });
      setOpen(false);
      setSelectedFile(null);
      setDocumentType("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setUploading(false);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    setUploading(true);
    uploadMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={currentDocumentCount >= 5}>
          <Upload className="mr-2 h-4 w-4" />
          Upload Document {currentDocumentCount >= 5 && "(Max reached)"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Client Document</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="document-type">Document Type</Label>
            <Select value={documentType} onValueChange={(value) => setDocumentType(value as DocumentTypeValue)}>
              <SelectTrigger id="document-type">
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Select File</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="mr-2 h-4 w-4" />
                Choose File
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => cameraInputRef.current?.click()}
                disabled={uploading}
              >
                <Camera className="mr-2 h-4 w-4" />
                Take Photo
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileSelect}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
            {selectedFile && (
              <p className="text-sm text-muted-foreground">
                Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || !documentType || uploading}
            >
              {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Upload
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
