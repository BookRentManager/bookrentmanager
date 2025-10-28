import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle, ResponsiveDialogTrigger } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/shared/PhoneInput";
import { CountrySelect } from "@/components/shared/CountrySelect";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Calendar } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { calculateRentalDays } from "@/lib/utils";

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
  payment_amount_option: z.enum(["down_payment_only", "full_payment_only", "client_choice"]).optional(),
  payment_amount_percent: z.string().optional(),
  rental_day_hour_tolerance: z.coerce
    .number()
    .int()
    .min(1, "Minimum tolerance is 1 hour")
    .max(12, "Maximum tolerance is 12 hours")
    .default(1)
    .optional(),
  status: z.enum(["draft", "confirmed", "cancelled"]),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

// Temporary test data generator for faster testing
const generateTestData = (): Partial<BookingFormValues> => {
  const carModels = ["BMW X5", "Mercedes GLE", "Audi Q7", "Tesla Model X", "Porsche Cayenne"];
  const carPlates = ["AB123CD", "XY789ZW", "DE456FG", "MN012OP", "QR345ST"];
  const suppliers = ["Hertz", "Europcar", "Sixt", "Avis", "Budget"];
  const locations = ["Rome Airport", "Milan Central", "Florence Station", "Venice Airport", "Naples Port"];
  const names = ["Mario Rossi", "Luigi Verdi", "Giuseppe Bianchi", "Antonio Russo", "Francesco Ferrari"];
  const countries = ["IT", "US", "GB", "DE", "FR"];
  const addresses = [
    "Via Roma 123, 00100 Roma",
    "Corso Milano 456, 20100 Milano",
    "Piazza Firenze 789, 50100 Firenze",
    "Viale Venezia 321, 30100 Venezia",
    "Via Napoli 654, 80100 Napoli"
  ];
  
  const randomIndex = Math.floor(Math.random() * 5);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  
  return {
    client_name: names[randomIndex],
    client_email: "gc.marletta@gmail.com", // Always use this email for testing
    client_phone: "+39 " + Math.floor(Math.random() * 900000000 + 100000000),
    company_name: Math.random() > 0.5 ? "Test Company SRL" : "",
    billing_address: addresses[randomIndex],
    country: countries[randomIndex],
    car_model: carModels[randomIndex],
    car_plate: carPlates[randomIndex],
    supplier_name: suppliers[randomIndex],
    km_included: String(Math.floor(Math.random() * 500 + 500)), // 500-1000 km
    extra_km_cost: String((Math.random() * 0.5 + 0.3).toFixed(2)), // 0.30-0.80 EUR
    delivery_location: locations[randomIndex],
    delivery_datetime: tomorrow.toISOString().slice(0, 16),
    delivery_info: "Test delivery info",
    collection_location: locations[randomIndex],
    collection_datetime: nextWeek.toISOString().slice(0, 16),
    collection_info: "Test collection info",
    rental_price_gross: String(Math.floor(Math.random() * 500 + 300)), // 300-800 EUR
    supplier_price: String(Math.floor(Math.random() * 300 + 100)), // 100-400 EUR
    security_deposit_amount: String(Math.floor(Math.random() * 500 + 500)), // 500-1000 EUR
    infant_seat: String(Math.floor(Math.random() * 3)), // 0-2
    booster_seat: String(Math.floor(Math.random() * 3)), // 0-2
    child_seat: String(Math.floor(Math.random() * 3)), // 0-2
    additional_driver_1: Math.random() > 0.7 ? names[(randomIndex + 1) % 5] : "",
    additional_driver_2: Math.random() > 0.9 ? names[(randomIndex + 2) % 5] : "",
    excess_reduction: Math.random() > 0.5,
  };
};

export function AddBookingDialog() {
  const [open, setOpen] = useState(false);
  const [rentalDaysPreview, setRentalDaysPreview] = useState<string>("");
  const [documentRequirements, setDocumentRequirements] = useState({
    drivers_license: { enabled: true, front_back: true },
    id_passport: { enabled: true, front_back: true },
    proof_of_address: { enabled: false, front_back: false },
    selfie_with_id: { enabled: false, front_back: false },
    upload_timing: 'optional' as 'optional' | 'mandatory'
  });
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
      payment_amount_option: "down_payment_only",
      payment_amount_percent: "30",
      rental_day_hour_tolerance: 1,
      status: "draft",
      send_booking_form: true,
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

      // Check if any document requirements are enabled
      const hasDocumentRequirements = Object.values(documentRequirements).some((req: any) => 
        typeof req === 'object' && req.enabled === true
      );

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
          payment_amount_option: values.payment_amount_option || null,
          payment_amount_percent: values.payment_amount_percent ? parseInt(values.payment_amount_percent) : null,
          rental_day_hour_tolerance: values.rental_day_hour_tolerance || 1,
          status: values.status,
          currency: "EUR",
          created_by: user?.id,
          available_payment_methods: values.available_payment_methods || ["visa_mastercard", "amex", "bank_transfer"],
          manual_payment_instructions: values.manual_payment_instructions || null,
          documents_required: hasDocumentRequirements,
          document_requirements: documentRequirements,
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

  const handleEnterKeyNavigation = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.currentTarget.tagName !== 'TEXTAREA') {
      e.preventDefault();
      const form = e.currentTarget.form;
      if (!form) return;
      
      const formElements = Array.from(form.elements) as HTMLElement[];
      const currentIndex = formElements.indexOf(e.currentTarget as HTMLElement);
      
      for (let i = currentIndex + 1; i < formElements.length; i++) {
        const nextElement = formElements[i];
        if (
          (nextElement instanceof HTMLInputElement || 
           nextElement instanceof HTMLTextAreaElement ||
           nextElement instanceof HTMLButtonElement) &&
          !nextElement.disabled &&
          nextElement.type !== 'submit'
        ) {
          nextElement.focus();
          break;
        }
      }
    }
  };

  // Calculate rental days on date/time/tolerance changes
  useEffect(() => {
    const subscription = form.watch((value) => {
      const deliveryDate = value.delivery_datetime;
      const collectionDate = value.collection_datetime;
      const tolerance = value.rental_day_hour_tolerance || 1;
      
      if (deliveryDate && collectionDate) {
        try {
          const calc = calculateRentalDays(
            new Date(deliveryDate),
            new Date(collectionDate),
            tolerance
          );
          setRentalDaysPreview(`${calc.formattedTotal} (${calc.formattedDuration})`);
        } catch {
          setRentalDaysPreview("");
        }
      } else {
        setRentalDaysPreview("");
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const handleOpenChange = async (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      // Fetch next reference code when dialog opens
      const { data, error } = await supabase.rpc('get_next_booking_reference');
      if (!error && data) {
        form.setValue('reference_code', data);
      }
      
      // Auto-fill with test data for faster testing
      const testData = generateTestData();
      Object.entries(testData).forEach(([key, value]) => {
        form.setValue(key as keyof BookingFormValues, value);
      });
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New Booking
        </Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent className="max-w-3xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Create New Booking</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <div className="max-h-[calc(90vh-10rem)] overflow-y-auto overflow-x-hidden md:pr-4 touch-pan-y">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold text-base">Booking Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="reference_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Reference Code *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="KR008906" 
                            {...field} 
                            disabled 
                            className="h-11"
                          />
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
                        <FormLabel className="text-base">Booking Date</FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            {...field} 
                            onKeyDown={handleEnterKeyNavigation}
                            className="h-11"
                          />
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
                      <FormLabel className="text-base">Status *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-11">
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
                <h3 className="font-semibold text-base">Client Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="client_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Client Name *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="John Doe" 
                            {...field} 
                            onKeyDown={handleEnterKeyNavigation}
                            className="h-11"
                          />
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
                        <FormLabel className="text-base">Company Name</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Company Name (if applicable)" 
                            {...field} 
                            onKeyDown={handleEnterKeyNavigation}
                            className="h-11"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="client_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Email</FormLabel>
                        <FormControl>
                          <Input 
                            type="email" 
                            placeholder="client@example.com" 
                            {...field} 
                            onKeyDown={handleEnterKeyNavigation}
                            className="h-11"
                          />
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
                      <FormLabel className="text-base">Phone</FormLabel>
                      <PhoneInput
                        value={field.value || ""}
                        onChange={field.onChange}
                        placeholder="Enter phone number with country code"
                      />
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
                      <FormLabel className="text-base">Billing Address</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Street, City, Postal Code" 
                          {...field} 
                          className="min-h-20"
                        />
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
                      <FormLabel className="text-base">Country</FormLabel>
                      <CountrySelect
                        value={field.value || ""}
                        onChange={field.onChange}
                        placeholder="Select country"
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold text-base">Vehicle Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="car_model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Car Model *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Mercedes S-Class" 
                            {...field} 
                            onKeyDown={handleEnterKeyNavigation}
                            className="h-11"
                          />
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
                        <FormLabel className="text-base">Car Plate *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="ZH-12345" 
                            {...field} 
                            onKeyDown={handleEnterKeyNavigation}
                            className="h-11"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="supplier_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Supplier Name</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Supplier Company Name" 
                            {...field} 
                            onKeyDown={handleEnterKeyNavigation}
                            className="h-11"
                          />
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
                        <FormLabel className="text-base">KM Included</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            inputMode="numeric"
                            placeholder="300" 
                            {...field} 
                            onKeyDown={handleEnterKeyNavigation}
                            className="h-11"
                          />
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
                        <FormLabel className="text-base">Extra KM Cost (EUR)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            inputMode="decimal"
                            step="0.01" 
                            placeholder="0.50" 
                            {...field} 
                            onKeyDown={handleEnterKeyNavigation}
                            className="h-11"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold text-base">Rental Period</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="delivery_location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Delivery Location *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Zurich Airport" 
                            {...field} 
                            onKeyDown={handleEnterKeyNavigation}
                            className="h-11"
                          />
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
                        <FormLabel className="text-base">Delivery Date & Time *</FormLabel>
                        <FormControl>
                          <Input 
                            type="datetime-local" 
                            {...field} 
                            onKeyDown={handleEnterKeyNavigation}
                            className="h-11"
                          />
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
                        <FormLabel className="text-base">Collection Location *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Geneva Airport" 
                            {...field} 
                            onKeyDown={handleEnterKeyNavigation}
                            className="h-11"
                          />
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
                        <FormLabel className="text-base">Collection Date & Time *</FormLabel>
                        <FormControl>
                          <Input 
                            type="datetime-local" 
                            {...field} 
                            onKeyDown={handleEnterKeyNavigation}
                            className="h-11"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="rental_day_hour_tolerance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Rental Day Hour Tolerance</FormLabel>
                        <Select 
                          onValueChange={(value) => field.onChange(parseInt(value))} 
                          defaultValue={field.value?.toString() || "1"}
                        >
                          <FormControl>
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder="Select tolerance" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((hours) => (
                              <SelectItem key={hours} value={hours.toString()}>
                                {hours} {hours === 1 ? 'hour' : 'hours'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Live Rental Days Counter */}
                {rentalDaysPreview && (
                  <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800">
                    <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <AlertTitle className="text-blue-900 text-sm dark:text-blue-200">Calculated Rental Duration</AlertTitle>
                    <AlertDescription className="text-blue-800 text-sm font-medium dark:text-blue-300">
                      {rentalDaysPreview}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="delivery_info"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Delivery Notes</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Additional delivery information..." 
                            {...field} 
                            className="min-h-20"
                          />
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
                        <FormLabel className="text-base">Collection Notes</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Additional collection information..." 
                            {...field} 
                            className="min-h-20"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold text-base">Additional Services</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="infant_seat"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Infant Seats</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            inputMode="numeric"
                            min="0" 
                            placeholder="0" 
                            {...field} 
                            onKeyDown={handleEnterKeyNavigation}
                            className="h-11"
                          />
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
                        <FormLabel className="text-base">Booster Seats</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            inputMode="numeric"
                            min="0" 
                            placeholder="0" 
                            {...field} 
                            onKeyDown={handleEnterKeyNavigation}
                            className="h-11"
                          />
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
                        <FormLabel className="text-base">Child Seats</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            inputMode="numeric"
                            min="0" 
                            placeholder="0" 
                            {...field} 
                            onKeyDown={handleEnterKeyNavigation}
                            className="h-11"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="additional_driver_1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Additional Driver 1</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Driver name" 
                            {...field} 
                            onKeyDown={handleEnterKeyNavigation}
                            className="h-11"
                          />
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
                        <FormLabel className="text-base">Additional Driver 2</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Driver name" 
                            {...field} 
                            onKeyDown={handleEnterKeyNavigation}
                            className="h-11"
                          />
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
                          className="mt-0.5 h-5 w-5"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-base">Excess Reduction</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold text-base">Financial Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="rental_price_gross"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Rental Price (EUR) *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            inputMode="decimal"
                            step="0.01" 
                            placeholder="0.00" 
                            {...field} 
                            onKeyDown={handleEnterKeyNavigation}
                            className="h-11"
                          />
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
                        <FormLabel className="text-base">Total Rental Amount (EUR)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            inputMode="decimal"
                            step="0.01" 
                            placeholder="Including services" 
                            {...field} 
                            onKeyDown={handleEnterKeyNavigation}
                            className="h-11"
                          />
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
                        <FormLabel className="text-base">Supplier Price (EUR) *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            inputMode="decimal"
                            step="0.01" 
                            placeholder="0.00" 
                            {...field} 
                            onKeyDown={handleEnterKeyNavigation}
                            className="h-11"
                          />
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
                      <FormLabel className="text-base">Security Deposit (EUR) *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          inputMode="decimal"
                          step="0.01" 
                          placeholder="0.00" 
                          {...field} 
                          onKeyDown={handleEnterKeyNavigation}
                          className="h-11"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold text-base">Payment Configuration</h3>
                
                <FormField
                  control={form.control}
                  name="payment_amount_option"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel className="text-base">Payment Amount Strategy</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="space-y-3"
                        >
                          <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
                            <RadioGroupItem value="down_payment_only" id="down_payment_only" />
                            <div className="flex-1">
                              <Label htmlFor="down_payment_only" className="cursor-pointer font-medium">
                                Require down payment only
                              </Label>
                              <p className="text-sm text-muted-foreground mt-1">
                                Client must pay specified percentage upfront (rest due later)
                              </p>
                            </div>
                          </div>

                          <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
                            <RadioGroupItem value="full_payment_only" id="full_payment_only" />
                            <div className="flex-1">
                              <Label htmlFor="full_payment_only" className="cursor-pointer font-medium">
                                Require full payment
                              </Label>
                              <p className="text-sm text-muted-foreground mt-1">
                                Client must pay 100% of booking amount upfront
                              </p>
                            </div>
                          </div>

                          <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
                            <RadioGroupItem value="client_choice" id="client_choice" />
                            <div className="flex-1">
                              <Label htmlFor="client_choice" className="cursor-pointer font-medium">
                                Let client choose
                              </Label>
                              <p className="text-sm text-muted-foreground mt-1">
                                Client can choose between down payment or full payment
                              </p>
                            </div>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {(form.watch("payment_amount_option") === "down_payment_only" || 
                  form.watch("payment_amount_option") === "client_choice") && (
                  <FormField
                    control={form.control}
                    name="payment_amount_percent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Down Payment Percentage *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            inputMode="numeric"
                            min="1" 
                            max="99" 
                            placeholder="30" 
                            {...field} 
                            onKeyDown={handleEnterKeyNavigation}
                            className="h-11"
                          />
                        </FormControl>
                        <p className="text-sm text-muted-foreground">
                          Percentage of total amount required as down payment (1-99%)
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
              </div>

              {/* Booking Form Sending Options */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold text-base">Booking Form</h3>
                
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
                          className="mt-0.5 h-5 w-5"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-base">Send booking form to client</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Automatically send booking form link via email after creation
                          {!form.watch("client_email") && " (email required)"}
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                {/* Document Requirements Configuration */}
                <div className="space-y-4 border-t pt-4">
                  <div>
                    <h3 className="font-semibold text-base mb-2">Document Requirements</h3>
                    <p className="text-sm text-muted-foreground">
                      Configure which documents clients can upload and when they must upload them
                    </p>
                  </div>

                  {/* Always Required Documents (checked/disabled) */}
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Required Documents</p>
                    
                    <div className="flex items-center space-x-3 rounded-md border bg-muted/30 p-3">
                      <Checkbox checked={true} disabled className="h-5 w-5" />
                      <div className="flex-1">
                        <Label className="font-medium text-base">Driver's License (Front & Back)</Label>
                        <p className="text-xs text-muted-foreground">Always required for all bookings</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 rounded-md border bg-muted/30 p-3">
                      <Checkbox checked={true} disabled className="h-5 w-5" />
                      <div className="flex-1">
                        <Label className="font-medium text-base">ID Card / Passport (Front & Back)</Label>
                        <p className="text-xs text-muted-foreground">Always required for all bookings</p>
                      </div>
                    </div>
                  </div>

                  {/* Optional Additional Documents */}
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Additional Documents (Optional)</p>
                    
                    <div className="flex items-center space-x-3 rounded-md border p-3">
                      <Checkbox
                        checked={documentRequirements.proof_of_address?.enabled || false}
                        onCheckedChange={(checked) => {
                          setDocumentRequirements({
                            ...documentRequirements,
                            proof_of_address: { enabled: !!checked, front_back: false }
                          });
                        }}
                        className="h-5 w-5"
                      />
                      <div className="flex-1">
                        <Label className="font-medium text-base cursor-pointer">Proof of Address</Label>
                        <p className="text-xs text-muted-foreground">Utility bill, bank statement, or official document</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 rounded-md border p-3">
                      <Checkbox
                        checked={documentRequirements.selfie_with_id?.enabled || false}
                        onCheckedChange={(checked) => {
                          setDocumentRequirements({
                            ...documentRequirements,
                            selfie_with_id: { enabled: !!checked, front_back: false }
                          });
                        }}
                        className="h-5 w-5"
                      />
                      <div className="flex-1">
                        <Label className="font-medium text-base cursor-pointer">Selfie with ID</Label>
                        <p className="text-xs text-muted-foreground">Client holding their ID document</p>
                      </div>
                    </div>
                  </div>

                  {/* Upload Timing */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Upload Timing</Label>
                    <RadioGroup
                      value={documentRequirements.upload_timing || 'optional'}
                      onValueChange={(value) => {
                        setDocumentRequirements({
                          ...documentRequirements,
                          upload_timing: value as 'optional' | 'mandatory'
                        });
                      }}
                      className="space-y-2"
                    >
                      <div className="flex items-start space-x-3 rounded-md border p-4">
                        <RadioGroupItem value="optional" id="upload_optional" className="mt-0.5" />
                        <div className="flex-1">
                          <Label htmlFor="upload_optional" className="cursor-pointer font-medium">
                            Optional - Upload Now or Later
                          </Label>
                          <p className="text-sm text-muted-foreground mt-1">
                            Clients can skip document upload during booking submission and upload later in the client portal
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3 rounded-md border p-4">
                        <RadioGroupItem value="mandatory" id="upload_mandatory" className="mt-0.5" />
                        <div className="flex-1">
                          <Label htmlFor="upload_mandatory" className="cursor-pointer font-medium">
                            Mandatory - Must Upload Before Submission
                          </Label>
                          <p className="text-sm text-muted-foreground mt-1">
                            Clients cannot submit the booking form until they upload all required documents
                          </p>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="available_payment_methods"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">Available Payment Methods *</FormLabel>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                className="h-5 w-5"
                              />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer text-base">
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
                        <FormLabel className="text-base">Manual Payment Instructions</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Enter payment instructions for manual/other payment methods..." 
                            {...field} 
                            className="min-h-20"
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
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
