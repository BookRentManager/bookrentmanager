import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Euro, Car, User, Calendar, MapPin, AlertCircle, FileText, CreditCard, Receipt, Mail } from "lucide-react";
import { format } from "date-fns";
import { SimpleFineUpload } from "@/components/SimpleFineUpload";
import { SimpleInvoiceUpload } from "@/components/SimpleInvoiceUpload";
import { FineDocumentPreview } from "@/components/FineDocumentPreview";
import { FinePaymentProof } from "@/components/FinePaymentProof";
import { InvoiceDocumentPreview } from "@/components/InvoiceDocumentPreview";
import { InvoicePaymentProof } from "@/components/InvoicePaymentProof";
import { AddClientInvoiceDialog } from "@/components/AddClientInvoiceDialog";
import { EditClientInvoiceDialog } from "@/components/EditClientInvoiceDialog";
import { ClientInvoicePDF } from "@/components/ClientInvoicePDF";
import { PDFDownloadLink } from '@react-pdf/renderer';
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Download, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function BookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [extraDeduction, setExtraDeduction] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const queryClient = useQueryClient();

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const { data: appSettings } = useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  const { data: booking, isLoading } = useQuery({
    queryKey: ["booking", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: financials } = useQuery({
    queryKey: ["booking-financials", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_financials")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: payments } = useQuery({
    queryKey: ["booking-payments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("booking_id", id)
        .order("paid_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: fines } = useQuery({
    queryKey: ["booking-fines", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fines")
        .select("*")
        .eq("booking_id", id)
        .is("deleted_at", null)
        .order("issue_date", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: supplierInvoices } = useQuery({
    queryKey: ["supplier-invoices", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_invoices")
        .select("*")
        .eq("booking_id", id)
        .is("deleted_at", null)
        .order("issue_date", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: clientInvoices } = useQuery({
    queryKey: ["client-invoices", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_invoices")
        .select("*")
        .eq("booking_id", id)
        .is("deleted_at", null)
        .order("issue_date", { ascending: false});

      if (error) throw error;
      return data || [];
    },
  });

  const { data: expenses } = useQuery({
    queryKey: ["booking-expenses", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("booking_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const confirmBookingMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'confirmed' })
        .eq('id', bookingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking-financials', id] });
      queryClient.invalidateQueries({ queryKey: ['client-invoices', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Booking confirmed successfully');
    },
    onError: (error) => {
      console.error('Confirm booking error:', error);
      toast.error('Failed to confirm booking');
    },
  });

  const cancelBookingMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const now = new Date().toISOString();
      
      // Update booking status to cancelled
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingId);

      if (bookingError) throw bookingError;

      // Soft delete all client invoices
      const { error: clientInvoicesError } = await supabase
        .from('client_invoices')
        .update({ deleted_at: now })
        .eq('booking_id', bookingId)
        .is('deleted_at', null);

      if (clientInvoicesError) throw clientInvoicesError;

      // Soft delete all supplier invoices
      const { error: supplierInvoicesError } = await supabase
        .from('supplier_invoices')
        .update({ deleted_at: now })
        .eq('booking_id', bookingId)
        .is('deleted_at', null);

      if (supplierInvoicesError) throw supplierInvoicesError;

      // Soft delete all fines
      const { error: finesError } = await supabase
        .from('fines')
        .update({ deleted_at: now })
        .eq('booking_id', bookingId)
        .is('deleted_at', null);

      if (finesError) throw finesError;
    },
    onSuccess: () => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['client-invoices', id] });
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices', id] });
      queryClient.invalidateQueries({ queryKey: ['booking-fines', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Booking cancelled successfully');
    },
    onError: (error) => {
      console.error('Cancel booking error:', error);
      toast.error('Failed to cancel booking');
    },
  });

  const deleteClientInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase
        .from('client_invoices')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', invoiceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-invoices', id] });
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      toast.success('Client invoice cancelled successfully');
    },
    onError: (error) => {
      console.error('Delete client invoice error:', error);
      toast.error('Failed to cancel client invoice');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Booking not found</p>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "warning" | "success"; className?: string }> = {
      draft: { variant: "warning" },
      confirmed: { variant: "success" },
      ongoing: { variant: "default" },
      completed: { variant: "success" },
      cancelled: { variant: "destructive" },
    };
    return variants[status] || { variant: "secondary" };
  };

  const getFinancialStatusBadge = (status: string) => {
    const variants: Record<string, { className: string }> = {
      profit: { className: "bg-success text-success-foreground" },
      breakeven: { className: "bg-warning text-warning-foreground" },
      loss: { className: "bg-destructive text-destructive-foreground" },
    };
    return variants[status] || { className: "" };
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 md:gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/bookings")} className="flex-shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h2 className="text-xl md:text-3xl font-bold tracking-tight truncate">{booking.reference_code}</h2>
            <p className="text-sm md:text-base text-muted-foreground truncate">{booking.client_name}</p>
          </div>
        </div>
        <Badge {...getStatusBadge(booking.status)} className="self-start sm:self-auto">
          {booking.status.replace('_', ' ')}
        </Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 md:px-6">
            <CardTitle className="text-xs md:text-sm font-medium">Total Revenue</CardTitle>
            <Euro className="h-3 md:h-4 w-3 md:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            <div className="text-lg md:text-2xl font-bold">€{Number(booking.amount_total).toLocaleString()}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground">
              Paid: €{Number(booking.amount_paid).toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 md:px-6">
            <CardTitle className="text-xs md:text-sm font-medium">Net Commission</CardTitle>
            <Receipt className="h-3 md:h-4 w-3 md:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            <div className="text-lg md:text-2xl font-bold">
              €{Number(financials?.commission_net || 0).toLocaleString()}
            </div>
            {financials?.financial_status && (
              <Badge variant="outline" {...getFinancialStatusBadge(financials.financial_status)} className="mt-1 text-[10px] md:text-xs">
                {financials.financial_status}
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 md:px-6">
            <CardTitle className="text-xs md:text-sm font-medium">Fines</CardTitle>
            <AlertCircle className="h-3 md:h-4 w-3 md:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            <div className="text-lg md:text-2xl font-bold">{fines?.length || 0}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground">
              Unpaid: {fines?.filter(f => f.payment_status === 'unpaid').length || 0}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 md:px-6">
            <CardTitle className="text-xs md:text-sm font-medium">Supplier Invoices</CardTitle>
            <FileText className="h-3 md:h-4 w-3 md:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            <div className="text-lg md:text-2xl font-bold">{supplierInvoices?.length || 0}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground">
              To pay: {supplierInvoices?.filter(i => i.payment_status === 'to_pay').length || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="inline-flex w-auto h-auto p-0.5 md:p-1">
            <TabsTrigger value="overview" className="text-[10px] md:text-sm whitespace-nowrap px-2 py-1 md:px-3 md:py-2">Overview</TabsTrigger>
            <TabsTrigger value="financials" className="text-[10px] md:text-sm whitespace-nowrap px-2 py-1 md:px-3 md:py-2">Financials</TabsTrigger>
            <TabsTrigger value="payments" className="text-[10px] md:text-sm whitespace-nowrap px-2 py-1 md:px-3 md:py-2">Payments ({payments?.length || 0})</TabsTrigger>
            <TabsTrigger value="invoices" className="text-[10px] md:text-sm whitespace-nowrap px-2 py-1 md:px-3 md:py-2">Invoices ({((supplierInvoices?.length || 0) + (clientInvoices?.length || 0))})</TabsTrigger>
            <TabsTrigger value="fines" className="text-[10px] md:text-sm whitespace-nowrap px-2 py-1 md:px-3 md:py-2">Fines ({fines?.length || 0})</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Booking Information Card */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Booking Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {booking.imported_from_email && (
                  <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 text-blue-700 font-medium text-sm mb-1">
                      <Mail className="w-4 h-4" />
                      Imported from Email
                    </div>
                    <div className="text-xs text-blue-600 space-y-1">
                      {booking.email_import_date && (
                        <p>First imported: {format(new Date(booking.email_import_date), 'PPp')}</p>
                      )}
                      {booking.last_email_update && (
                        <p>Last updated: {format(new Date(booking.last_email_update), 'PPp')}</p>
                      )}
                    </div>
                  </div>
                )}
                <div>
                  <span className="text-sm font-medium">Reference Code:</span>
                  <p className="text-sm text-muted-foreground">{booking.reference_code}</p>
                </div>
                {booking.booking_date && (
                  <div>
                    <span className="text-sm font-medium">Booking Date:</span>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(booking.booking_date), "PPP")}
                    </p>
                  </div>
                )}
                <div>
                  <span className="text-sm font-medium">Status:</span>
                  <p className="text-sm">
                    <Badge {...getStatusBadge(booking.status)} className="text-xs">
                      {booking.status.replace('_', ' ')}
                    </Badge>
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Client Information Card */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Client Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <span className="text-sm font-medium">Name:</span>
                  <p className="text-sm text-muted-foreground">{booking.client_name}</p>
                </div>
                {booking.company_name && (
                  <div>
                    <span className="text-sm font-medium">Company:</span>
                    <p className="text-sm text-muted-foreground">{booking.company_name}</p>
                  </div>
                )}
                {booking.client_email && (
                  <div>
                    <span className="text-sm font-medium">Email:</span>
                    <p className="text-sm text-muted-foreground">{booking.client_email}</p>
                  </div>
                )}
                {booking.client_phone && (
                  <div>
                    <span className="text-sm font-medium">Phone:</span>
                    <p className="text-sm text-muted-foreground">{booking.client_phone}</p>
                  </div>
                )}
                {booking.billing_address && (
                  <div>
                    <span className="text-sm font-medium">Billing Address:</span>
                    <p className="text-sm text-muted-foreground">{booking.billing_address}</p>
                  </div>
                )}
                {booking.country && (
                  <div>
                    <span className="text-sm font-medium">Country:</span>
                    <p className="text-sm text-muted-foreground">{booking.country}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Vehicle Information Card */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Car className="h-5 w-5" />
                  Vehicle Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <span className="text-sm font-medium">Model:</span>
                  <p className="text-sm text-muted-foreground">{booking.car_model}</p>
                </div>
                <div>
                  <span className="text-sm font-medium">Plate:</span>
                  <p className="text-sm text-muted-foreground">{booking.car_plate}</p>
                </div>
                {booking.supplier_name && (
                  <div>
                    <span className="text-sm font-medium">Supplier:</span>
                    <p className="text-sm text-muted-foreground">{booking.supplier_name}</p>
                  </div>
                )}
                {booking.km_included && (
                  <div>
                    <span className="text-sm font-medium">KM Included:</span>
                    <p className="text-sm text-muted-foreground">{booking.km_included} km</p>
                  </div>
                )}
                {booking.extra_km_cost && (
                  <div>
                    <span className="text-sm font-medium">Extra KM Cost:</span>
                    <p className="text-sm text-muted-foreground">€{Number(booking.extra_km_cost).toFixed(2)}/km</p>
                  </div>
                )}
                {booking.security_deposit_amount && Number(booking.security_deposit_amount) > 0 && (
                  <div>
                    <span className="text-sm font-medium">Security Deposit:</span>
                    <p className="text-sm text-muted-foreground">€{Number(booking.security_deposit_amount).toLocaleString()}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Additional Services Card */}
            {booking.additional_services && Object.keys(booking.additional_services as Record<string, any>).length > 0 && (
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Additional Services
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {typeof booking.additional_services === 'object' && !Array.isArray(booking.additional_services) && (
                    <>
                      {(booking.additional_services as any).infant_seat > 0 && (
                        <div>
                          <span className="text-sm font-medium">Infant Seat:</span>
                          <p className="text-sm text-muted-foreground">{(booking.additional_services as any).infant_seat}</p>
                        </div>
                      )}
                      {(booking.additional_services as any).booster_seat > 0 && (
                        <div>
                          <span className="text-sm font-medium">Booster Seat:</span>
                          <p className="text-sm text-muted-foreground">{(booking.additional_services as any).booster_seat}</p>
                        </div>
                      )}
                      {(booking.additional_services as any).child_seat > 0 && (
                        <div>
                          <span className="text-sm font-medium">Child Seat:</span>
                          <p className="text-sm text-muted-foreground">{(booking.additional_services as any).child_seat}</p>
                        </div>
                      )}
                      {(booking.additional_services as any).additional_driver_1 && (
                        <div>
                          <span className="text-sm font-medium">Additional Driver 1:</span>
                          <p className="text-sm text-muted-foreground">{(booking.additional_services as any).additional_driver_1}</p>
                        </div>
                      )}
                      {(booking.additional_services as any).additional_driver_2 && (
                        <div>
                          <span className="text-sm font-medium">Additional Driver 2:</span>
                          <p className="text-sm text-muted-foreground">{(booking.additional_services as any).additional_driver_2}</p>
                        </div>
                      )}
                      {(booking.additional_services as any).excess_reduction && (
                        <div>
                          <span className="text-sm font-medium">Excess Reduction:</span>
                          <p className="text-sm text-muted-foreground">Yes</p>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Delivery Card */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Delivery
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <span className="text-sm font-medium">Location:</span>
                  <p className="text-sm text-muted-foreground">{booking.delivery_location}</p>
                </div>
                <div>
                  <span className="text-sm font-medium">Date & Time:</span>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(booking.delivery_datetime), "PPP 'at' p")}
                  </p>
                </div>
                {booking.delivery_info && (
                  <div>
                    <span className="text-sm font-medium">Notes:</span>
                    <p className="text-sm text-muted-foreground">{booking.delivery_info}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Collection Card */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Collection
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <span className="text-sm font-medium">Location:</span>
                  <p className="text-sm text-muted-foreground">{booking.collection_location}</p>
                </div>
                <div>
                  <span className="text-sm font-medium">Date & Time:</span>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(booking.collection_datetime), "PPP 'at' p")}
                  </p>
                </div>
                {booking.collection_info && (
                  <div>
                    <span className="text-sm font-medium">Notes:</span>
                    <p className="text-sm text-muted-foreground">{booking.collection_info}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment Information Card */}
            {(booking.payment_method || booking.payment_amount_percent || booking.total_rental_amount) && (
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Payment Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {booking.payment_method && (
                    <div>
                      <span className="text-sm font-medium">Payment Method:</span>
                      <p className="text-sm text-muted-foreground">{booking.payment_method}</p>
                    </div>
                  )}
                  {booking.payment_amount_percent && (
                    <div>
                      <span className="text-sm font-medium">Payment Amount %:</span>
                      <p className="text-sm text-muted-foreground">{booking.payment_amount_percent}%</p>
                    </div>
                  )}
                  {booking.total_rental_amount && (
                    <div>
                      <span className="text-sm font-medium">Total Rental Amount:</span>
                      <p className="text-sm text-muted-foreground">€{Number(booking.total_rental_amount).toLocaleString()}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-sm font-medium">Rental Price (Gross):</span>
                    <p className="text-sm text-muted-foreground">€{Number(booking.rental_price_gross).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Supplier Price:</span>
                    <p className="text-sm text-muted-foreground">€{Number(booking.supplier_price).toLocaleString()}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Action Buttons - Discreet placement at bottom of Overview */}
          <div className="pt-4 border-t border-border flex gap-2">
            {booking.status === 'draft' && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => confirmBookingMutation.mutate(id!)}
                disabled={confirmBookingMutation.isPending}
                className="text-success border-success/30 hover:bg-success/10"
              >
                {confirmBookingMutation.isPending ? 'Confirming...' : 'Confirm Booking'}
              </Button>
            )}
            {booking.status !== 'cancelled' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                    Cancel Booking
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently cancel the booking and all related:
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>{clientInvoices?.length || 0} client invoice(s)</li>
                        <li>{supplierInvoices?.length || 0} supplier invoice(s)</li>
                        <li>{fines?.length || 0} fine(s)</li>
                      </ul>
                      <span className="mt-2 font-semibold block">This action cannot be undone.</span>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Booking</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => cancelBookingMutation.mutate(id!)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Cancel Booking
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </TabsContent>

        <TabsContent value="financials" className="space-y-4">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Financial Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="font-semibold">Revenue</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Rental Price (Gross):</span>
                      <span className="font-medium">€{Number(booking.rental_price_gross).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">VAT Rate:</span>
                      <span className="font-medium">{Number(booking.vat_rate)}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Rental Price (Net):</span>
                      <span className="font-medium">€{Number(financials?.rental_price_net || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold">Costs</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Supplier Price:</span>
                      <span className="font-medium">€{Number(booking.supplier_price).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Other Expenses:</span>
                      <span className="font-medium">€{Number(financials?.expenses_total || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <div>
                  <h4 className="font-semibold mb-3">Expected Profit</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Client Payment (Net):</span>
                      <span className="font-medium">€{Number(financials?.rental_price_net || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Supplier Cost:</span>
                      <span className="font-medium text-destructive">-€{Number(booking.supplier_price).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm pt-2 border-t">
                      <span className="font-semibold">Expected Profit:</span>
                      <span className="text-lg font-bold">€{(Number(financials?.rental_price_net || 0) - Number(booking.supplier_price)).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-3">Real Profit</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Client Invoice Total:</span>
                      <span className="font-medium">€{(clientInvoices?.reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Supplier Invoice Total:</span>
                      <span className="font-medium text-destructive">-€{(supplierInvoices?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Extra Deduction:</span>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={extraDeduction}
                          onChange={(e) => setExtraDeduction(Number(e.target.value))}
                          className="w-24 h-8 text-sm"
                          placeholder="0.00"
                        />
                        <span>€</span>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm pt-2 border-t">
                      <span className="font-semibold">Real Profit:</span>
                      <span className="text-lg font-bold">
                        €{((clientInvoices?.reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0) - 
                          (supplierInvoices?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0) - 
                          extraDeduction).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-lg font-semibold">Net Commission (Legacy):</span>
                  <div className="text-right">
                    <span className="text-xl font-bold text-muted-foreground">€{Number(financials?.commission_net || 0).toLocaleString()}</span>
                    {financials?.financial_status && (
                      <Badge variant="outline" {...getFinancialStatusBadge(financials.financial_status)} className="ml-2">
                        {financials.financial_status}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {expenses && expenses.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">Expense Details</h4>
                  <div className="space-y-2">
                    {expenses.map((expense) => (
                      <div key={expense.id} className="flex justify-between text-sm p-2 bg-muted/50 rounded">
                        <span className="capitalize">{expense.category.replace('_', ' ')}</span>
                        <div className="text-right">
                          <span className="font-medium">€{Number(expense.amount).toLocaleString()}</span>
                          {expense.note && (
                            <p className="text-xs text-muted-foreground">{expense.note}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {payments && payments.length > 0 ? (
                <div className="space-y-3">
                  {payments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="capitalize">
                            {payment.type}
                          </Badge>
                          <Badge variant="secondary" className="capitalize">
                            {payment.method}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(payment.paid_at), "PPP")}
                        </p>
                        {payment.note && (
                          <p className="text-xs text-muted-foreground">{payment.note}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold">€{Number(payment.amount).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                  <div className="border-t pt-3 mt-3">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">Total Paid:</span>
                      <span className="text-xl font-bold">€{Number(booking.amount_paid).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-sm text-muted-foreground">Remaining:</span>
                      <span className="text-sm font-medium">
                        €{(Number(booking.amount_total) - Number(booking.amount_paid)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No payments recorded</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fines" className="space-y-4">
          <Card className="shadow-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Fines
                </CardTitle>
                <SimpleFineUpload bookingId={id!} carPlate={booking.car_plate} />
              </div>
            </CardHeader>
            <CardContent>
              {fines && fines.length > 0 ? (
                <div className="space-y-4">
                  {fines.map((fine) => (
                    <div key={fine.id} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{fine.display_name || fine.fine_number || 'Fine Document'}</span>
                            <Badge
                              variant={fine.payment_status === "paid" ? "default" : "outline"}
                              className={fine.payment_status === "paid" ? "bg-success text-success-foreground" : "bg-warning/10 text-warning border-warning/20"}
                            >
                              {fine.payment_status}
                            </Badge>
                          </div>
                          {fine.issue_date && (
                            <p className="text-sm text-muted-foreground">
                              Uploaded: {format(new Date(fine.issue_date), "PPP")}
                            </p>
                          )}
                        </div>
                        {fine.amount && (
                          <div className="text-right">
                            <p className="text-lg font-semibold">€{Number(fine.amount).toLocaleString()}</p>
                          </div>
                        )}
                      </div>
                      
                      {fine.document_url && (
                        <FineDocumentPreview 
                          fineId={fine.id}
                          bookingId={id!}
                          documentUrl={fine.document_url}
                          displayName={fine.display_name || 'Fine Document'}
                        />
                      )}

                      <FinePaymentProof 
                        fineId={fine.id}
                        bookingId={id!}
                        currentProofUrl={fine.payment_proof_url || undefined}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No fines uploaded yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          <Card className="shadow-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Client Invoices
                </CardTitle>
                <AddClientInvoiceDialog
                  bookingId={id!}
                  defaultClientName={booking.client_name}
                  defaultBillingAddress={booking.billing_address || ""}
                  defaultSubtotal={Number(booking.rental_price_gross)}
                  defaultDescription={`Car Rental Service - ${booking.car_model}`}
                />
              </div>
            </CardHeader>
            <CardContent>
              {clientInvoices && clientInvoices.length > 0 ? (
                <div className="space-y-4">
                  {clientInvoices.map((invoice) => (
                    <div key={invoice.id} className="p-3 md:p-4 border rounded-lg space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm md:text-base truncate">{invoice.invoice_number}</span>
                            <Badge variant="default" className="bg-primary text-primary-foreground text-xs">
                              Client
                            </Badge>
                          </div>
                          <p className="text-xs md:text-sm text-muted-foreground">
                            {invoice.client_name} | Issued: {format(new Date(invoice.issue_date), "PPP")}
                          </p>
                        </div>
                        <div className="text-left sm:text-right flex-shrink-0">
                          <p className="text-base md:text-lg font-semibold">€{Number(invoice.total_amount).toLocaleString()}</p>
                          <p className="text-[10px] md:text-xs text-muted-foreground">
                            Subtotal: €{Number(invoice.subtotal).toLocaleString()} + VAT {Number(invoice.vat_rate)}%
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <EditClientInvoiceDialog invoice={invoice} />
                        <PDFDownloadLink
                          document={
                            <ClientInvoicePDF
                              invoice={invoice}
                              booking={{
                                reference_code: booking.reference_code,
                                car_model: booking.car_model,
                                car_plate: booking.car_plate,
                                delivery_datetime: booking.delivery_datetime,
                                collection_datetime: booking.collection_datetime,
                              }}
                              companySettings={appSettings ? {
                                logo_url: appSettings.logo_url,
                                company_name: appSettings.company_name,
                                company_address: appSettings.company_address,
                                company_email: appSettings.company_email,
                                company_phone: appSettings.company_phone,
                              } : undefined}
                            />
                          }
                          fileName={`${invoice.invoice_number}.pdf`}
                        >
                          {({ loading }) => (
                            <Button size="sm" variant="outline" disabled={loading} className="w-full sm:w-auto">
                              <Download className="h-3 w-3 sm:mr-2" />
                              <span className="hidden sm:inline">{loading ? 'Preparing...' : 'Download PDF'}</span>
                              <span className="sm:hidden">{loading ? 'Preparing...' : 'Download'}</span>
                            </Button>
                          )}
                        </PDFDownloadLink>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive" className="w-full sm:w-auto">
                              <Trash2 className="h-3 w-3 sm:mr-2" />
                              <span className="hidden sm:inline">Cancel</span>
                              <span className="sm:hidden">Cancel</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Do you really want to cancel this invoice? This action will mark the invoice as deleted.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>No, keep it</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteClientInvoiceMutation.mutate(invoice.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Yes, cancel invoice
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No client invoices created yet</p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Supplier Invoices
                </CardTitle>
                <SimpleInvoiceUpload bookingId={id!} carPlate={booking.car_plate} />
              </div>
            </CardHeader>
            <CardContent>
              {supplierInvoices && supplierInvoices.length > 0 ? (
                <div className="space-y-4">
                  {supplierInvoices.map((invoice) => (
                    <div key={invoice.id} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{invoice.supplier_name}</span>
                            <Badge
                              variant={invoice.payment_status === "paid" ? "default" : "outline"}
                              className={invoice.payment_status === "paid" ? "bg-success text-success-foreground" : "bg-warning/10 text-warning border-warning/20"}
                            >
                              {invoice.payment_status === "to_pay" ? "To Pay" : "Paid"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Issued: {format(new Date(invoice.issue_date), "PPP")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold">€{Number(invoice.amount).toLocaleString()}</p>
                        </div>
                      </div>

                      {invoice.invoice_url && (
                        <InvoiceDocumentPreview
                          invoiceId={invoice.id}
                          bookingId={id!}
                          documentUrl={invoice.invoice_url}
                          displayName={invoice.supplier_name}
                        />
                      )}

                      <InvoicePaymentProof
                        invoiceId={invoice.id}
                        bookingId={id!}
                        currentProofUrl={invoice.payment_proof_url || undefined}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No supplier invoices linked to this booking</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
