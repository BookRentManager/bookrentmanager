import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Upload, Camera } from "lucide-react";

interface SimpleInvoiceUploadProps {
  bookingId: string;
  carPlate?: string;
}

export function SimpleInvoiceUpload({ bookingId, carPlate }: SimpleInvoiceUploadProps) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [amount, setAmount] = useState("");
  const [extractedAmount, setExtractedAmount] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Auto-set display name from file name
      if (!displayName) {
        setDisplayName(file.name);
      }

      // Analyze invoice with AI
      setAnalyzing(true);
      console.log('Starting AI analysis for invoice:', file.name, file.type, file.size);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const { data: extractionData, error: extractionError } = await supabase.functions.invoke(
          'extract-invoice-amount',
          { body: formData }
        );

        console.log('AI extraction result:', { extractionData, extractionError });

        if (extractionError) {
          console.error('AI extraction error:', extractionError);
          toast.error("AI analysis failed. Please enter the amount manually.");
        } else if (extractionData?.success && extractionData.amount) {
          setExtractedAmount(extractionData.amount);
          setAmount(extractionData.amount.toString());
          toast.success(`AI detected amount: €${extractionData.amount.toFixed(2)}`);
        } else {
          toast.info("Couldn't detect amount automatically. Please enter it manually.");
        }
      } catch (error) {
        console.error('Error analyzing invoice:', error);
        toast.error("AI analysis failed. Please enter the amount manually.");
      } finally {
        setAnalyzing(false);
      }
    }
  };

  const uploadInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("No file selected");

      setUploading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Server-side validation
      const formData = new FormData();
      formData.append('file', selectedFile);

      const { data: validationData, error: validationError } = await supabase.functions.invoke(
        'validate-upload',
        { body: formData }
      );

      if (validationError || !validationData?.success) {
        throw new Error(validationData?.error || 'File validation failed');
      }

      // Sanitize file extension to prevent injection attacks
      const sanitizeExtension = (filename: string): string => {
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
        return allowedExts.includes(ext) ? ext : 'bin';
      };

      const sanitizedExt = sanitizeExtension(selectedFile.name);
      const fileName = `${user.id}/${Date.now()}.${sanitizedExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Insert invoice record
      const { error: insertError } = await supabase
        .from("supplier_invoices")
        .insert({
          booking_id: bookingId,
          car_plate: carPlate || null,
          invoice_url: fileName,
          supplier_name: displayName || selectedFile.name,
          payment_status: "to_pay",
          issue_date: new Date().toISOString().split('T')[0],
          amount: parseFloat(amount) || 0,
          currency: "EUR",
        });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-invoices", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice uploaded successfully");
      setOpen(false);
      setSelectedFile(null);
      setDisplayName("");
      setAmount("");
      setExtractedAmount(null);
    },
    onError: (error) => {
      console.error('Upload error:', error);
      toast.error("Failed to upload invoice");
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
          Add Invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Supplier Invoice</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="display-name">Supplier Name / File Name (Optional)</Label>
            <Input
              id="display-name"
              placeholder="e.g., Rental Company Invoice"
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
                disabled={uploading || analyzing}
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
                disabled={uploading || analyzing}
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
            {analyzing && (
              <p className="text-sm text-primary animate-pulse">
                AI analyzing invoice...
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="amount">
              Invoice Amount (EUR) *
              {extractedAmount && (
                <span className="ml-2 text-xs text-success">✓ AI detected</span>
              )}
            </Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
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
              onClick={() => uploadInvoiceMutation.mutate()}
              disabled={!selectedFile || !amount || uploading || analyzing}
            >
              {uploading ? "Uploading..." : analyzing ? "Analyzing..." : "Upload Invoice"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
