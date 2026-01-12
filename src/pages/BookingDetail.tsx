import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Euro, Car, User, Calendar, MapPin, AlertCircle, FileText, CreditCard, Receipt, Mail, Link2, Plus, Loader2, CheckCircle, Eye, Building2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { calculateRentalDays } from "@/lib/utils";
import { SimpleFineUpload } from "@/components/SimpleFineUpload";
import { SimpleInvoiceUpload } from "@/components/SimpleInvoiceUpload";
import { RecordSupplierPaymentDialog } from "@/components/RecordSupplierPaymentDialog";
import { Progress } from "@/components/ui/progress";
import { BookingDocuments } from "@/components/BookingDocuments";
import { ChatThread } from "@/components/chat/ChatThread";
import { BookingFormStatus } from "@/components/BookingFormStatus";
import { RentalManagement } from "@/components/rental/RentalManagement";
import { SignatureViewerDialog } from "@/components/SignatureViewerDialog";
import { SendBookingFormDialog } from "@/components/SendBookingFormDialog";
import { FineDocumentPreview } from "@/components/FineDocumentPreview";
import { FinePaymentProof } from "@/components/FinePaymentProof";
import { InvoiceDocumentPreview } from "@/components/InvoiceDocumentPreview";
import { InvoicePaymentProof } from "@/components/InvoicePaymentProof";
import { AddClientInvoiceDialog } from "@/components/AddClientInvoiceDialog";
import { EditClientInvoiceDialog } from "@/components/EditClientInvoiceDialog";
import { EditBookingDialog } from "@/components/EditBookingDialog";
import { ClientInvoicePDF } from "@/components/ClientInvoicePDF";
import { AdminBookingPDF } from "@/components/AdminBookingPDF";
import { SupplierBookingPDF } from "@/components/SupplierBookingPDF";
import { ClientBookingPDF } from "@/components/ClientBookingPDF";
import { PDFDownloadLink } from '@react-pdf/renderer';
import { useState, useEffect } from "react";
import { GeneratePaymentLinkDialog } from "@/components/GeneratePaymentLinkDialog";
import { RecordManualPaymentDialog } from "@/components/RecordManualPaymentDialog";
import { PaymentLinkCard } from "@/components/PaymentLinkCard";
import { SecurityDepositCard } from "@/components/SecurityDepositCard";
import { Input } from "@/components/ui/input";
import { Download, Trash2, Pencil } from "lucide-react";
import { useUserViewScope } from "@/hooks/useUserViewScope";
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
  const [isEditingDeduction, setIsEditingDeduction] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [generatePaymentLinkOpen, setGeneratePaymentLinkOpen] = useState(false);
  const [recordManualPaymentOpen, setRecordManualPaymentOpen] = useState(false);
  const [sendBookingFormOpen, setSendBookingFormOpen] = useState(false);
  const [signatureViewerOpen, setSignatureViewerOpen] = useState(false);
  const [manualPaymentNotes, setManualPaymentNotes] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();
  const { isRestrictedStaff, isReadOnly } = useUserViewScope();

  console.log("BookingDetail render - ID:", id);


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

  const { data: booking, isLoading, error: bookingError } = useQuery({
    queryKey: ["booking", id],
    refetchOnMount: 'always',
    queryFn: async () => {
      console.log("Fetching booking with ID:", id);
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error fetching booking:", error);
        throw error;
      }
      
      // Fetch creator profile if created_by exists
      if (data.created_by) {
        const { data: creatorProfile } = await supabase
          .from("profiles")
          .select("id, email, display_name")
          .eq("id", data.created_by)
          .maybeSingle();
        
        console.log("Booking fetched successfully:", data?.reference_code);
        return { ...data, creator: creatorProfile };
      }
      
      console.log("Booking fetched successfully:", data?.reference_code);
      return data;
    },
  });

  // Log any booking fetch errors
  if (bookingError) {
    console.error("Booking query error:", bookingError);
  }

  // Initialize extra deduction from database
  useEffect(() => {
    if (booking?.extra_deduction !== undefined) {
      setExtraDeduction(Number(booking.extra_deduction) || 0);
    }
  }, [booking?.extra_deduction]);

  const { data: financials } = useQuery({
    queryKey: ["booking-financials", id],
    refetchOnMount: 'always',
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
    refetchOnMount: 'always',
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

  const { data: fines, isLoading: finesLoading } = useQuery({
    queryKey: ["booking-fines", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fines")
        .select(`
          *,
          payments:payments!payments_fine_id_fkey(id, amount, paid_at, note, payment_method_type)
        `)
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

  const { data: securityDepositAuth } = useQuery({
    queryKey: ["security-deposit-auth", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_deposit_authorizations")
        .select("*")
        .eq("booking_id", id)
        .in("status", ["captured", "released"])
        .order("captured_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const { data: accessToken } = useQuery({
    queryKey: ["booking-access-token", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_access_tokens")
        .select("token")
        .eq("booking_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data?.token;
    },
  });

  // Calculate actual amount paid from payments (excluding security deposits)
  // This is the source of truth - always accurate regardless of DB state
  // Non-rental payment intents that should NOT count toward payment progress
  const NON_RENTAL_INTENTS = ['security_deposit', 'extras', 'fines', 'other'];

  const calculateActualAmountPaid = () => {
    // For imported bookings, use booking.amount_paid from the database
    // (populated from email's payment percentage)
    if (booking?.imported_from_email) {
      return Number(booking.amount_paid || 0);
    }
    
    // For normal bookings, calculate from payments table (only rental payments)
    if (!payments) return 0;
    
    return payments
      .filter(p => 
        p.payment_link_status === 'paid' && 
        p.paid_at !== null && 
        !NON_RENTAL_INTENTS.includes(p.payment_intent || '')
      )
      .reduce((sum, p) => sum + Number(p.amount), 0);
  };

  const actualAmountPaid = calculateActualAmountPaid();

  const confirmBookingMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { data, error } = await supabase
        .from('bookings')
        .update({ status: 'confirmed' })
        .eq('id', bookingId)
        .select();

      if (error) throw error;
      
      // Check if any rows were actually updated (RLS may silently block)
      if (!data || data.length === 0) {
        throw new Error('No permission to update this booking. Please check you are logged in with staff/admin access.');
      }
      
      return data;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking-financials', id] });
      queryClient.invalidateQueries({ queryKey: ['client-invoices', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Booking confirmed successfully');
      
      // Send confirmation email
      console.log('Triggering confirmation email for booking:', id);
      try {
        const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-booking-confirmation-email', {
          body: { booking_id: id }
        });
        
        console.log('Email function response:', emailResult, emailError);
        
        if (emailError) {
          console.error('Email function error:', emailError);
          toast.error('Failed to send confirmation email');
        } else if (emailResult?.email_sent) {
          toast.success('Confirmation email sent to client');
        } else if (emailResult?.already_sent) {
          toast.info('Confirmation email was already sent');
        } else if (emailResult?.message) {
          console.log('Email result:', emailResult.message);
        }
      } catch (error) {
        console.error('Failed to send confirmation email:', error);
        toast.error('Failed to send confirmation email');
      }
    },
    onError: (error) => {
      console.error('Confirm booking error:', error);
      toast.error(`Failed to confirm booking: ${error.message}`);
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
      toast.success('Client proforma invoice cancelled successfully');
    },
    onError: (error) => {
      console.error('Delete client invoice error:', error);
      toast.error('Failed to cancel client proforma invoice');
    },
  });

  const updateExtraDeductionMutation = useMutation({
    mutationFn: async (amount: number) => {
      const { error } = await supabase
        .from('bookings')
        .update({ extra_deduction: amount })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      queryClient.invalidateQueries({ queryKey: ['booking-financials', id] });
      toast.success('Extra deduction updated');
      setIsEditingDeduction(false);
    },
    onError: (error) => {
      console.error('Update extra deduction error:', error);
      toast.error('Failed to update extra deduction');
    },
  });

  const confirmBankTransferMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const { data, error } = await supabase.functions.invoke(
        'confirm-bank-transfer-payment',
        {
          body: { payment_id: paymentId }
        }
      );
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Payment confirmed! Booking updated.");
      queryClient.invalidateQueries({ queryKey: ["booking", id] });
      queryClient.invalidateQueries({ queryKey: ["booking-payments", id] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to confirm payment: ${error.message}`);
    },
  });


  const confirmManualPaymentMutation = useMutation({
    mutationFn: async ({ payment_id, note }: { payment_id: string; note: string }) => {
      // Get current payment to check if it's a recorded manual payment
      const { data: currentPayment } = await supabase
        .from('payments')
        .select('postfinance_transaction_id, payment_link_id')
        .eq('id', payment_id)
        .single();
      
      // For recorded manual payments, keep existing transaction ID
      // For legacy manual payments, generate a new one
      const isRecordedManual = currentPayment?.payment_link_id?.startsWith('manual_');
      const transactionId = isRecordedManual && currentPayment?.postfinance_transaction_id
        ? currentPayment.postfinance_transaction_id
        : `MANUAL_${new Date().toISOString().split('T')[0]}`;
      
      const updateData: Record<string, any> = {
        payment_link_status: 'paid',
        paid_at: new Date().toISOString(),
        postfinance_transaction_id: transactionId,
      };
      
      // Only update note if provided (for legacy manual payments)
      if (note && !isRecordedManual) {
        updateData.note = note;
      }
      
      const { error } = await supabase
        .from('payments')
        .update(updateData as any)
        .eq('id', payment_id);
      
      if (error) throw error;
    },
    onSuccess: async (_, variables) => {
      toast.success('Payment confirmed successfully');
      
      // Get the payment details to check if it's a fine payment
      const { data: confirmedPayment } = await supabase
        .from('payments')
        .select('payment_intent, fine_id')
        .eq('id', variables.payment_id)
        .single();
      
      // If this is a fine payment with a linked fine, mark the fine as paid
      if (confirmedPayment?.payment_intent === 'fines' && confirmedPayment?.fine_id) {
        const { error: fineError } = await supabase
          .from('fines')
          .update({ payment_status: 'paid' })
          .eq('id', confirmedPayment.fine_id);
        
        if (fineError) {
          console.error('Failed to update fine status:', fineError);
        } else {
          queryClient.invalidateQueries({ queryKey: ['fines'] });
        }
      }
      
      // Only trigger balance and deposit link generation for rental payments
      // NOT for extras, fines, or other manual payments (speeds up confirmation)
      const rentalPaymentIntents = ['down_payment', 'balance_payment', 'full_payment', 'client_payment'];
      if (rentalPaymentIntents.includes(confirmedPayment?.payment_intent || '')) {
        try {
          await supabase.functions.invoke('generate-balance-and-deposit-links', {
            body: { booking_id: id }
          });
          console.log('Balance and deposit links generated');
        } catch (err) {
          console.error('Failed to generate balance/deposit links:', err);
          // Don't show error to user - this is a background task
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      queryClient.invalidateQueries({ queryKey: ['booking-payments', id] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setManualPaymentNotes({});
    },
    onError: (error: Error) => {
      toast.error(`Failed to confirm payment: ${error.message}`);
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
      confirmed: { variant: "success", className: "bg-success text-success-foreground" },
      ongoing: { variant: "default" },
      completed: { variant: "success" },
      cancelled: { variant: "destructive" },
    };
    const statusVariant = variants[status] || { variant: "secondary" as const };
    return <Badge variant={statusVariant.variant} className={statusVariant.className}>{status}</Badge>;
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
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl md:text-3xl font-bold tracking-tight break-words">{booking.reference_code}</h2>
              {booking.booking_type === 'agency' && (
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                  <Building2 className="w-3 h-3 mr-1" />
                  Agency
                </Badge>
              )}
            </div>
            <p className="text-sm md:text-base text-muted-foreground break-words">
              {booking.booking_type === 'agency' && booking.agency_name && (
                <span className="font-medium text-purple-700">{booking.agency_name} → </span>
              )}
              {booking.client_name}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          {!isReadOnly && booking.status === 'draft' && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => confirmBookingMutation.mutate(id!)}
              disabled={confirmBookingMutation.isPending}
              className="text-success border-success/30 hover:bg-success/10 min-h-[44px]"
            >
              {confirmBookingMutation.isPending ? 'Confirming...' : 'Confirm Booking'}
            </Button>
          )}
          {!isReadOnly && (
            <Button onClick={() => setEditDialogOpen(true)} size="sm" className="gap-2 min-h-[44px]">
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          )}
          {!isReadOnly && booking.status !== 'cancelled' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10 min-h-[44px]">
                  Cancel
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently cancel the booking and all related:
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>{clientInvoices?.length || 0} client proforma invoice(s)</li>
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
          {getStatusBadge(booking.status)}
          {booking.status === 'confirmed' && payments?.some((p: any) => 
            p.payment_link_status === 'pending' && p.payment_intent !== 'security_deposit'
          ) && (
            <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-200">
              Pending Payment
            </Badge>
          )}
        </div>
      </div>

      {/* PDF Download Buttons - Hide Admin/Supplier PDF for restricted staff */}
      <div className="flex flex-wrap gap-1">
        {!isRestrictedStaff && (
          <>
            <PDFDownloadLink 
              document={<AdminBookingPDF booking={booking} appSettings={appSettings || undefined} creatorProfile={(booking as any).creator || undefined} />}
              fileName={`admin-booking-${booking.reference_code}.pdf`}
            >
              {({ loading }) => (
                <Button variant="outline" size="sm" disabled={loading} className="min-h-[44px]">
                  <Download className="h-4 w-4 mr-2 hidden sm:inline" />
                  {loading ? 'Preparing...' : 'Admin PDF'}
                </Button>
              )}
            </PDFDownloadLink>
            
            <PDFDownloadLink 
              document={<SupplierBookingPDF booking={booking} appSettings={appSettings || undefined} />}
              fileName={`supplier-booking-${booking.reference_code}.pdf`}
            >
              {({ loading }) => (
                <Button variant="outline" size="sm" disabled={loading} className="min-h-[44px]">
                  <Download className="h-4 w-4 mr-2 hidden sm:inline" />
                  {loading ? 'Preparing...' : 'Supplier PDF'}
                </Button>
              )}
            </PDFDownloadLink>
          </>
        )}
        
        <PDFDownloadLink 
          document={<ClientBookingPDF booking={booking} appSettings={appSettings || undefined} creatorProfile={(booking as any).creator || undefined} />}
          fileName={`client-booking-${booking.reference_code}.pdf`}
        >
          {({ loading }) => (
            <Button variant="outline" size="sm" disabled={loading} className="min-h-[44px]">
              <Download className="h-4 w-4 mr-2 hidden sm:inline" />
              {loading ? 'Preparing...' : 'Client PDF'}
            </Button>
          )}
        </PDFDownloadLink>
      </div>

      {/* Summary Cards - Hide commission and supplier invoice cards for restricted staff */}
      <div className={`grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 ${isRestrictedStaff ? 'lg:grid-cols-2' : 'lg:grid-cols-4'}`}>
      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 md:px-6">
          <CardTitle className="text-xs md:text-sm font-medium">Total Revenue</CardTitle>
          <Euro className="h-3 md:h-4 w-3 md:w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="px-4 md:px-6">
          <div className="text-lg md:text-2xl font-bold">
            €{(booking.imported_from_email 
              ? (clientInvoices?.reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0)
              : Number(booking.amount_total)
            ).toLocaleString()}
          </div>
          <p className="text-[10px] md:text-xs text-muted-foreground">
            Paid: €{Number(actualAmountPaid).toLocaleString()}
          </p>
          <p className="text-[9px] text-muted-foreground italic mt-0.5">
            * Security deposits excluded
          </p>
        </CardContent>
      </Card>

        {/* Net Commission card - hidden for restricted staff */}
        {!isRestrictedStaff && (
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 md:px-6">
              <CardTitle className="text-xs md:text-sm font-medium">Net Commission</CardTitle>
              <Receipt className="h-3 md:h-4 w-3 md:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-4 md:px-6">
              <div className="text-lg md:text-2xl font-bold">
                €{(
                  (clientInvoices?.reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0) - 
                  (supplierInvoices?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0) - 
                  Number(booking.extra_deduction || 0)
                ).toLocaleString()}
              </div>
              {financials?.financial_status && (
                <Badge variant="outline" {...getFinancialStatusBadge(financials.financial_status)} className="mt-1 text-[10px] md:text-xs">
                  {financials.financial_status}
                </Badge>
              )}
            </CardContent>
          </Card>
        )}

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

        {/* Supplier Invoices card - hidden for restricted staff */}
        {!isRestrictedStaff && (
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
        )}
      </div>

      {/* Tabbed Content - Hide Financials tab for restricted staff */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide scroll-smooth snap-x">
          <TabsList className="inline-flex w-auto h-auto p-0.5 md:p-1 gap-0.5 md:gap-1">
            <TabsTrigger value="overview" className="text-xs md:text-sm whitespace-nowrap px-3 py-2.5 md:px-3 md:py-1.5 snap-start min-w-[80px] md:min-w-0">Overview</TabsTrigger>
            {!isRestrictedStaff && (
              <TabsTrigger value="financials" className="text-xs md:text-sm whitespace-nowrap px-3 py-2.5 md:px-3 md:py-1.5 snap-start min-w-[90px] md:min-w-0">Financials</TabsTrigger>
            )}
            {!booking.imported_from_email && (
              <TabsTrigger value="payments" className="text-xs md:text-sm whitespace-nowrap px-3 py-2.5 md:px-3 md:py-1.5 snap-start min-w-[100px] md:min-w-0">Payments ({payments?.length || 0})</TabsTrigger>
            )}
            <TabsTrigger value="invoices" className="text-xs md:text-sm whitespace-nowrap px-3 py-2.5 md:px-3 md:py-1.5 snap-start min-w-[100px] md:min-w-0">
              {isRestrictedStaff ? `Invoices (${clientInvoices?.length || 0})` : `Invoices (${((supplierInvoices?.length || 0) + (clientInvoices?.length || 0))})`}
            </TabsTrigger>
            <TabsTrigger value="fines" className="text-xs md:text-sm whitespace-nowrap px-3 py-2.5 md:px-3 md:py-1.5 snap-start min-w-[90px] md:min-w-0">Fines ({fines?.length || 0})</TabsTrigger>
            <TabsTrigger value="documents" className="text-xs md:text-sm whitespace-nowrap px-3 py-2.5 md:px-3 md:py-1.5 snap-start min-w-[100px] md:min-w-0">Documents</TabsTrigger>
            <TabsTrigger value="rental" className="text-xs md:text-sm whitespace-nowrap px-3 py-2.5 md:px-3 md:py-1.5 snap-start min-w-[90px] md:min-w-0">
              <Car className="h-4 w-4 mr-1" />
              Rental
            </TabsTrigger>
            <TabsTrigger value="chat" className="text-xs md:text-sm whitespace-nowrap px-3 py-2.5 md:px-3 md:py-1.5 snap-start min-w-[70px] md:min-w-0">Chat</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4">
          {/* Booking Form Status - Only for Direct Bookings */}
          {booking.booking_type !== 'agency' && (
            <BookingFormStatus booking={booking} />
          )}
          
          {/* Agency Booking Notice */}
          {booking.booking_type === 'agency' && (
            <Card className="shadow-card border-purple-200 bg-purple-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-purple-700">
                  <Building2 className="h-5 w-5" />
                  Agency Booking
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-purple-600">
                  This is an agency booking. Client portal and booking form features are not available.
                  Payment is typically handled via bank transfer with invoice.
                </p>
              </CardContent>
            </Card>
          )}
          
          {/* Action Buttons for Form - Only for Direct Bookings */}
          {booking.booking_type !== 'agency' && (
          <div className="flex flex-wrap gap-2">
            {!isReadOnly && !booking.tc_accepted_at && !booking.imported_from_email && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setSendBookingFormOpen(true)}
                className="gap-2 min-h-[44px]"
              >
                <Mail className="h-4 w-4" />
                {booking.booking_form_sent_at ? 'Resend' : 'Send'} Booking Form
              </Button>
            )}
            
            {booking.tc_signature_data && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setSignatureViewerOpen(true)}
                className="gap-2 min-h-[44px]"
              >
                <FileText className="h-4 w-4" />
                View Signature & T&C
              </Button>
            )}
            
            {accessToken && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => window.open(`/client-portal/${accessToken}`, '_blank')}
                className="gap-2 min-h-[44px]"
              >
                <Link2 className="h-4 w-4" />
                View Client Portal
              </Button>
            )}
          </div>
          )}
          
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
                  <div className="flex flex-wrap gap-2 mt-1">
                    {getStatusBadge(booking.status)}
                    {booking.status === 'confirmed' && payments?.some((p: any) => 
                      p.payment_link_status === 'pending' && p.payment_intent !== 'security_deposit'
                    ) && (
                      <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-200">
                        Pending Payment
                      </Badge>
                    )}
                  </div>
                </div>
                {booking.supplier_name && (
                  <div>
                    <span className="text-sm font-medium">Supplier:</span>
                    <p className="text-sm text-muted-foreground">{booking.supplier_name}</p>
                  </div>
                )}
                {/* Show PostFinance Transaction IDs grouped by payment intent */}
                {payments?.some((p: any) => p.postfinance_transaction_id) && (
                  <div>
                    <span className="text-sm font-medium">PostFinance Transactions:</span>
                    <div className="space-y-1 mt-1">
                      {/* Down Payment */}
                      {payments.filter((p: any) => p.payment_intent === 'down_payment' && p.postfinance_transaction_id).length > 0 && (
                        <div>
                          <span className="text-xs text-muted-foreground">Down Payment: </span>
                          <span className="text-sm font-mono">
                            {payments
                              .filter((p: any) => p.payment_intent === 'down_payment' && p.postfinance_transaction_id)
                              .map((p: any) => `${p.postfinance_transaction_id} (${p.payment_method_type === 'visa_mastercard' ? 'Visa/MC' : p.payment_method_type === 'amex' ? 'Amex' : p.payment_method_type || 'Unknown'})`)
                              .join(', ')}
                          </span>
                        </div>
                      )}
                      {/* Balance Payment */}
                      {payments.filter((p: any) => p.payment_intent === 'balance_payment' && p.postfinance_transaction_id).length > 0 && (
                        <div>
                          <span className="text-xs text-muted-foreground">Balance: </span>
                          <span className="text-sm font-mono">
                            {payments
                              .filter((p: any) => p.payment_intent === 'balance_payment' && p.postfinance_transaction_id)
                              .map((p: any) => `${p.postfinance_transaction_id} (${p.payment_method_type === 'visa_mastercard' ? 'Visa/MC' : p.payment_method_type === 'amex' ? 'Amex' : p.payment_method_type || 'Unknown'})`)
                              .join(', ')}
                          </span>
                        </div>
                      )}
                      {/* Security Deposit */}
                      {payments.filter((p: any) => p.payment_intent === 'security_deposit' && p.postfinance_transaction_id).length > 0 && (
                        <div>
                          <span className="text-xs text-muted-foreground">Security Deposit: </span>
                          <span className="text-sm font-mono">
                            {payments
                              .filter((p: any) => p.payment_intent === 'security_deposit' && p.postfinance_transaction_id)
                              .map((p: any) => `${p.postfinance_transaction_id} (${p.payment_method_type === 'visa_mastercard' ? 'Visa/MC' : p.payment_method_type === 'amex' ? 'Amex' : p.payment_method_type || 'Unknown'})`)
                              .join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Agency Information Card - Only for Agency Bookings */}
            {booking.booking_type === 'agency' && (
              <Card className="shadow-card border-purple-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-purple-700">
                    <Building2 className="h-5 w-5" />
                    Agency Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <span className="text-sm font-medium">Agency Name:</span>
                    <p className="text-sm text-muted-foreground">{booking.agency_name || '-'}</p>
                  </div>
                  {booking.agency_email && (
                    <div>
                      <span className="text-sm font-medium">Email:</span>
                      <p className="text-sm text-muted-foreground">{booking.agency_email}</p>
                    </div>
                  )}
                  {booking.agency_phone && (
                    <div>
                      <span className="text-sm font-medium">Phone:</span>
                      <p className="text-sm text-muted-foreground">{booking.agency_phone}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Client/Guest Information Card */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {booking.booking_type === 'agency' ? 'Guest Information' : 'Client Information'}
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

            {/* Guest Information Card */}
            {booking.guest_name && (
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Guest Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <span className="text-sm font-medium">Name:</span>
                    <p className="text-sm text-muted-foreground">{booking.guest_name}</p>
                  </div>
                  {booking.guest_phone && (
                    <div>
                      <span className="text-sm font-medium">Phone:</span>
                      <p className="text-sm text-muted-foreground">{booking.guest_phone}</p>
                    </div>
                  )}
                  {booking.guest_company_name && (
                    <div>
                      <span className="text-sm font-medium">Company:</span>
                      <p className="text-sm text-muted-foreground">{booking.guest_company_name}</p>
                    </div>
                  )}
                  {booking.guest_billing_address && (
                    <div>
                      <span className="text-sm font-medium">Billing Address:</span>
                      <p className="text-sm text-muted-foreground">{booking.guest_billing_address}</p>
                    </div>
                  )}
                  {booking.guest_country && (
                    <div>
                      <span className="text-sm font-medium">Country:</span>
                      <p className="text-sm text-muted-foreground">{booking.guest_country}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

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
                    <span className="text-sm font-medium">Delivery Notes:</span>
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
                <div>
                  <span className="text-sm font-medium">Rental Duration:</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300">
                      {(() => {
                        const calc = calculateRentalDays(
                          new Date(booking.delivery_datetime),
                          new Date(booking.collection_datetime),
                          booking.rental_day_hour_tolerance || 1
                        );
                        return calc.formattedTotal;
                      })()}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      ({(() => {
                        const calc = calculateRentalDays(
                          new Date(booking.delivery_datetime),
                          new Date(booking.collection_datetime),
                          booking.rental_day_hour_tolerance || 1
                        );
                        return calc.formattedDuration;
                      })()})
                    </span>
                  </div>
                </div>
                {booking.collection_info && (
                  <div>
                    <span className="text-sm font-medium">Collection Notes:</span>
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
                  {booking.payment_amount_percent && booking.total_rental_amount && (
                    <div>
                      <span className="text-sm font-medium">First Payment Amount:</span>
                      <p className="text-sm text-muted-foreground">
                        {booking.currency === 'CHF' ? 'CHF ' : '€'}
                        {((Number(booking.total_rental_amount) * Number(booking.payment_amount_percent)) / 100).toLocaleString()} ({booking.payment_amount_percent}%)
                      </p>
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
                  {/* Hide supplier price, commission for restricted staff */}
                  {!isRestrictedStaff && (
                    <>
                      <div>
                        <span className="text-sm font-medium">Supplier Price:</span>
                        <p className="text-sm text-muted-foreground">€{Number(booking.supplier_price).toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium">Base Commission:</span>
                        <p className="text-sm text-muted-foreground">
                          €{Number(financials?.commission_net || 0).toLocaleString()}
                        </p>
                      </div>
                      {(() => {
                        const clientTotal = clientInvoices?.reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;
                        const rentalSupplierTotal = supplierInvoices?.filter(inv => inv.invoice_type !== 'security_deposit_extra').reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;
                        const capturedAmount = securityDepositAuth?.captured_amount || 0;
                        const extraSupplierCost = supplierInvoices?.filter(inv => inv.invoice_type === 'security_deposit_extra').reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;
                        const securityDepositMargin = capturedAmount - extraSupplierCost;
                        const netCommission = clientTotal - rentalSupplierTotal - Number(booking.extra_deduction || 0) + securityDepositMargin;
                        
                        return (
                          <>
                            <div>
                              <span className="text-sm font-medium">Net Commission:</span>
                              <p className="text-sm text-muted-foreground">
                                €{netCommission.toLocaleString()}
                              </p>
                            </div>
                            {capturedAmount > 0 && (
                              <div>
                                <span className="text-sm font-medium">Includes Deposit Margin:</span>
                                <p className={`text-sm ${securityDepositMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {securityDepositMargin >= 0 ? '+' : ''}€{securityDepositMargin.toLocaleString()}
                                </p>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Action Buttons - Discreet placement at bottom of Overview */}
        </TabsContent>

        <TabsContent value="financials" className="space-y-4 pb-24">
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
                  <h4 className="font-semibold mb-3">Gross Commission</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Client Payment (Gross):</span>
                      <span className="font-medium">€{Number(booking.rental_price_gross).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Supplier Cost:</span>
                      <span className="font-medium text-destructive">-€{Number(booking.supplier_price).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm pt-2 border-t">
                      <span className="font-semibold">Gross Commission:</span>
                      <span className="text-lg font-bold">€{(Number(booking.rental_price_gross) - Number(booking.supplier_price)).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t">
                  <div>
                    <span className="text-lg font-semibold">Base Commission:</span>
                    <p className="text-xs text-muted-foreground mt-1">After VAT & expenses, before extra deductions</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-bold text-muted-foreground">€{Number(financials?.commission_net || 0).toLocaleString()}</span>
                    {financials?.financial_status && (
                      <Badge variant="outline" {...getFinancialStatusBadge(financials.financial_status)} className="ml-2">
                        {financials.financial_status}
                      </Badge>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-3">Net Commission</h4>
                  <p className="text-xs text-muted-foreground mb-3">Actual profit after all costs & deductions</p>
                  {(() => {
                    const clientTotal = clientInvoices?.reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;
                    const rentalSupplierTotal = supplierInvoices?.filter(inv => inv.invoice_type !== 'security_deposit_extra').reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;
                    const capturedAmount = securityDepositAuth?.captured_amount || 0;
                    const extraSupplierCost = supplierInvoices?.filter(inv => inv.invoice_type === 'security_deposit_extra').reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;
                    const securityDepositMargin = capturedAmount - extraSupplierCost;
                    const netCommission = clientTotal - rentalSupplierTotal - extraDeduction + securityDepositMargin;

                    return (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Client Proforma Total:</span>
                          <span className="font-medium">€{clientTotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Supplier Invoice Total (Rental):</span>
                          <span className="font-medium text-destructive">-€{rentalSupplierTotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm items-center">
                          <span className="text-muted-foreground">Extra Deduction:</span>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={extraDeduction || ''}
                              onChange={(e) => {
                                const value = e.target.value === '' ? 0 : Number(e.target.value);
                                setExtraDeduction(value);
                                setIsEditingDeduction(true);
                              }}
                              className="w-24 h-8 text-sm"
                              placeholder="0.00"
                              disabled={isReadOnly}
                            />
                            <span>€</span>
                            {isEditingDeduction && !isReadOnly && (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => updateExtraDeductionMutation.mutate(extraDeduction)}
                                  disabled={updateExtraDeductionMutation.isPending}
                                >
                                  Save
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => {
                                    updateExtraDeductionMutation.mutate(0);
                                    setExtraDeduction(0);
                                  }}
                                  disabled={updateExtraDeductionMutation.isPending}
                                >
                                  Clear
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                        {(capturedAmount > 0 || extraSupplierCost > 0) && (
                          <div className={`flex justify-between text-sm ${securityDepositMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            <span className="text-muted-foreground">Security Deposit Margin:</span>
                            <span className="font-medium">
                              {securityDepositMargin >= 0 ? '+' : ''}€{securityDepositMargin.toLocaleString()}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm pt-2 border-t-2 border-primary">
                          <span className="font-bold text-lg">Net Commission:</span>
                          <span className="text-2xl font-bold text-primary">
                            €{netCommission.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
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
          {booking.imported_from_email ? (
            <Card className="shadow-card">
              <CardContent className="py-8">
                <div className="text-center space-y-2">
                  <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
                  <h3 className="font-semibold">Payment Tracking Not Available</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Payment tracking is not available for bookings imported from email. 
                    These bookings are already confirmed and paid externally.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Payment Status Overview */}
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Payment Progress
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-xl font-bold">€{Number(booking.amount_total).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Amount Paid</p>
                  <p className="text-xl font-bold text-green-600">€{Number(actualAmountPaid).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">* Excl. security deposits</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Remaining</p>
                  <p className="text-xl font-bold">
                    €{(Number(booking.amount_total) - Number(actualAmountPaid)).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Security Deposit - Separate display for authorizations */}
              {payments?.find(p => p.payment_intent === 'security_deposit' && (p.paid_at || p.payment_link_status === 'paid')) && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Security Deposit Authorized</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400">This is an authorization, not a charge</p>
                    </div>
                    <p className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                      €{Number(payments.find(p => p.payment_intent === 'security_deposit')?.amount || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{
                      width: `${Math.min((Number(actualAmountPaid) / Number(booking.amount_total)) * 100, 100)}%`,
                    }}
                  />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  {((Number(actualAmountPaid) / Number(booking.amount_total)) * 100).toFixed(1)}% paid
                </p>
              </div>

              {/* Down Payment Status */}
              {booking.payment_amount_percent && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm">
                    Down Payment Required: €
                    {((Number(booking.amount_total) * Number(booking.payment_amount_percent)) / 100).toFixed(2)} (
                    {booking.payment_amount_percent}%)
                  </span>
                  {Number(booking.amount_paid) >=
                  (Number(booking.amount_total) * Number(booking.payment_amount_percent)) / 100 ? (
                    <Badge className="bg-green-600">✓ Met</Badge>
                  ) : (
                    <Badge variant="destructive">Pending</Badge>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span className="font-medium">Booking Status:</span>
                {getStatusBadge(booking.status)}
              </div>
            </CardContent>
          </Card>

          {/* Pending Payment Links */}
          <Card className="shadow-card">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5" />
                  Pending Payment Requests
                  {payments?.filter((p) => p.payment_link_status && !['paid', 'cancelled'].includes(p.payment_link_status))
                    .length > 0 && (
                    <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-200">
                      {payments.filter((p) => p.payment_link_status && !['paid', 'cancelled'].includes(p.payment_link_status)).length}
                    </Badge>
                  )}
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  {/* Generate Payment Link button hidden - functionality preserved for future use */}
                  {false && (
                    <Button
                      onClick={() => setGeneratePaymentLinkOpen(true)}
                      size="sm"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Generate Payment Link
                    </Button>
                  )}
                  {!isReadOnly && (
                    <Button
                      onClick={() => setRecordManualPaymentOpen(true)}
                      size="sm"
                      variant="outline"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Record Manual Payment
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {payments?.filter((p) => p.payment_link_status && !['paid', 'cancelled'].includes(p.payment_link_status))
                .length > 0 ? (
                <div className="space-y-4">
                  {(() => {
                    const allPendingPayments = payments.filter((p) => p.payment_link_status && !['paid', 'cancelled'].includes(p.payment_link_status));
                    
                    // Deduplicate by payment_intent + payment_method_type, keeping only the most recent
                    // Sort by created_at descending so we keep the newest one
                    const sortedPayments = [...allPendingPayments].sort((a, b) => 
                      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                    );
                    
                    const seenKeys = new Set<string>();
                    const pendingPayments = sortedPayments.filter(payment => {
                      const key = `${payment.payment_intent || 'other'}_${payment.payment_method_type || 'unknown'}`;
                      if (seenKeys.has(key)) return false;
                      seenKeys.add(key);
                      return true;
                    });
                    
                    // Group payments by intent
                    const grouped = pendingPayments.reduce((acc, payment) => {
                      const intent = payment.payment_intent || 'other';
                      if (!acc[intent]) acc[intent] = [];
                      acc[intent].push(payment);
                      return acc;
                    }, {} as Record<string, typeof pendingPayments>);

                    return Object.entries(grouped).map(([intent, intentPayments]) => {
                      // Filter out manual payments for compact view
                      // Manual payments are either payment_method_type === 'manual' OR payment_link_id starts with 'manual_'
                      const regularPayments = intentPayments.filter(p => 
                        (p as any).payment_method_type !== 'manual' && 
                        !p.payment_link_id?.startsWith('manual_')
                      );
                      const legacyManualPayments = intentPayments.filter(p => (p as any).payment_method_type === 'manual');
                      const recordedManualPayments = intentPayments.filter(p => 
                        p.payment_link_id?.startsWith('manual_') && (p as any).payment_method_type !== 'manual'
                      );
                      
                      return (
                        <div key={intent} className="space-y-4">
                          {/* Compact view for regular payment options */}
                          {regularPayments.length > 0 && (
                            <Card className="border-2">
                              <CardHeader>
                                <CardTitle className="text-lg">
                                  {intent === 'balance_payment' ? '💳 Balance Payment Options' :
                                   intent === 'security_deposit' ? '🔒 Security Deposit Authorization Options' :
                                   intent === 'down_payment' ? '💵 Down Payment Options' :
                                   '💰 Payment Options'}
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-2">
                                  {regularPayments.map((payment) => {
                                    const methodName = payment.payment_method_type === 'visa_mastercard' ? 'Visa/Mastercard' :
                                                     payment.payment_method_type === 'amex' ? 'American Express' :
                                                     payment.payment_method_type === 'bank_transfer' ? 'Bank Transfer' :
                                                     payment.payment_method_type || 'Payment';
                                    
                                    return (
                                      <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-3">
                                            <span className="font-medium">{methodName}</span>
                                            <Badge variant={payment.payment_link_status === 'pending' ? 'default' : 'secondary'}>
                                              {payment.payment_link_status}
                                            </Badge>
                                          </div>
                                          <span className="text-sm text-muted-foreground">
                                            {payment.currency} {payment.total_amount || payment.amount}
                                          </span>
                                        </div>
                                        <Button 
                                          size="sm" 
                                          variant="outline"
                                          onClick={async () => {
                                            const fullUrl = payment.payment_link_url?.startsWith('http') 
                                              ? payment.payment_link_url 
                                              : `${window.location.origin}${payment.payment_link_url}`;
                                            await navigator.clipboard.writeText(fullUrl);
                                            toast.success('Payment link copied to clipboard');
                                          }}
                                        >
                                          Copy Link
                                        </Button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </CardContent>
                            </Card>
                          )}
                          
                          {/* Recorded manual payments (new feature) */}
                          {recordedManualPayments.map((payment) => {
                            const methodName = payment.payment_method_type === 'visa_mastercard' ? 'Card (Visa/MC)' :
                                             payment.payment_method_type === 'amex' ? 'Card (Amex)' :
                                             payment.payment_method_type === 'bank_transfer' ? 'Bank Transfer' :
                                             payment.payment_method_type === 'cash' ? 'Cash' :
                                             payment.payment_method_type === 'crypto' ? 'Crypto' :
                                             payment.payment_method_type || 'Payment';
                            
                            return (
                              <Card key={payment.id} className="border-2 border-purple-200 bg-purple-50/50">
                                <CardHeader>
                                  <CardTitle className="text-base flex items-center gap-2">
                                    Recorded Payment - {payment.payment_intent === 'balance_payment' ? 'Balance' : 
                                      payment.payment_intent === 'down_payment' ? 'Down Payment' : 
                                      payment.payment_intent === 'full_payment' ? 'Full Payment' : 'Payment'}
                                    <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
                                      Pending Confirmation
                                    </Badge>
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <span className="text-sm text-muted-foreground">Amount:</span>
                                      <p className="font-semibold">{payment.currency} {Number(payment.amount).toFixed(2)}</p>
                                    </div>
                                    <div>
                                      <span className="text-sm text-muted-foreground">Method:</span>
                                      <p className="font-semibold">{methodName}</p>
                                    </div>
                                  </div>
                                  
                                  {payment.postfinance_transaction_id && (
                                    <div>
                                      <span className="text-sm text-muted-foreground">Transaction Reference:</span>
                                      <p className="font-mono text-sm">{payment.postfinance_transaction_id}</p>
                                    </div>
                                  )}
                                  
                                  {payment.note && (
                                    <div className="p-3 bg-white rounded border">
                                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{payment.note}</p>
                                    </div>
                                  )}
                                  
                                  {!isReadOnly && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button 
                                        className="w-full" 
                                        disabled={confirmManualPaymentMutation.isPending}
                                      >
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        {confirmManualPaymentMutation.isPending ? 'Confirming...' : 'Confirm Payment Received'}
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Confirm Recorded Payment</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Confirm this {methodName.toLowerCase()} payment of {payment.currency} {Number(payment.amount).toFixed(2)}?
                                          <br /><br />
                                          This will:
                                          <ul className="list-disc pl-5 mt-2">
                                            <li>Mark the payment as "Paid"</li>
                                            <li>Update the booking's total paid amount</li>
                                            <li>May auto-confirm the booking if payment requirement is met</li>
                                          </ul>
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction 
                                          onClick={() => confirmManualPaymentMutation.mutate({ 
                                            payment_id: payment.id, 
                                            note: payment.note || '' 
                                          })}
                                        >
                                          Confirm Payment
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                  )}
                                </CardContent>
                              </Card>
                            );
                          })}
                          
                          {/* Legacy manual payments (payment_method_type === 'manual') */}
                          {legacyManualPayments.map((payment) => (
                            <Card key={payment.id} className="border-2 border-orange-200 bg-orange-50/50">
                              <CardHeader>
                                <CardTitle className="text-base">
                                  Manual Payment - {payment.payment_intent === 'balance_payment' ? 'Balance' : payment.payment_intent === 'security_deposit' ? 'Security Deposit' : 'Payment'}
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-muted-foreground">Amount:</span>
                                  <span className="font-semibold">{payment.currency} {payment.amount}</span>
                                </div>
                                
                                {booking.manual_payment_instructions && (
                                  <div className="p-3 bg-white rounded border">
                                    <p className="text-sm font-medium mb-1">Payment Instructions:</p>
                                    <p className="text-sm whitespace-pre-wrap">{booking.manual_payment_instructions}</p>
                                  </div>
                                )}
                                
                                <div className="space-y-2">
                                  <Label htmlFor={`note-${payment.id}`}>Payment Details (How was this paid?)</Label>
                                  <Textarea
                                    id={`note-${payment.id}`}
                                    value={manualPaymentNotes[payment.id] || ''}
                                    onChange={(e) => setManualPaymentNotes(prev => ({ ...prev, [payment.id]: e.target.value }))}
                                    placeholder="E.g., Cash payment received on [date], Bitcoin transfer to wallet [address], etc."
                                    rows={3}
                                  />
                                </div>
                                
                                {!isReadOnly && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button 
                                      className="w-full" 
                                      disabled={!manualPaymentNotes[payment.id]?.trim() || confirmManualPaymentMutation.isPending}
                                    >
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      {confirmManualPaymentMutation.isPending ? 'Confirming...' : 'Confirm Manual Payment Received'}
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Confirm Manual Payment</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Have you received this manual payment of {payment.currency} {payment.amount}?
                                        This will mark it as paid and update the booking accordingly.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction 
                                        onClick={() => confirmManualPaymentMutation.mutate({ 
                                          payment_id: payment.id, 
                                          note: manualPaymentNotes[payment.id] 
                                        })}
                                      >
                                        Confirm Payment Received
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      );
                    });
                  })()}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No pending payment requests</p>
              )}
            </CardContent>
          </Card>

          {/* Security Deposit */}
          {booking && (
            <SecurityDepositCard
              bookingId={booking.id}
              securityDepositAmount={booking.security_deposit_amount || 0}
              currency={booking.currency || 'EUR'}
            />
          )}

          {/* Completed Payments */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {payments?.filter((p) => 
                (p.paid_at || p.payment_link_status === 'paid' || 
                 (p.payment_method_type === 'bank_transfer' && p.payment_link_status === 'pending')) && 
                p.payment_intent !== 'security_deposit'
              ).length > 0 ? (
                <div className="space-y-3">
                  {payments
                    .filter((p) => 
                      (p.paid_at || p.payment_link_status === 'paid' || 
                       (p.payment_method_type === 'bank_transfer' && p.payment_link_status === 'pending')) && 
                      p.payment_intent !== 'security_deposit'
                    )
                     .map((payment) => (
                      <div key={payment.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-3 border rounded-lg">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="capitalize">
                              {payment.type}
                            </Badge>
                            <Badge variant="secondary" className="capitalize">
                              {payment.method}
                            </Badge>
                            {payment.payment_method_type && (
                              <Badge variant="default" className="capitalize">
                                {payment.payment_method_type === 'visa_mastercard' ? 'Visa/MC' : 
                                 payment.payment_method_type === 'amex' ? 'Amex' : 
                                 payment.payment_method_type === 'bank_transfer' ? 'Bank Transfer' :
                                 payment.payment_method_type === 'cash' ? 'Cash' :
                                 payment.payment_method_type === 'crypto' ? 'Crypto' :
                                 payment.payment_method_type}
                              </Badge>
                            )}
                            {payment.payment_intent && (
                              <Badge className="capitalize">
                                {payment.payment_intent.replace('_', ' ')}
                              </Badge>
                            )}
                            {payment.payment_link_id?.startsWith('manual_') && (
                              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                Manual
                              </Badge>
                            )}
                            {payment.payment_method_type === 'bank_transfer' && payment.payment_link_status === 'pending' && (
                              <Badge variant="warning">Pending Confirmation</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {payment.paid_at ? format(new Date(payment.paid_at), "PPP") : 'Payment pending'}
                          </p>
                          {payment.note && <p className="text-xs text-muted-foreground">{payment.note}</p>}
                          {payment.postfinance_transaction_id && (
                            <p className="text-xs text-muted-foreground font-mono break-all">
                              PostFinance Txn: {payment.postfinance_transaction_id}
                            </p>
                          )}
                          {payment.payment_method_type === 'bank_transfer' && payment.proof_url && (
                            <p className="text-xs text-green-600 flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Payment proof uploaded
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full md:w-auto">
                          <p className="text-lg font-semibold w-full sm:w-auto text-left md:text-right">€{Number(payment.amount).toLocaleString()}</p>
                          
                          {payment.payment_method_type === 'bank_transfer' && payment.payment_link_status === 'pending' && (
                            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                              {payment.proof_url && (
                                <Button variant="ghost" size="sm" asChild className="w-full sm:w-auto h-12 sm:h-9">
                                  <a href={payment.proof_url} target="_blank" rel="noopener noreferrer">
                                    <Eye className="h-4 w-4 sm:mr-0 mr-2" />
                                    <span className="sm:hidden">View Proof</span>
                                  </a>
                                </Button>
                              )}
                              
                              {!isReadOnly && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="default" size="sm" className="gap-1 w-full sm:w-auto h-12 sm:h-9">
                                    <CheckCircle className="h-4 w-4" />
                                    Confirm Payment
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirm Bank Transfer Payment</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Have you received this bank transfer of €{Number(payment.amount).toLocaleString()}?
                                      <br /><br />
                                      This will:
                                      <ul className="list-disc pl-5 mt-2">
                                        <li>Mark the payment as "Paid"</li>
                                        <li>Update the booking's total paid amount</li>
                                        <li>Generate a payment receipt PDF</li>
                                        <li>May auto-confirm the booking if down payment requirement is met</li>
                                      </ul>
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => confirmBankTransferMutation.mutate(payment.id)}
                                      disabled={confirmBankTransferMutation.isPending}
                                    >
                                      {confirmBankTransferMutation.isPending ? (
                                        <>
                                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                          Confirming...
                                        </>
                                      ) : (
                                        'Confirm Payment Received'
                                      )}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                              )}
                            </div>
                          )}
                          
                          {payment.receipt_url && (
                            <Button variant="ghost" size="sm" asChild className="w-full sm:w-auto h-12 sm:h-9">
                              <a href={payment.receipt_url} target="_blank" rel="noopener noreferrer">
                                <Download className="h-4 w-4 sm:mr-0 mr-2" />
                                <span className="sm:hidden">Receipt</span>
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No payments recorded</p>
              )}
            </CardContent>
          </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          {/* Supplier Invoices Section - hidden for restricted staff */}
          {!isRestrictedStaff && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle>Supplier Invoices</CardTitle>
              {!isReadOnly && (
              <SimpleInvoiceUpload 
                bookingId={id!} 
                carPlate={booking.car_plate}
              />
              )}
            </CardHeader>
            <CardContent>
              {/* Supplier Invoice Summary */}
              {supplierInvoices && supplierInvoices.length > 0 && (() => {
                const rentalInvoices = supplierInvoices.filter(inv => inv.invoice_type !== 'security_deposit_extra');
                const totalSupplierAmount = rentalInvoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
                const totalSupplierPaid = rentalInvoices.reduce((sum, inv) => sum + Number(inv.amount_paid || 0), 0);
                const remaining = totalSupplierAmount - totalSupplierPaid;
                const paymentPercentage = totalSupplierAmount > 0 ? (totalSupplierPaid / totalSupplierAmount) * 100 : 0;
                const supplierPaymentStatus = totalSupplierPaid >= totalSupplierAmount ? 'paid' : totalSupplierPaid > 0 ? 'partial' : 'to_pay';
                
                return (
                  <div className="mb-6 p-4 bg-muted/50 rounded-lg border">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Total to Pay</p>
                        <p className="text-xl font-bold">€{totalSupplierAmount.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Amount Paid</p>
                        <p className="text-xl font-bold text-green-600">€{totalSupplierPaid.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Remaining</p>
                        <p className={`text-xl font-bold ${remaining > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                          €{remaining.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Status</p>
                        <Badge variant={supplierPaymentStatus === 'paid' ? 'default' : supplierPaymentStatus === 'partial' ? 'secondary' : 'destructive'}>
                          {supplierPaymentStatus === 'paid' ? 'Paid' : supplierPaymentStatus === 'partial' ? 'Partial' : 'To Pay'}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-3">
                      <Progress value={paymentPercentage} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">{paymentPercentage.toFixed(0)}% paid</p>
                    </div>
                  </div>
                );
              })()}

              {supplierInvoices && supplierInvoices.length > 0 ? (
                <div className="space-y-4">
                  {supplierInvoices.filter(inv => inv.invoice_type !== 'security_deposit_extra').map((invoice) => {
                    const invoiceRemaining = Number(invoice.amount) - Number(invoice.amount_paid || 0);
                    return (
                      <div key={invoice.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{invoice.supplier_name}</p>
                              <Badge variant={
                                invoice.payment_status === 'paid' ? 'default' : 
                                'destructive'
                              }>
                                {invoice.payment_status}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground space-y-0.5">
                              <p>Total: €{Number(invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                              <p>Paid: €{Number(invoice.amount_paid || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                              {invoiceRemaining > 0 && (
                                <p className="font-medium text-orange-600">
                                  Remaining: €{invoiceRemaining.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Issue Date: {format(new Date(invoice.issue_date), 'PP')}
                            </p>
                          </div>
                          <div className="flex flex-col gap-2">
                            <RecordSupplierPaymentDialog invoice={invoice} />
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
                          currentProofUrl={invoice.payment_proof_url}
                          invoiceAmount={Number(invoice.amount)}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No supplier invoices recorded</p>
              )}
            </CardContent>
          </Card>
          )}

          {/* Security Deposit Extras Section - hidden for restricted staff */}
          {!isRestrictedStaff && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle>Security Deposit Extras</CardTitle>
              {!isReadOnly && (
              <SimpleInvoiceUpload 
                bookingId={id!} 
                carPlate={booking.car_plate}
                defaultInvoiceType="security_deposit_extra"
              />
              )}
            </CardHeader>
            <CardContent>
              {(() => {
                const capturedAmount = securityDepositAuth?.captured_amount || 0;
                const captureReason = securityDepositAuth?.capture_reason || '';
                const capturedAt = securityDepositAuth?.captured_at;
                const extraInvoices = supplierInvoices?.filter(inv => inv.invoice_type === 'security_deposit_extra') || [];
                const totalSupplierCost = extraInvoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
                const margin = capturedAmount - totalSupplierCost;

                if (capturedAmount === 0 && extraInvoices.length === 0) {
                  return (
                    <p className="text-center text-muted-foreground py-8">
                      No security deposit captured and no extra invoices recorded
                    </p>
                  );
                }

                return (
                  <div className="space-y-6">
                    {/* Captured from Client */}
                    {capturedAmount > 0 && (
                      <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-2">Captured from Client</h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-amber-700 dark:text-amber-300">Amount:</span>
                            <span className="font-bold text-amber-900 dark:text-amber-100">€{capturedAmount.toFixed(2)}</span>
                          </div>
                          {captureReason && (
                            <div className="flex justify-between">
                              <span className="text-amber-700 dark:text-amber-300">Reason:</span>
                              <span className="text-amber-900 dark:text-amber-100">{captureReason}</span>
                            </div>
                          )}
                          {capturedAt && (
                            <div className="flex justify-between">
                              <span className="text-amber-700 dark:text-amber-300">Date:</span>
                              <span className="text-amber-900 dark:text-amber-100">{format(new Date(capturedAt), 'PP')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Supplier Cost */}
                    {extraInvoices.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-3">Supplier Cost (Invoices)</h4>
                        <div className="space-y-3">
                          {extraInvoices.map((invoice) => {
                            const invoiceRemaining = Number(invoice.amount) - Number(invoice.amount_paid || 0);
                            return (
                              <div key={invoice.id} className="border rounded-lg p-3 space-y-3">
                                <div className="flex items-start justify-between">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium text-sm">{invoice.supplier_name}</p>
                                      <Badge variant={invoice.payment_status === 'paid' ? 'default' : 'destructive'} className="text-xs">
                                        {invoice.payment_status}
                                      </Badge>
                                    </div>
                                    <div className="text-sm text-muted-foreground space-y-0.5">
                                      <p>Total: €{Number(invoice.amount).toFixed(2)}</p>
                                      <p>Paid: €{Number(invoice.amount_paid || 0).toFixed(2)}</p>
                                      {invoiceRemaining > 0 && (
                                        <p className="font-medium text-orange-600">
                                          Remaining: €{invoiceRemaining.toFixed(2)}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex flex-col gap-2">
                                    <RecordSupplierPaymentDialog invoice={invoice} />
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
                                  currentProofUrl={invoice.payment_proof_url}
                                  invoiceAmount={Number(invoice.amount)}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Margin Calculation */}
                    {(capturedAmount > 0 || extraInvoices.length > 0) && (
                      <div className={`p-4 rounded-lg border ${margin >= 0 ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'}`}>
                        <h4 className={`font-medium mb-2 ${margin >= 0 ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                          Margin Calculation
                        </h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className={margin >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
                              Captured from Client:
                            </span>
                            <span>€{capturedAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className={margin >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
                              Supplier Cost:
                            </span>
                            <span>- €{totalSupplierCost.toFixed(2)}</span>
                          </div>
                          <div className="border-t border-current/20 my-2" />
                          <div className="flex justify-between font-bold">
                            <span className={margin >= 0 ? 'text-green-800 dark:text-green-100' : 'text-red-800 dark:text-red-100'}>
                              {margin >= 0 ? 'Profit:' : 'Loss:'}
                            </span>
                            <span className={margin >= 0 ? 'text-green-800 dark:text-green-100' : 'text-red-800 dark:text-red-100'}>
                              €{margin.toFixed(2)}
                            </span>
                          </div>
                          <p className="text-xs mt-2 opacity-70">
                            {margin >= 0 ? 'Added to rental profit' : 'Deducted from rental profit'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
          )}

          {/* Client Invoices Section */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle>Client Proforma Invoices</CardTitle>
              {!isReadOnly && (
              <AddClientInvoiceDialog
                bookingId={id!}
                defaultClientName={booking.client_name}
                defaultBillingAddress={booking.billing_address || undefined}
                defaultSubtotal={Number(booking.amount_total)}
              />
              )}
            </CardHeader>
            <CardContent>
              {clientInvoices && clientInvoices.length > 0 ? (
                <div className="space-y-4">
                  {clientInvoices.map((invoice) => (
                    <div key={invoice.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{invoice.invoice_number}</p>
                          </div>
                          <p className="text-sm text-muted-foreground">{invoice.client_name}</p>
                          <p className="text-sm text-muted-foreground">
                            Total: €{Number(invoice.total_amount).toLocaleString()}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Issue Date: {format(new Date(invoice.issue_date), 'PP')}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <PDFDownloadLink
                          document={
                            <ClientInvoicePDF 
                              invoice={invoice}
                              companySettings={appSettings || undefined}
                            />
                          }
                          fileName={`${invoice.invoice_number.replace('INV-', 'PRO-')}.pdf`}
                        >
                          {({ loading }) => (
                            <Button variant="outline" size="sm" disabled={loading}>
                              <Download className="h-4 w-4 mr-2" />
                              {loading ? 'Generating...' : 'Download PDF'}
                            </Button>
                          )}
                        </PDFDownloadLink>
                        
                        {!isReadOnly && (
                        <>
                        <EditClientInvoiceDialog invoice={invoice} />
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancel Proforma Invoice</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to cancel this client proforma invoice? This action cannot be undone.
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
                        </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No client proforma invoices created</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

          <TabsContent value="fines" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle>Fines</CardTitle>
                <SimpleFineUpload 
                  bookingId={id!} 
                  carPlate={booking.car_plate}
                />
              </CardHeader>
              <CardContent>
                {finesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : fines?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No fines recorded for this booking
                  </div>
                ) : (
                  <div className="space-y-4">
                    {fines?.map((fine) => (
                      <div key={fine.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{fine.display_name || 'Fine Document'}</p>
                            <Badge variant={fine.payment_status === 'paid' ? 'default' : 'destructive'}>
                              {fine.payment_status}
                            </Badge>
                          </div>
                          {fine.amount && (
                            <p className="text-sm text-muted-foreground">
                              Amount: €{Number(fine.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          )}
                          <p className="text-sm text-muted-foreground">
                            Issue Date: {format(new Date(fine.issue_date), 'PP')}
                          </p>
                          {fine.payments && fine.payments.length > 0 && fine.payments[0].paid_at && (
                            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                              ✓ Client paid €{Number(fine.payments[0].amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} on {format(new Date(fine.payments[0].paid_at), 'PP')}
                              {fine.payments[0].payment_method_type && (
                                <span className="text-muted-foreground ml-1">
                                  via {fine.payments[0].payment_method_type === 'bank_transfer' ? 'Bank Transfer' : 
                                       fine.payments[0].payment_method_type === 'cash' ? 'Cash' :
                                       fine.payments[0].payment_method_type === 'crypto' ? 'Crypto' :
                                       fine.payments[0].payment_method_type}
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
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
                            currentProofUrl={fine.payment_proof_url}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="space-y-4">
            <BookingDocuments bookingId={id!} />
          </TabsContent>

          <TabsContent value="rental" className="space-y-4">
            <RentalManagement bookingId={id!} />
          </TabsContent>

          <TabsContent value="chat" className="space-y-4">
            <ChatThread
              entityType="booking"
              entityId={id!}
              entityName={`Booking ${booking.reference_code}`}
            />
          </TabsContent>
        </Tabs>

      <EditBookingDialog 
        open={editDialogOpen} 
        onOpenChange={setEditDialogOpen} 
        booking={booking} 
      />

      <GeneratePaymentLinkDialog
        open={generatePaymentLinkOpen}
        onOpenChange={setGeneratePaymentLinkOpen}
        bookingId={booking.id}
        amountTotal={Number(booking.amount_total)}
        amountPaid={Number(booking.amount_paid)}
        paymentAmountPercent={booking.payment_amount_percent}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["booking", id] });
          queryClient.invalidateQueries({ queryKey: ["payments", id] });
        }}
      />
      
      <RecordManualPaymentDialog
        open={recordManualPaymentOpen}
        onOpenChange={setRecordManualPaymentOpen}
        bookingId={booking.id}
        bookingReference={booking.reference_code}
        currency={booking.currency || 'EUR'}
        amountTotal={Number(booking.amount_total)}
        amountPaid={Number(booking.amount_paid)}
      />
      
      <SendBookingFormDialog
        open={sendBookingFormOpen}
        onOpenChange={setSendBookingFormOpen}
        booking={booking}
      />
      
      <SignatureViewerDialog
        open={signatureViewerOpen}
        onOpenChange={setSignatureViewerOpen}
        booking={booking}
      />
    </div>
  );
}
