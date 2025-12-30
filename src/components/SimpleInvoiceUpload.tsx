import { useState, useRef } from "react";
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle, ResponsiveDialogTrigger } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Upload, Camera, Loader2, Sparkles } from "lucide-react";

interface SimpleInvoiceUploadProps {
  bookingId: string;
  carPlate?: string;
  defaultInvoiceType?: "rental" | "security_deposit_extra";
}

export function SimpleInvoiceUpload({ bookingId, carPlate, defaultInvoiceType = "rental" }: SimpleInvoiceUploadProps) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [amount, setAmount] = useState("");
  const [invoiceType, setInvoiceType] = useState<"rental" | "security_deposit_extra">(defaultInvoiceType);
  const [extractedAmount, setExtractedAmount] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!displayName) {
        setDisplayName(file.name);
      }

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

      const formData = new FormData();
      formData.append('file', selectedFile);

      const { data: validationData, error: validationError } = await supabase.functions.invoke(
        'validate-upload',
        { body: formData }
      );

      if (validationError || !validationData?.success) {
        throw new Error(validationData?.error || 'File validation failed');
      }

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
          amount_paid: 0,
          invoice_type: invoiceType,
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
      setInvoiceType(defaultInvoiceType);
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
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      <ResponsiveDialogTrigger asChild>
        <Button size="sm" className="gap-2 h-10 sm:h-9">
          <Plus className="h-4 w-4" />
          Add Invoice
        </Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Upload Supplier Invoice</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <div className="space-y-4 sm:space-y-5">
          <div>
            <Label htmlFor="display-name" className="text-base sm:text-sm">
              Supplier Name / File Name (Optional)
            </Label>
            <Input
              id="display-name"
              placeholder="e.g., Rental Company Invoice"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="h-11 sm:h-10 text-base"
            />
          </div>

          <div>
            <Label htmlFor="invoice-type" className="text-base sm:text-sm">
              Invoice Type
            </Label>
            <Select value={invoiceType} onValueChange={(v: "rental" | "security_deposit_extra") => setInvoiceType(v)}>
              <SelectTrigger className="h-11 sm:h-10 text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rental">Rental Cost</SelectItem>
                <SelectItem value="security_deposit_extra">Security Deposit Extra (damage, fuel, etc.)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label className="text-base sm:text-sm">Upload Document or Photo</Label>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
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
                className="flex-1 h-12 sm:h-10 text-base sm:text-sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || analyzing}
              >
                <Upload className="h-5 w-5 sm:h-4 sm:w-4 mr-2" />
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
                className="flex-1 h-12 sm:h-10 text-base sm:text-sm"
                onClick={() => cameraInputRef.current?.click()}
                disabled={uploading || analyzing}
              >
                <Camera className="h-5 w-5 sm:h-4 sm:w-4 mr-2" />
                Take Photo
              </Button>
            </div>
            
            {selectedFile && !analyzing && (
              <div className="p-3 bg-muted/50 rounded-md border border-border">
                <p className="text-sm font-medium text-foreground">
                  Selected: {selectedFile.name}
                </p>
              </div>
            )}
            
            {analyzing && (
              <div className="p-4 bg-primary/5 rounded-md border border-primary/20 animate-pulse">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                  <div>
                    <p className="text-sm font-medium text-primary">
                      AI analyzing invoice...
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Extracting amount from document
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="amount" className="text-base sm:text-sm">
              Invoice Amount (EUR) *
              {extractedAmount && (
                <span className="ml-2 text-xs text-success font-medium">
                  <Sparkles className="inline h-3 w-3 mr-1" />
                  AI detected
                </span>
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
              className="h-11 sm:h-10 text-base"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
              disabled={uploading}
              className="h-11 sm:h-10 text-base sm:text-sm"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => uploadInvoiceMutation.mutate()}
              disabled={!selectedFile || !amount || uploading || analyzing}
              className="h-11 sm:h-10 text-base sm:text-sm"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : analyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Upload Invoice"
              )}
            </Button>
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
