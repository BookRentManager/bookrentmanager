import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Upload, Camera, Loader2, Sparkles, HelpCircle } from "lucide-react";

const invoiceSchema = z.object({
  supplier_name: z.string().min(1, "Supplier name is required").max(200),
  car_plate: z.string().max(20).optional(),
  issue_date: z.string().min(1, "Issue date is required"),
  amount: z.string().min(1, "Amount is required"),
  payment_status: z.enum(["paid", "to_pay"]),
});

type InvoiceFormValues = z.infer<typeof invoiceSchema>;

const sanitizeExtension = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || 'bin';
  return ext.replace(/[^a-z0-9]/g, '');
};

export function AddInvoiceDialog() {
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [extractedAmount, setExtractedAmount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      supplier_name: "",
      car_plate: "",
      issue_date: new Date().toISOString().split('T')[0],
      amount: "",
      payment_status: "to_pay",
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      
      // Analyze invoice document with AI
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
        console.error('Error analyzing invoice:', error);
      } finally {
        setAnalyzing(false);
      }
    }
  };

  const addInvoiceMutation = useMutation({
    mutationFn: async (values: InvoiceFormValues) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let invoiceUrl: string | null = null;

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
          .from('invoices')
          .upload(fileName, selectedFile);

        if (uploadError) throw uploadError;

        invoiceUrl = fileName;
      }

      const { error } = await supabase
        .from("supplier_invoices")
        .insert({
          supplier_name: values.supplier_name,
          car_plate: values.car_plate || null,
          issue_date: values.issue_date,
          amount: parseFloat(values.amount),
          payment_status: values.payment_status,
          currency: "EUR",
          created_by: user?.id,
          invoice_url: invoiceUrl,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-invoices"] });
      toast.success("Invoice added successfully");
      form.reset();
      setSelectedFile(null);
      setExtractedAmount(null);
      setOpen(false);
    },
    onError: (error) => {
      console.error('Add invoice error:', error);
      toast.error("Failed to add invoice");
    },
  });

  const onSubmit = (values: InvoiceFormValues) => {
    addInvoiceMutation.mutate(values);
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
        <div className="flex items-center gap-1">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Unlinked Invoice
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>All supplier invoices related to a rental should be added within the specific booking. Only unlinked invoices not associated with any rental should be added here.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Unlinked Supplier Invoice</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="supplier_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Supplier Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Premium Car Rentals AG" {...field} />
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
                  <FormLabel>Car Plate (Optional)</FormLabel>
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
                      <SelectItem value="to_pay">To Pay</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Document Upload Section */}
            <div className="space-y-3">
              <FormLabel>Invoice Document (Optional)</FormLabel>
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
                  disabled={addInvoiceMutation.isPending || analyzing}
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
                  disabled={addInvoiceMutation.isPending || analyzing}
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
              <Button type="submit" disabled={addInvoiceMutation.isPending || analyzing}>
                {addInvoiceMutation.isPending ? "Adding..." : "Add Invoice"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
