import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Plus, Upload, Camera, Sparkles, Loader2, FileText } from "lucide-react";

const invoiceSchema = z.object({
  issue_date: z.string().min(1, "Issue date is required"),
  amount: z.string().min(1, "Amount is required"),
  booking_id: z.string().optional(),
  notes: z.string().optional(),
});

type InvoiceFormValues = z.infer<typeof invoiceSchema>;

const sanitizeExtension = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
  return allowedExts.includes(ext) ? ext : 'bin';
};

interface AddAgencyInvoiceDialogProps {
  agencyId: string;
  agencyName: string;
}

export function AddAgencyInvoiceDialog({ agencyId, agencyName }: AddAgencyInvoiceDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [extractedAmount, setExtractedAmount] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      issue_date: new Date().toISOString().split("T")[0],
      amount: "",
      booking_id: "",
      notes: "",
    },
  });

  // Fetch agency bookings for linking
  const { data: agencyBookings } = useQuery({
    queryKey: ["agency-bookings", agencyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, reference_code, car_model, delivery_datetime")
        .eq("agency_id", agencyId)
        .is("deleted_at", null)
        .order("delivery_datetime", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setAnalyzing(true);
      setExtractedAmount(null);

      try {
        const formData = new FormData();
        formData.append('file', file);

        const { data, error } = await supabase.functions.invoke('extract-invoice-amount', {
          body: formData,
        });

        if (error) throw error;

        if (data?.amount) {
          setExtractedAmount(data.amount.toString());
          form.setValue('amount', data.amount.toString());
          toast.success(`Extracted amount: €${data.amount}`);
        } else {
          toast.info("Could not extract amount automatically");
        }
      } catch (error) {
        console.error('AI extraction error:', error);
        toast.error("Failed to analyze document");
      } finally {
        setAnalyzing(false);
      }
    }
  };

  const addInvoiceMutation = useMutation({
    mutationFn: async (values: InvoiceFormValues) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      let invoiceUrl = null;

      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);

        const { data: validationData, error: validationError } = await supabase.functions.invoke(
          'validate-upload',
          { body: formData }
        );

        if (validationError || !validationData?.success) {
          throw new Error(validationData?.error || 'File validation failed');
        }

        const sanitizedExt = sanitizeExtension(selectedFile.name);
        const fileName = `agency-invoices/${user.id}/${Date.now()}_invoice.${sanitizedExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('invoices')
          .upload(fileName, selectedFile);

        if (uploadError) throw uploadError;
        invoiceUrl = fileName;
      }

      const { error } = await supabase
        .from("agency_invoices")
        .insert({
          agency_id: agencyId,
          booking_id: values.booking_id && values.booking_id !== "none" ? values.booking_id : null,
          issue_date: values.issue_date,
          amount: parseFloat(values.amount),
          invoice_url: invoiceUrl,
          notes: values.notes || null,
          created_by: user.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency-invoices", agencyId] });
      queryClient.invalidateQueries({ queryKey: ["agency-stats"] });
      toast.success("Agency invoice added successfully");
      setOpen(false);
      form.reset();
      setSelectedFile(null);
      setExtractedAmount(null);
    },
    onError: (error) => {
      console.error("Error adding invoice:", error);
      toast.error("Failed to add invoice");
    },
  });

  const onSubmit = (values: InvoiceFormValues) => {
    addInvoiceMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Commission Invoice - {agencyName}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Document Upload */}
            <div className="space-y-2">
              <FormLabel>Invoice Document</FormLabel>
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
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={analyzing}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
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
                  size="sm"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={analyzing}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Camera
                </Button>
              </div>
              {selectedFile && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  {selectedFile.name}
                </div>
              )}
              {analyzing && (
                <div className="flex items-center gap-2 text-sm text-primary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <Sparkles className="h-4 w-4" />
                  Analyzing document...
                </div>
              )}
              {extractedAmount && (
                <div className="flex items-center gap-2 text-sm text-success">
                  <Sparkles className="h-4 w-4" />
                  AI extracted: €{extractedAmount}
                </div>
              )}
            </div>

            <FormField
              control={form.control}
              name="issue_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Issue Date</FormLabel>
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
                  <FormLabel>Amount (EUR)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="booking_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Link to Booking (Optional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a booking" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No linked booking</SelectItem>
                      {agencyBookings?.map((booking) => (
                        <SelectItem key={booking.id} value={booking.id}>
                          {booking.reference_code} - {booking.car_model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any additional notes..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={addInvoiceMutation.isPending}>
                {addInvoiceMutation.isPending ? "Adding..." : "Add Invoice"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
