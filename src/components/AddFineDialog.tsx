import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Upload, Camera, Loader2, Sparkles } from "lucide-react";

const fineSchema = z.object({
  fine_number: z.string().min(1, "Fine number is required").max(100),
  car_plate: z.string().min(1, "Car plate is required").max(20),
  issue_date: z.string().min(1, "Issue date is required"),
  amount: z.string().min(1, "Amount is required"),
  payment_status: z.enum(["paid", "unpaid"]),
});

type FineFormValues = z.infer<typeof fineSchema>;

const sanitizeExtension = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || 'bin';
  return ext.replace(/[^a-z0-9]/g, '');
};

export function AddFineDialog() {
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [extractedAmount, setExtractedAmount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const form = useForm<FineFormValues>({
    resolver: zodResolver(fineSchema),
    defaultValues: {
      fine_number: "",
      car_plate: "",
      issue_date: new Date().toISOString().split('T')[0],
      amount: "",
      payment_status: "unpaid",
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      
      // Analyze fine document with AI
      setAnalyzing(true);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const { data: extractionData, error: extractionError } = await supabase.functions.invoke(
          'extract-invoice-amount',
          { body: formData }
        );

        if (!extractionError && extractionData?.success && extractionData.amount) {
          setExtractedAmount(extractionData.amount);
          form.setValue('amount', extractionData.amount.toString());
          toast.success(`AI detected amount: €${extractionData.amount.toFixed(2)}`);
        } else {
          toast.info("Couldn't detect amount automatically. You can enter it manually.");
        }
      } catch (error) {
        console.error('Error analyzing fine:', error);
      } finally {
        setAnalyzing(false);
      }
    }
  };

  const addFineMutation = useMutation({
    mutationFn: async (values: FineFormValues) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let documentUrl: string | null = null;
      let displayName: string | null = null;

      // Upload file if selected
      if (selectedFile) {
        // Validate file
        const formData = new FormData();
        formData.append('file', selectedFile);
        const { data: validationData, error: validationError } = await supabase.functions.invoke(
          'validate-upload',
          { body: formData }
        );
        if (validationError || !validationData?.success) {
          throw new Error(validationData?.error || 'File validation failed');
        }

        // Upload to storage
        const sanitizedExt = sanitizeExtension(selectedFile.name);
        const fileName = `${user.id}/${Date.now()}.${sanitizedExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('fines')
          .upload(fileName, selectedFile);

        if (uploadError) throw uploadError;

        documentUrl = fileName;
        displayName = selectedFile.name;
      }

      // Insert fine record
      const { error } = await supabase
        .from("fines")
        .insert({
          fine_number: values.fine_number,
          car_plate: values.car_plate,
          issue_date: values.issue_date,
          amount: parseFloat(values.amount),
          payment_status: values.payment_status,
          currency: "EUR",
          created_by: user?.id,
          document_url: documentUrl,
          display_name: displayName,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fines"] });
      toast.success("Fine added successfully");
      form.reset();
      setSelectedFile(null);
      setExtractedAmount(null);
      setOpen(false);
    },
    onError: (error) => {
      console.error('Add fine error:', error);
      toast.error("Failed to add fine");
    },
  });

  const onSubmit = (values: FineFormValues) => {
    addFineMutation.mutate(values);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      form.reset();
      setSelectedFile(null);
      setExtractedAmount(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Fine
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Fine</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fine_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fine Number *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., FINE-2024-001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="car_plate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Car Plate *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., ZH-12345" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="issue_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Issue Date *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    Amount (EUR) *
                    {extractedAmount && (
                      <span className="text-xs text-success font-medium flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        AI detected
                      </span>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="0.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="payment_status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Status *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="unpaid">Unpaid</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Document Upload Section */}
            <div className="space-y-3">
              <FormLabel>Fine Document (Optional)</FormLabel>
              <div className="flex flex-col sm:flex-row gap-2">
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
                  disabled={addFineMutation.isPending || analyzing}
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
                  disabled={addFineMutation.isPending || analyzing}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Take Photo
                </Button>
              </div>
              
              {selectedFile && !analyzing && (
                <div className="p-3 bg-muted/50 rounded-md border">
                  <p className="text-sm font-medium truncate">Selected: {selectedFile.name}</p>
                </div>
              )}
              
              {analyzing && (
                <div className="p-3 bg-primary/5 rounded-md border border-primary/20 animate-pulse">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 text-primary animate-spin" />
                    <p className="text-sm text-primary">AI analyzing document...</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addFineMutation.isPending || analyzing}>
                {addFineMutation.isPending ? "Adding..." : "Add Fine"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
