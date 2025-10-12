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
  billing_address: z.string().max(500).optional(),
  country: z.string().max(100).optional(),
  car_model: z.string().min(1, "Car model is required").max(100),
  car_plate: z.string().min(1, "Car plate is required").max(20),
  supplier_name: z.string().optional(),
  km_included: z.string()
    .optional()
    .refine((val) => !val || (!isNaN(parseInt(val)) && parseInt(val) >= 0 && parseInt(val) <= 1000000), {
      message: "Must be a valid number between 0 and 1,000,000"
    }),
  extra_km_cost: z.string()
    .optional()
    .refine((val) => !val || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0 && parseFloat(val) <= 100), {
      message: "Must be a valid number between 0 and 100"
    }),
  delivery_location: z.string().min(1, "Delivery location is required").max(200),
  delivery_datetime: z.string().min(1, "Delivery date & time is required"),
  delivery_info: z.string().optional(),
  collection_location: z.string().min(1, "Collection location is required").max(200),
  collection_datetime: z.string().min(1, "Collection date & time is required"),
  collection_info: z.string().optional(),
  rental_price_gross: z.string()
    .min(1, "Rental price is required")
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0 && parseFloat(val) <= 10000000, {
      message: "Must be a valid price between 0 and 10,000,000"
    }),
  supplier_price: z.string()
    .min(1, "Supplier price is required")
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0 && parseFloat(val) <= 10000000, {
      message: "Must be a valid price between 0 and 10,000,000"
    }),
  security_deposit_amount: z.string()
    .min(1, "Security deposit is required")
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0 && parseFloat(val) <= 10000000, {
      message: "Must be a valid amount between 0 and 10,000,000"
    }),
  status: z.enum(["draft", "confirmed", "cancelled"]),
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
      billing_address: "",
      country: "",
      car_model: "",
      car_plate: "",
      supplier_name: "",
      km_included: "",
      extra_km_cost: "",
      delivery_location: "",
      delivery_datetime: "",
      delivery_info: "",
      collection_location: "",
      collection_datetime: "",
      collection_info: "",
      rental_price_gross: "",
      supplier_price: "",
      security_deposit_amount: "0",
      status: "draft",
    },
  });

  const addBookingMutation = useMutation({
    mutationFn: async (values: BookingFormValues) => {
      const { data: { user } } = await supabase.auth.getUser();
      const rentalGross = parseFloat(values.rental_price_gross);
      const supplierPrice = parseFloat(values.supplier_price);
      const amountTotal = rentalGross;

      const { error } = await supabase
        .from("bookings")
        .insert({
          reference_code: values.reference_code,
          client_name: values.client_name,
          client_email: values.client_email || null,
          client_phone: values.client_phone || null,
          billing_address: values.billing_address || null,
          country: values.country || null,
          car_model: values.car_model,
          car_plate: values.car_plate,
          supplier_name: values.supplier_name || null,
          km_included: values.km_included ? parseInt(values.km_included) : null,
          extra_km_cost: values.extra_km_cost ? parseFloat(values.extra_km_cost) : null,
          delivery_location: values.delivery_location,
          delivery_datetime: values.delivery_datetime,
          delivery_info: values.delivery_info || null,
          collection_location: values.collection_location,
          collection_datetime: values.collection_datetime,
          collection_info: values.collection_info || null,
          rental_price_gross: rentalGross,
          supplier_price: supplierPrice,
          vat_rate: 0,
          security_deposit_amount: parseFloat(values.security_deposit_amount),
          amount_total: amountTotal,
          amount_paid: 0,
          other_costs_total: 0,
          status: values.status,
          currency: "EUR",
          created_by: user?.id,
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
      toast.error("Failed to create booking. Please check your input and try again.");
    },
  });

  const onSubmit = (values: BookingFormValues) => {
    addBookingMutation.mutate(values);
  };

  const handleOpenChange = async (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      // Fetch next reference code when dialog opens
      const { data, error } = await supabase.rpc('get_next_booking_reference');
      if (!error && data) {
        form.setValue('reference_code', data);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
                        <Input placeholder="KR008906" {...field} disabled />
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
                        <SelectItem value="draft">Draft</SelectItem>
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

                <FormField
                  control={form.control}
                  name="billing_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Billing Address</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Street, City, Postal Code" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input placeholder="Switzerland" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="supplier_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Supplier Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Supplier Company Name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="km_included"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>KM Included</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="300" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="extra_km_cost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Extra KM Cost (EUR)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.50" {...field} />
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

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="delivery_info"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Delivery Notes</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Additional delivery information..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="collection_info"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Collection Notes</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Additional collection information..." {...field} />
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
