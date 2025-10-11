import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";

const clientInvoiceSchema = z.object({
  invoice_number: z.string().min(1, "Invoice number is required"),
  client_name: z.string().min(1, "Client name is required"),
  billing_address: z.string().optional(),
  subtotal: z.string().min(1, "Subtotal is required"),
  vat_rate: z.string().min(1, "VAT rate is required"),
  issue_date: z.string().min(1, "Issue date is required"),
  notes: z.string().optional(),
});

type ClientInvoiceFormValues = z.infer<typeof clientInvoiceSchema>;

interface AddClientInvoiceDialogProps {
  bookingId: string;
  defaultClientName?: string;
  defaultBillingAddress?: string;
  defaultSubtotal?: number;
}

export function AddClientInvoiceDialog({
  bookingId,
  defaultClientName,
  defaultBillingAddress,
  defaultSubtotal,
}: AddClientInvoiceDialogProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<ClientInvoiceFormValues>({
    resolver: zodResolver(clientInvoiceSchema),
    defaultValues: {
      invoice_number: `INV-${Date.now()}`,
      client_name: defaultClientName || "",
      billing_address: defaultBillingAddress || "",
      subtotal: defaultSubtotal?.toString() || "",
      vat_rate: "0",
      issue_date: new Date().toISOString().split("T")[0],
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
        subtotal,
        vat_rate: vatRate,
        vat_amount: vatAmount,
        total_amount: totalAmount,
        issue_date: values.issue_date,
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
      <DialogContent className="max-w-2xl">
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
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Additional notes..." {...field} />
                  </FormControl>
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
