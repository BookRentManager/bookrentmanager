import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const bookingSchema = z.object({
  reference_code: z.string().min(1, "Reference code is required").max(50),
  client_name: z.string().min(1, "Client name is required").max(200),
  client_email: z.string().email("Invalid email").max(255).optional().or(z.literal("")),
  client_phone: z.string().max(50).optional(),
  car_model: z.string().min(1, "Car model is required").max(100),
  car_plate: z.string().min(1, "Car plate is required").max(20),
  delivery_location: z.string().min(1, "Delivery location is required").max(200),
  delivery_datetime: z.string().min(1, "Delivery date & time is required"),
  collection_location: z.string().min(1, "Collection location is required").max(200),
  collection_datetime: z.string().min(1, "Collection date & time is required"),
  rental_price_gross: z.string().min(1, "Rental price is required"),
  supplier_price: z.string().min(1, "Supplier price is required"),
  vat_rate: z.string().min(1, "VAT rate is required"),
  security_deposit_amount: z.string().min(1, "Security deposit is required"),
  status: z.enum(["confirmed", "to_be_confirmed", "cancelled"]),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

export function AddBookingDialog() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      reference_code: "",
      client_name: "",
      client_email: "",
      client_phone: "",
      car_model: "",
      car_plate: "",
      delivery_location: "",
      delivery_datetime: "",
      collection_location: "",
      collection_datetime: "",
      rental_price_gross: "",
      supplier_price: "",
      vat_rate: "7.7",
      security_deposit_amount: "0",
      status: "to_be_confirmed",
    },
  });

  const addBookingMutation = useMutation({
    mutationFn: async (values: BookingFormValues) => {
      const rentalGross = parseFloat(values.rental_price_gross);
      const supplierPrice = parseFloat(values.supplier_price);
      const vatRate = parseFloat(values.vat_rate);
      
      const rentalNet = rentalGross / (1 + vatRate / 100);
      const amountTotal = rentalGross;

      const { error } = await supabase
        .from("bookings")
        .insert({
          reference_code: values.reference_code,
          client_name: values.client_name,
          client_email: values.client_email || null,
          client_phone: values.client_phone || null,
          car_model: values.car_model,
          car_plate: values.car_plate,
          delivery_location: values.delivery_location,
          delivery_datetime: values.delivery_datetime,
          collection_location: values.collection_location,
          collection_datetime: values.collection_datetime,
          rental_price_gross: rentalGross,
          supplier_price: supplierPrice,
          vat_rate: vatRate,
          security_deposit_amount: parseFloat(values.security_deposit_amount),
          amount_total: amountTotal,
          amount_paid: 0,
          other_costs_total: 0,
          status: values.status,
          currency: "EUR",
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Booking created successfully");
      form.reset();
      setOpen(false);
    },
    onError: (error) => {
      console.error('Add booking error:', error);
      toast.error("Failed to create booking");
    },
  });

  const onSubmit = (values: BookingFormValues) => {
    addBookingMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New Booking
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Create New Booking</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-8rem)] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="reference_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reference Code *</FormLabel>
                      <FormControl>
                        <Input placeholder="BK-2024-001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="to_be_confirmed">To Be Confirmed</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Client Information</h3>
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

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="client_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="client@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="client_phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="+41 79 123 45 67" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Vehicle Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="car_model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Car Model *</FormLabel>
                        <FormControl>
                          <Input placeholder="Mercedes S-Class" {...field} />
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
                          <Input placeholder="ZH-12345" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Rental Period</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="delivery_location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Delivery Location *</FormLabel>
                        <FormControl>
                          <Input placeholder="Zurich Airport" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="delivery_datetime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Delivery Date & Time *</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="collection_location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Collection Location *</FormLabel>
                        <FormControl>
                          <Input placeholder="Geneva Airport" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="collection_datetime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Collection Date & Time *</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Financial Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="rental_price_gross"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rental Price Gross (EUR) *</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="supplier_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Supplier Price (EUR) *</FormLabel>
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
                          <Input type="number" step="0.1" placeholder="7.7" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="security_deposit_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Security Deposit (EUR) *</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addBookingMutation.isPending}>
                  {addBookingMutation.isPending ? "Creating..." : "Create Booking"}
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
