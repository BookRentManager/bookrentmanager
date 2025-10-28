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
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold text-base">Booking Information</h3>
...
            </div>
          </form>
        </Form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
