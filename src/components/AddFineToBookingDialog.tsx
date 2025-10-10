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
import { Plus, Upload, Camera } from "lucide-react";

const fineSchema = z.object({
  fine_number: z.string().optional(),
  car_plate: z.string().optional(),
  issue_date: z.string().optional(),
  amount: z.string().optional(),
  payment_status: z.enum(["paid", "unpaid"]),
});

type FineFormValues = z.infer<typeof fineSchema>;

interface AddFineToBookingDialogProps {
  bookingId: string;
  defaultCarPlate?: string;
}

export function AddFineToBookingDialog({ bookingId, defaultCarPlate }: AddFineToBookingDialogProps) {
  const [open, setOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const form = useForm<FineFormValues>({
    resolver: zodResolver(fineSchema),
    defaultValues: {
      fine_number: "",
      car_plate: defaultCarPlate || "",
      issue_date: new Date().toISOString().split('T')[0],
      amount: "",
      payment_status: "unpaid",
    },
  });

  const scanDocument = async (file: File) => {
    try {
      setIsScanning(true);
      toast.info("Scanning document...");

      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = (e) => {
          const result = e.target?.result as string;
          resolve(result);
        };
      });
      reader.readAsDataURL(file);
      const imageBase64 = await base64Promise;

      // Call edge function to extract data
      const { data, error } = await supabase.functions.invoke('extract-fine-data', {
        body: { imageBase64 }
      });

      if (error) throw error;

      if (data?.data) {
        const extracted = data.data;
        
        // Pre-fill form with extracted data
        if (extracted.fine_number) form.setValue('fine_number', extracted.fine_number);
        if (extracted.amount) form.setValue('amount', extracted.amount.toString());
        if (extracted.issue_date) form.setValue('issue_date', extracted.issue_date);
        if (extracted.car_plate) form.setValue('car_plate', extracted.car_plate);
        
        toast.success("Document scanned successfully!");
      } else {
        toast.error("Could not extract data from document");
      }
    } catch (error: any) {
      console.error('Scan error:', error);
      if (error.message?.includes('Rate limit')) {
        toast.error("Too many requests. Please wait a moment.");
      } else if (error.message?.includes('Credits')) {
        toast.error("AI credits required. Please add funds to your workspace.");
      } else {
        toast.error("Failed to scan document. Please enter manually.");
      }
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      await scanDocument(file);
    }
  };

  const addFineMutation = useMutation({
    mutationFn: async (values: FineFormValues) => {
      let documentUrl = null;

      // Upload file to storage if present
      if (uploadedFile) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not authenticated");

        const fileExt = uploadedFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('fines')
          .upload(fileName, uploadedFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('fines')
          .getPublicUrl(fileName);
        
        documentUrl = publicUrl;
      }

      const { error } = await supabase
        .from("fines")
        .insert({
          booking_id: bookingId,
          fine_number: values.fine_number || null,
          car_plate: values.car_plate || null,
          issue_date: values.issue_date || null,
          amount: values.amount ? parseFloat(values.amount) : null,
          payment_status: values.payment_status,
          currency: "EUR",
          document_url: documentUrl,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-fines", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["fines"] });
      toast.success("Fine added to booking");
      form.reset();
      setUploadedFile(null);
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Fine to Booking
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Fine to This Booking</DialogTitle>
        </DialogHeader>

        {/* Scan Options */}
        <div className="space-y-3 pb-4 border-b">
          <p className="text-sm text-muted-foreground">Upload a fine document (will auto-scan if possible):</p>
          {uploadedFile && (
            <p className="text-sm text-green-600">Document uploaded: {uploadedFile.name}</p>
          )}
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => fileInputRef.current?.click()}
              disabled={isScanning}
            >
              <Upload className="h-4 w-4 mr-2" />
              {isScanning ? "Scanning..." : "Upload Document"}
            </Button>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => cameraInputRef.current?.click()}
              disabled={isScanning}
            >
              <Camera className="h-4 w-4 mr-2" />
              Capture Photo
            </Button>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fine_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fine Number</FormLabel>
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
                  <FormLabel>Car Plate</FormLabel>
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

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addFineMutation.isPending}>
                {addFineMutation.isPending ? "Adding..." : "Add Fine"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
