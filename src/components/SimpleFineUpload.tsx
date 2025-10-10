import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Upload, Camera } from "lucide-react";

interface SimpleFineUploadProps {
  bookingId: string;
  carPlate?: string;
}

export function SimpleFineUpload({ bookingId, carPlate }: SimpleFineUploadProps) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Auto-set display name from file name
      if (!displayName) {
        setDisplayName(file.name);
      }
    }
  };

  const uploadFineMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("No file selected");

      setUploading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Upload file to storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('fines')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Insert fine record
      const { error: insertError } = await supabase
        .from("fines")
        .insert({
          booking_id: bookingId,
          car_plate: carPlate || null,
          document_url: fileName,
          display_name: displayName || selectedFile.name,
          payment_status: "unpaid",
          issue_date: new Date().toISOString().split('T')[0],
        });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-fines", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["fines"] });
      toast.success("Fine uploaded successfully");
      setOpen(false);
      setSelectedFile(null);
      setDisplayName("");
    },
    onError: (error) => {
      console.error('Upload error:', error);
      toast.error("Failed to upload fine");
    },
    onSettled: () => {
      setUploading(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Fine
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Fine Document</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="display-name">File Name (Optional)</Label>
            <Input
              id="display-name"
              placeholder="e.g., Fine for speeding"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Upload Document or Photo</Label>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="h-4 w-4 mr-2" />
                Choose File
              </Button>

              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => cameraInputRef.current?.click()}
                disabled={uploading}
              >
                <Camera className="h-4 w-4 mr-2" />
                Take Photo
              </Button>
            </div>
            {selectedFile && (
              <p className="text-sm text-muted-foreground">
                Selected: {selectedFile.name}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => uploadFineMutation.mutate()}
              disabled={!selectedFile || uploading}
            >
              {uploading ? "Uploading..." : "Upload Fine"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
