import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { calculateRentalDays, utcToLocalDatetimeLocal, localDatetimeLocalToISO } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const bookingSchema = z.object({
  booking_type: z.enum(["direct", "agency"]),
  reference_code: z.string().min(1, "Reference code is required").max(50),
  booking_date: z.string().optional(),
  // Agency fields
  agency_name: z.string().max(200).optional(),
  agency_email: z.string().email("Invalid email").max(255).optional().or(z.literal("")),
  agency_phone: z.string().max(50).optional(),
  // Client/Guest fields
  client_name: z.string().min(1, "Client/Guest name is required").max(200),
  client_email: z.string().email("Invalid email").max(255).optional().or(z.literal("")),
  client_phone: z.string().max(50).optional(),
  company_name: z.string().max(200).optional(),
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
  payment_amount_option: z.string().optional(),
  payment_amount_percent: z.string().optional(),
  balance_due_date: z.string().optional(),
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

interface EditBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: any;
}

export function EditBookingDialog({ open, onOpenChange, booking }: EditBookingDialogProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingValues, setPendingValues] = useState<BookingFormValues | null>(null);
  const [rentalDaysPreview, setRentalDaysPreview] = useState<string>("");
  const queryClient = useQueryClient();

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      booking_type: "direct",
      reference_code: "",
      booking_date: "",
      agency_name: "",
      agency_email: "",
      agency_phone: "",
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
      payment_amount_option: "",
      payment_amount_percent: "",
      balance_due_date: "",
      rental_day_hour_tolerance: 1,
      status: "draft",
    },
  });

  const bookingType = form.watch("booking_type");
  const isAgencyBooking = bookingType === "agency";

  // Pre-populate form when booking changes
  useEffect(() => {
    if (booking && open) {
      const additionalServices = booking.additional_services || {};
      
      form.reset({
        booking_type: booking.booking_type || "direct",
        reference_code: booking.reference_code || "",
        booking_date: booking.booking_date || "",
        agency_name: booking.agency_name || "",
        agency_email: booking.agency_email || "",
        agency_phone: booking.agency_phone || "",
        client_name: booking.client_name || "",
        client_email: booking.client_email || "",
        client_phone: booking.client_phone || "",
        company_name: booking.company_name || "",
        billing_address: booking.billing_address || "",
        country: booking.country || "",
        car_model: booking.car_model || "",
        car_plate: booking.car_plate || "",
        supplier_name: booking.supplier_name || "",
        km_included: booking.km_included ? String(booking.km_included) : "",
        extra_km_cost: booking.extra_km_cost ? String(booking.extra_km_cost) : "",
        delivery_location: booking.delivery_location || "",
        delivery_datetime: booking.delivery_datetime || "",
        delivery_info: booking.delivery_info || "",
        collection_location: booking.collection_location || "",
        collection_datetime: booking.collection_datetime || "",
        collection_info: booking.collection_info || "",
        infant_seat: String(additionalServices.infant_seat || 0),
        booster_seat: String(additionalServices.booster_seat || 0),
        child_seat: String(additionalServices.child_seat || 0),
        additional_driver_1: additionalServices.additional_driver_1 || "",
        additional_driver_2: additionalServices.additional_driver_2 || "",
        excess_reduction: additionalServices.excess_reduction || false,
        rental_price_gross: booking.rental_price_gross ? String(booking.rental_price_gross) : "",
        supplier_price: booking.supplier_price ? String(booking.supplier_price) : "",
        total_rental_amount: booking.total_rental_amount ? String(booking.total_rental_amount) : "",
        security_deposit_amount: booking.security_deposit_amount ? String(booking.security_deposit_amount) : "0",
        payment_method: booking.payment_method || "",
        payment_amount_option: booking.payment_amount_option || "",
        payment_amount_percent: booking.payment_amount_percent ? String(booking.payment_amount_percent) : "",
        balance_due_date: utcToLocalDatetimeLocal(booking.balance_due_date),
        rental_day_hour_tolerance: booking.rental_day_hour_tolerance || 1,
        status: booking.status || "draft",
      });
    }
  }, [booking, open, form]);

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

  const updateBookingMutation = useMutation({
    mutationFn: async (values: BookingFormValues) => {
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

      // Track changes for notification email
      const changes: Record<string, string> = {};
      if (booking.car_model !== values.car_model) {
        changes.vehicle = `${booking.car_model} → ${values.car_model}`;
      }
      if (booking.delivery_datetime !== values.delivery_datetime) {
        changes.pickup_date = `${new Date(booking.delivery_datetime).toLocaleString()} → ${new Date(values.delivery_datetime).toLocaleString()}`;
      }
      if (booking.collection_datetime !== values.collection_datetime) {
        changes.return_date = `${new Date(booking.collection_datetime).toLocaleString()} → ${new Date(values.collection_datetime).toLocaleString()}`;
      }
      if (booking.delivery_location !== values.delivery_location) {
        changes.pickup_location = `${booking.delivery_location} → ${values.delivery_location}`;
      }
      if (booking.collection_location !== values.collection_location) {
        changes.return_location = `${booking.collection_location} → ${values.collection_location}`;
      }
      if (booking.rental_price_gross !== rentalGross) {
        changes.rental_price = `${booking.rental_price_gross} → ${rentalGross}`;
      }

      const { error } = await supabase
        .from("bookings")
        .update({
          booking_type: values.booking_type,
          reference_code: values.reference_code,
          booking_date: values.booking_date || null,
          // Agency fields
          agency_name: values.booking_type === 'agency' ? values.agency_name || null : null,
          agency_email: values.booking_type === 'agency' ? values.agency_email || null : null,
          agency_phone: values.booking_type === 'agency' ? values.agency_phone || null : null,
          // Client/Guest fields
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
          security_deposit_amount: parseFloat(values.security_deposit_amount),
          amount_total: amountTotal,
          payment_method: values.payment_method || null,
          payment_amount_option: values.payment_amount_option || null,
          payment_amount_percent: values.payment_amount_percent ? parseInt(values.payment_amount_percent) : null,
          balance_due_date: localDatetimeLocalToISO(values.balance_due_date),
          rental_day_hour_tolerance: values.rental_day_hour_tolerance || 1,
          status: values.status,
        })
        .eq("id", booking.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking", booking.id] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["booking-financials", booking.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Booking updated successfully");
      onOpenChange(false);
      setShowConfirmDialog(false);
      setPendingValues(null);
    },
    onError: (error) => {
      console.error("Update booking error:", error);
      toast.error("Failed to update booking. Please check your input and try again.");
      setShowConfirmDialog(false);
    },
  });

  const onSubmit = (values: BookingFormValues) => {
    setPendingValues(values);
    setShowConfirmDialog(true);
  };

  const handleConfirmEdit = () => {
    if (pendingValues) {
      updateBookingMutation.mutate(pendingValues);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Edit Booking</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-8rem)] pr-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {/* Booking Type Display */}
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">Booking Type</h3>
                    <Badge variant={isAgencyBooking ? "secondary" : "outline"}>
                      {isAgencyBooking ? "Agency" : "Direct"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {isAgencyBooking 
                      ? "External agency booking - agency's reference code used"
                      : "Direct client booking - KR reference code"}
                  </p>
                </div>

                <div className="space-y-4 border-t pt-4">
                  <h3 className="font-semibold">Booking Information</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="reference_code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{isAgencyBooking ? "Agency Reference *" : "Reference Code *"}</FormLabel>
                          <FormControl>
                            <Input {...field} disabled={!isAgencyBooking} />
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
                        <Select onValueChange={field.onChange} value={field.value}>
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

                {/* Agency Information - Only for Agency Bookings */}
                {isAgencyBooking && (
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="font-semibold">Agency Information</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="agency_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Agency Name *</FormLabel>
                            <FormControl>
                              <Input placeholder="Agency Company Name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="agency_email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Agency Email</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="agency@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="agency_phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Agency Phone</FormLabel>
                            <FormControl>
                              <Input placeholder="+41 79 123 45 67" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-4 border-t pt-4">
                  <h3 className="font-semibold">{isAgencyBooking ? "Guest Information" : "Client Information"}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="client_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{isAgencyBooking ? "Guest Name *" : "Client Name *"}</FormLabel>
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
                  </div>

                  <FormField
                    control={form.control}
                    name="delivery_info"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Delivery Information</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Additional delivery instructions" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="collection_location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Collection Location *</FormLabel>
                          <FormControl>
                            <Input placeholder="Zurich Airport" {...field} />
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

                  <FormField
                    control={form.control}
                    name="collection_info"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Collection Information</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Additional collection instructions" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                            <Input placeholder="Driver Name" {...field} />
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
                            <Input placeholder="Driver Name" {...field} />
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
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            Excess Reduction
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4 border-t pt-4">
                  <h3 className="font-semibold">Financial Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="rental_price_gross"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rental Price (Gross) *</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="500.00" {...field} />
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
                          <FormLabel>Supplier Price *</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="400.00" {...field} />
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
                          <FormLabel>Total Rental Amount</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="500.00" {...field} />
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
                          <FormLabel>Security Deposit *</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="1000.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
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
                          <FormControl>
                            <Input placeholder="Cash, Card, Transfer" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="payment_amount_percent"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Amount (%)</FormLabel>
                          <FormControl>
                            <Input type="number" min="0" max="100" placeholder="100" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="balance_due_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Balance Due Date</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" {...field} />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">
                            When remaining balance is due (email reminder sent on this date)
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="rental_day_hour_tolerance"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rental Day Hour Tolerance</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              max={12}
                              placeholder="1"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">
                            Time tolerance before counting an extra rental day (1-12 hours)
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t pt-4">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateBookingMutation.isPending}>
                    {updateBookingMutation.isPending ? "Updating..." : "Update Booking"}
                  </Button>
                </div>
              </form>
            </Form>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Edit</AlertDialogTitle>
            <AlertDialogDescription>
              Do you really want to edit this booking? This will update all the booking information.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmEdit}>
              Confirm Edit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
