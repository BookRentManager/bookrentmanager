import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Euro, Car, User, Calendar, MapPin, AlertCircle, FileText, CreditCard, Receipt } from "lucide-react";
import { format } from "date-fns";
import { SimpleFineUpload } from "@/components/SimpleFineUpload";
import { SimpleInvoiceUpload } from "@/components/SimpleInvoiceUpload";
import { FineDocumentPreview } from "@/components/FineDocumentPreview";
import { FinePaymentProof } from "@/components/FinePaymentProof";
import { InvoiceDocumentPreview } from "@/components/InvoiceDocumentPreview";
import { InvoicePaymentProof } from "@/components/InvoicePaymentProof";

export default function BookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

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

  const { data: invoices } = useQuery({
    queryKey: ["booking-invoices", id],
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
    const variants: Record<string, { variant: "default" | "secondary" | "destructive"; className?: string }> = {
      confirmed: { variant: "default", className: "bg-success text-success-foreground" },
      to_be_confirmed: { variant: "secondary", className: "bg-warning text-warning-foreground" },
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
            <CardTitle className="text-xs md:text-sm font-medium">Invoices</CardTitle>
            <FileText className="h-3 md:h-4 w-3 md:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            <div className="text-lg md:text-2xl font-bold">{invoices?.length || 0}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground">
              To pay: {invoices?.filter(i => i.payment_status === 'to_pay').length || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <div className="overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="inline-flex w-auto">
            <TabsTrigger value="overview" className="text-xs md:text-sm whitespace-nowrap">Overview</TabsTrigger>
            <TabsTrigger value="financials" className="text-xs md:text-sm whitespace-nowrap">Financials</TabsTrigger>
            <TabsTrigger value="payments" className="text-xs md:text-sm whitespace-nowrap">Payments ({payments?.length || 0})</TabsTrigger>
            <TabsTrigger value="fines" className="text-xs md:text-sm whitespace-nowrap">Fines ({fines?.length || 0})</TabsTrigger>
            <TabsTrigger value="invoices" className="text-xs md:text-sm whitespace-nowrap">Invoices ({invoices?.length || 0})</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
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
              </CardContent>
            </Card>

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
                {booking.km_included && (
                  <div>
                    <span className="text-sm font-medium">KM Included:</span>
                    <p className="text-sm text-muted-foreground">{booking.km_included} km</p>
                  </div>
                )}
                {booking.security_deposit_amount && (
                  <div>
                    <span className="text-sm font-medium">Security Deposit:</span>
                    <p className="text-sm text-muted-foreground">€{Number(booking.security_deposit_amount).toLocaleString()}</p>
                  </div>
                )}
              </CardContent>
            </Card>

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

              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Net Commission:</span>
                  <div className="text-right">
                    <span className="text-2xl font-bold">€{Number(financials?.commission_net || 0).toLocaleString()}</span>
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
                  <FileText className="h-5 w-5" />
                  Supplier Invoices
                </CardTitle>
                <SimpleInvoiceUpload bookingId={id!} carPlate={booking.car_plate} />
              </div>
            </CardHeader>
            <CardContent>
              {invoices && invoices.length > 0 ? (
                <div className="space-y-4">
                  {invoices.map((invoice) => (
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
                <p className="text-center text-muted-foreground py-8">No invoices linked to this booking</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
