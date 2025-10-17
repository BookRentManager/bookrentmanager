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
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PhoneInput } from "@/components/shared/PhoneInput";
import { CountrySelect } from "@/components/shared/CountrySelect";

const bookingSchema = z.object({
  reference_code: z.string().min(1, "Reference code is required").max(50),
  booking_date: z.string().optional(),
  client_name: z.string().min(1, "Client name is required").max(200),
  client_email: z.string().email("Invalid email").max(255).optional().or(z.literal("")),
  client_phone: z.string().max(50).optional(),
  company_name: z.string().max(200).optional(),
  billing_address: z.string().max(500).optional(),
  country: z.string().max(100).optional(),
  car_model: z.string().min(1, "Car model is required").max(100),
  car_plate: z.string().min(1, "Car plate is required").max(20),
  supplier_name: z.string().optional(),
  send_booking_form: z.boolean().optional(),
  available_payment_methods: z.array(z.string()).optional(),
  manual_payment_instructions: z.string().optional(),
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
  infant_seat: z.string().optional(),
  booster_seat: z.string().optional(),
  child_seat: z.string().optional(),
  additional_driver_1: z.string().max(200).optional(),
  additional_driver_2: z.string().max(200).optional(),
  excess_reduction: z.boolean().optional(),
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
  total_rental_amount: z.string().optional(),
  security_deposit_amount: z.string()
    .min(1, "Security deposit is required")
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0 && parseFloat(val) <= 10000000, {
      message: "Must be a valid amount between 0 and 10,000,000"
    }),
  payment_method: z.string().optional(),
  payment_amount_percent: z.string().optional(),
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
      booking_date: new Date().toISOString().split('T')[0],
      client_name: "",
      client_email: "",
      client_phone: "",
      company_name: "",
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
      infant_seat: "0",
      booster_seat: "0",
      child_seat: "0",
      additional_driver_1: "",
      additional_driver_2: "",
      excess_reduction: false,
      rental_price_gross: "",
      supplier_price: "",
      total_rental_amount: "",
      security_deposit_amount: "0",
      payment_method: "",
      payment_amount_percent: "",
      status: "draft",
      send_booking_form: false,
      available_payment_methods: ["visa_mastercard", "amex", "bank_transfer"],
      manual_payment_instructions: "",
    },
  });

  const addBookingMutation = useMutation({
    mutationFn: async (values: BookingFormValues) => {
      const { data: { user } } = await supabase.auth.getUser();
      const rentalGross = parseFloat(values.rental_price_gross);
      const supplierPrice = parseFloat(values.supplier_price);
      const totalRentalAmount = values.total_rental_amount ? parseFloat(values.total_rental_amount) : rentalGross;
      const amountTotal = totalRentalAmount;

      // Construct additional_services JSONB object
      const additionalServices = {
        infant_seat: values.infant_seat ? parseInt(values.infant_seat) : 0,
        booster_seat: values.booster_seat ? parseInt(values.booster_seat) : 0,
        child_seat: values.child_seat ? parseInt(values.child_seat) : 0,
        additional_driver_1: values.additional_driver_1 || null,
        additional_driver_2: values.additional_driver_2 || null,
        excess_reduction: values.excess_reduction || false,
      };

      const { data: newBooking, error } = await supabase
        .from("bookings")
        .insert({
          reference_code: values.reference_code,
          booking_date: values.booking_date || null,
          client_name: values.client_name,
          client_email: values.client_email || null,
          client_phone: values.client_phone || null,
          company_name: values.company_name || null,
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
          additional_services: additionalServices,
          rental_price_gross: rentalGross,
          supplier_price: supplierPrice,
          total_rental_amount: totalRentalAmount,
          vat_rate: 0,
          security_deposit_amount: parseFloat(values.security_deposit_amount),
          amount_total: amountTotal,
          amount_paid: 0,
          other_costs_total: 0,
          payment_method: values.payment_method || null,
          payment_amount_percent: values.payment_amount_percent ? parseInt(values.payment_amount_percent) : null,
          status: values.status,
          currency: "EUR",
          created_by: user?.id,
          available_payment_methods: values.available_payment_methods || ["visa_mastercard", "amex", "bank_transfer"],
          manual_payment_instructions: values.manual_payment_instructions || null,
        })
        .select()
        .single();

      if (error) throw error;

      // If send_booking_form is checked, process the booking
      if (values.send_booking_form && newBooking && values.client_email) {
        const { error: processError } = await supabase.functions.invoke('process-new-booking', {
          body: { booking_id: newBooking.id },
        });

        if (processError) {
          console.error('Failed to send booking form:', processError);
          toast.warning('Booking created but failed to send form email');
        }
      }

      return newBooking;
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
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Booking Information</h3>
                <div className="grid grid-cols-3 gap-4">
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
                    name="booking_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Booking Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
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
              </div>

              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Client Information</h3>
                <div className="grid grid-cols-2 gap-4">
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
                    name="company_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Company Name (if applicable)" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

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
                          <PhoneInput
                            value={field.value || ""}
                            onChange={(value) => field.onChange(value || "")}
                          />
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
                        <CountrySelect
                          value={field.value || ""}
                          onChange={field.onChange}
                        />
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
                <h3 className="font-semibold">Additional Services</h3>
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="infant_seat"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Infant Seats</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="booster_seat"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Booster Seats</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="child_seat"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Child Seats</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="additional_driver_1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Additional Driver 1</FormLabel>
                        <FormControl>
                          <Input placeholder="Driver name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="additional_driver_2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Additional Driver 2</FormLabel>
                        <FormControl>
                          <Input placeholder="Driver name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="excess_reduction"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Excess Reduction</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Financial Details</h3>
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="rental_price_gross"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rental Price (EUR) *</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="total_rental_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Rental Amount (EUR)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="Including services" {...field} />
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
                </div>

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

              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Payment Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="payment_method"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Method</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select payment method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="creditCardVisaMastercard">Credit Card (Visa/Mastercard)</SelectItem>
                            <SelectItem value="bankTransfer">Bank Transfer</SelectItem>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="payment_amount_percent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Amount %</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" max="100" placeholder="30" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Booking Form Sending Options */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Booking Form</h3>
                
                <FormField
                  control={form.control}
                  name="send_booking_form"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={!form.watch("client_email")}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Send booking form to client</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Automatically send booking form link via email after creation
                          {!form.watch("client_email") && " (email required)"}
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="available_payment_methods"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Available Payment Methods *</FormLabel>
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { value: "visa_mastercard", label: "Visa/Mastercard" },
                          { value: "amex", label: "American Express" },
                          { value: "bank_transfer", label: "Bank Transfer" },
                          { value: "manual", label: "Manual/Other" },
                        ].map((method) => (
                          <FormItem
                            key={method.value}
                            className="flex flex-row items-start space-x-3 space-y-0"
                          >
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(method.value)}
                                onCheckedChange={(checked) => {
                                  const current = field.value || [];
                                  if (checked) {
                                    field.onChange([...current, method.value]);
                                  } else {
                                    field.onChange(current.filter((v) => v !== method.value));
                                  }
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              {method.label}
                            </FormLabel>
                          </FormItem>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("available_payment_methods")?.includes("manual") && (
                  <FormField
                    control={form.control}
                    name="manual_payment_instructions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Manual Payment Instructions</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Enter payment instructions for manual/other payment methods..." 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
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
