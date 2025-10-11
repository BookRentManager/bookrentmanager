import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const clientInvoiceSchema = z.object({
  invoice_number: z.string().min(1, "Invoice number is required"),
  client_name: z.string().min(1, "Client name is required"),
  billing_address: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  subtotal: z.string().min(1, "Subtotal is required"),
  vat_rate: z.string().min(1, "VAT rate is required"),
  issue_date: z.date({ required_error: "Issue date is required" }),
  notes: z.string().optional(),
});

type ClientInvoiceFormValues = z.infer<typeof clientInvoiceSchema>;

interface AddClientInvoiceDialogProps {
  bookingId: string;
  defaultClientName?: string;
  defaultBillingAddress?: string;
  defaultSubtotal?: number;
  defaultDescription?: string;
}

export function AddClientInvoiceDialog({
  bookingId,
  defaultClientName,
  defaultBillingAddress,
  defaultSubtotal,
  defaultDescription,
}: AddClientInvoiceDialogProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<ClientInvoiceFormValues>({
    resolver: zodResolver(clientInvoiceSchema),
    defaultValues: {
      invoice_number: `INV-${Date.now()}`,
      client_name: defaultClientName || "",
      billing_address: defaultBillingAddress || "",
      description: defaultDescription || "",
      subtotal: defaultSubtotal?.toString() || "",
      vat_rate: "0",
      issue_date: new Date(),
      notes: "",
    },
  });

  const addInvoiceMutation = useMutation({
    mutationFn: async (values: ClientInvoiceFormValues) => {
      const subtotal = parseFloat(values.subtotal);
      const vatRate = parseFloat(values.vat_rate);
      const vatAmount = subtotal * (vatRate / 100);
      const totalAmount = subtotal + vatAmount;

      const { error } = await supabase.from("client_invoices").insert({
        booking_id: bookingId,
        invoice_number: values.invoice_number,
        client_name: values.client_name,
        billing_address: values.billing_address || null,
        description: values.description,
        subtotal,
        vat_rate: vatRate,
        vat_amount: vatAmount,
        total_amount: totalAmount,
        issue_date: format(values.issue_date, "yyyy-MM-dd"),
        notes: values.notes || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-invoices", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["booking", bookingId] });
      toast.success("Client invoice created successfully");
      form.reset();
      setOpen(false);
    },
    onError: (error) => {
      console.error("Add client invoice error:", error);
      toast.error("Failed to create client invoice");
    },
  });

  const onSubmit = (values: ClientInvoiceFormValues) => {
    addInvoiceMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Client Invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Client Invoice</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="invoice_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice Number *</FormLabel>
                  <FormControl>
                    <Input placeholder="INV-2024-001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="client_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="billing_address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Billing Address</FormLabel>
                  <FormControl>
                    <Textarea placeholder="123 Main St, City, Country" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice Description *</FormLabel>
                  <FormControl>
                    <Input placeholder="Car Rental Service - Vehicle Model" {...field} />
                  </FormControl>
                  <FormDescription>
                    Description of the service provided (appears on the invoice)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="subtotal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subtotal (EUR) *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="vat_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>VAT Rate (%) *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="issue_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Issue Date *</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    The date when this invoice was issued
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes / Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Additional notes or description for this invoice..." 
                      className="min-h-[100px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Add any additional information about this invoice
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addInvoiceMutation.isPending}>
                {addInvoiceMutation.isPending ? "Creating..." : "Create Invoice"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
