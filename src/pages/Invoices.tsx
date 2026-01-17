import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Calendar, Search } from "lucide-react";
import { format } from "date-fns";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { QuickChatTrigger } from "@/components/chat/QuickChatTrigger";
import { AddInvoiceDialog } from "@/components/AddInvoiceDialog";
import { UnlinkedInvoiceTreatment } from "@/components/UnlinkedInvoiceTreatment";
import { useUserViewScope } from "@/hooks/useUserViewScope";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Invoices() {
  const [invoiceType, setInvoiceType] = useState<"supplier" | "client">("supplier");
  const [supplierFilter, setSupplierFilter] = useState<"all" | "paid" | "to_pay">("all");
  const [clientFilter, setClientFilter] = useState<"all">("all");
  const [yearFilter, setYearFilter] = useState<string>(new Date().getFullYear().toString());
  const [searchQuery, setSearchQuery] = useState("");
  const { isReadOnly } = useUserViewScope();

  const { data: supplierInvoices, isLoading: isLoadingSupplier } = useQuery({
    queryKey: ["supplier-invoices"],
    refetchOnMount: 'always',
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_invoices")
        .select("*")
        .is("deleted_at", null)
        .order("issue_date", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: clientInvoices, isLoading: isLoadingClient } = useQuery({
    queryKey: ["client-invoices"],
    refetchOnMount: 'always',
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_invoices")
        .select(`
          *,
          bookings(reference_code, client_name)
        `)
        .is("deleted_at", null)
        .order("issue_date", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Extract unique years from both invoice types
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    supplierInvoices?.forEach(i => years.add(new Date(i.issue_date).getFullYear()));
    clientInvoices?.forEach(i => years.add(new Date(i.issue_date).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [supplierInvoices, clientInvoices]);

  const pendingSupplierInvoices = supplierInvoices?.filter((i) => i.payment_status === "to_pay");
  const pendingSupplierTotal = pendingSupplierInvoices?.reduce((sum, i) => sum + Number(i.amount), 0) || 0;
  
  const filteredSupplierInvoices = supplierInvoices?.filter((i) => {
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        i.supplier_name?.toLowerCase().includes(query) ||
        i.invoice_reference?.toLowerCase().includes(query) ||
        i.car_plate?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }
    // Year filter
    if (yearFilter !== "all") {
      const invoiceYear = new Date(i.issue_date).getFullYear().toString();
      if (invoiceYear !== yearFilter) return false;
    }
    // Status filter
    if (supplierFilter !== "all" && i.payment_status !== supplierFilter) return false;
    return true;
  });

  const filteredClientInvoices = clientInvoices?.filter((i) => {
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        i.invoice_number?.toLowerCase().includes(query) ||
        i.client_name?.toLowerCase().includes(query) ||
        i.bookings?.reference_code?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }
    // Year filter
    if (yearFilter !== "all") {
      const invoiceYear = new Date(i.issue_date).getFullYear().toString();
      if (invoiceYear !== yearFilter) return false;
    }
    return true;
  });

  const isLoading = isLoadingSupplier || isLoadingClient;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Invoices</h2>
        <p className="text-sm md:text-base text-muted-foreground">Manage supplier and client invoices</p>
      </div>

      <Tabs value={invoiceType} onValueChange={(v) => setInvoiceType(v as "supplier" | "client")} className="w-full">
        <TabsList className="w-full sm:w-auto grid grid-cols-2">
          <TabsTrigger value="supplier" className="text-xs md:text-sm">Supplier Invoices</TabsTrigger>
          <TabsTrigger value="client" className="text-xs md:text-sm">Client Proforma Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="supplier" className="space-y-4 md:space-y-6 mt-4">
          {pendingSupplierInvoices && pendingSupplierInvoices.length > 0 && (
            <Card className="shadow-card border-warning/20 bg-warning/5">
              <CardHeader className="px-4 md:px-6">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 md:h-5 w-4 md:w-5 text-warning" />
                  <CardTitle className="text-warning text-base md:text-lg">Pending Invoices</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-4 md:px-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">To be paid</span>
                    <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                      {pendingSupplierInvoices.length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Total amount</span>
                    <span className="text-lg font-bold text-warning">
                      €{pendingSupplierTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-card">
            <CardHeader className="px-4 md:px-6">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base md:text-lg">Supplier Invoices</CardTitle>
                    {!isReadOnly && <AddInvoiceDialog />}
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Select value={yearFilter} onValueChange={setYearFilter}>
                      <SelectTrigger className="w-24">
                        <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {availableYears.map(year => (
                          <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Tabs value={supplierFilter} onValueChange={(v) => setSupplierFilter(v as "all" | "paid" | "to_pay")} className="flex-1 sm:flex-none">
                      <TabsList className="w-full sm:w-auto grid grid-cols-3">
                        <TabsTrigger value="all" className="text-xs md:text-sm">All</TabsTrigger>
                        <TabsTrigger value="to_pay" className="text-xs md:text-sm">To Pay</TabsTrigger>
                        <TabsTrigger value="paid" className="text-xs md:text-sm">Paid</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by supplier, reference or plate..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-full"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 md:px-6">
              <div className="space-y-4">
                {filteredSupplierInvoices && filteredSupplierInvoices.length > 0 ? (
                  filteredSupplierInvoices.map((invoice) => {
                    const cardContent = (
                      <>
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm md:text-base break-words">{invoice.supplier_name}</span>
                            <Badge variant={invoice.payment_status === "paid" ? "success" : "warning"}>
                              {invoice.payment_status === "to_pay" ? "To Pay" : "Paid"}
                            </Badge>
                            {!invoice.booking_id && (
                              <Badge variant="outline" className="text-muted-foreground">Unlinked</Badge>
                            )}
                          </div>
                          <div className="text-xs md:text-sm text-muted-foreground">
                            {invoice.car_plate && !invoice.booking_id && (
                              <span className="font-medium text-foreground">Car: {invoice.car_plate} • </span>
                            )}
                            {invoice.invoice_reference && (
                              <span className="font-medium text-foreground">Ref: {invoice.invoice_reference} • </span>
                            )}
                            Issued: {format(new Date(invoice.issue_date), "PP")}
                            {invoice.due_date && (
                              <span> • Due: {format(new Date(invoice.due_date), "PP")}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-left sm:text-right flex-shrink-0">
                          <div className="font-semibold text-sm md:text-base">€{Number(invoice.amount).toLocaleString()}</div>
                        </div>
                      </>
                    );

                    return (
                      <div key={invoice.id} className="flex items-center gap-3 p-4 md:p-5 border rounded-lg hover:shadow-card hover:border-accent transition-all group">
                        {invoice.booking_id ? (
                          <Link
                            to={`/bookings/${invoice.booking_id}?tab=invoices`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 cursor-pointer"
                          >
                            {cardContent}
                          </Link>
                        ) : (
                          <div className="flex-1 flex flex-col gap-3">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                              {cardContent}
                            </div>
                            <UnlinkedInvoiceTreatment
                              invoice={{
                                id: invoice.id,
                                amount: Number(invoice.amount),
                                amount_paid: invoice.amount_paid,
                                supplier_name: invoice.supplier_name,
                                booking_id: invoice.booking_id,
                                invoice_url: invoice.invoice_url,
                                payment_proof_url: invoice.payment_proof_url,
                                payment_status: invoice.payment_status,
                                updated_at: invoice.updated_at,
                              }}
                            />
                          </div>
                        )}
                        <QuickChatTrigger 
                          context={{ 
                            type: 'supplier_invoice', 
                            id: invoice.id,
                            name: invoice.supplier_name
                          }} 
                        />
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    {supplierFilter === "all" ? "No invoices recorded" : `No ${supplierFilter === "to_pay" ? "pending" : "paid"} invoices`}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="client" className="space-y-4 md:space-y-6 mt-4">
          <Card className="shadow-card">
            <CardHeader className="px-4 md:px-6">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <CardTitle className="text-base md:text-lg">Client Proforma Invoices</CardTitle>
                  <Select value={yearFilter} onValueChange={setYearFilter}>
                    <SelectTrigger className="w-24">
                      <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {availableYears.map(year => (
                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by invoice number, client or booking..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-full"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 md:px-6">
              <div className="space-y-4">
                {filteredClientInvoices && filteredClientInvoices.length > 0 ? (
                  filteredClientInvoices.map((invoice) => (
                    <div key={invoice.id} className="flex items-center gap-3 p-4 md:p-5 border rounded-lg hover:shadow-card hover:border-accent transition-all group">
                      <Link
                        to={`/bookings/${invoice.booking_id}?tab=invoices`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 cursor-pointer"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm md:text-base break-words">{invoice.invoice_number}</span>
                          </div>
                          <div className="text-xs md:text-sm text-muted-foreground">
                            {invoice.bookings?.reference_code && (
                              <span className="font-medium text-foreground">
                                {invoice.bookings.reference_code}
                              </span>
                            )}
                            {invoice.client_name && (
                              <span> • {invoice.client_name}</span>
                            )}
                            {invoice.issue_date && (
                              <span> • {format(new Date(invoice.issue_date), "PP")}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-left sm:text-right flex-shrink-0">
                          <div className="font-semibold text-sm md:text-base">€{Number(invoice.total_amount).toLocaleString()}</div>
                        </div>
                      </Link>
                      <QuickChatTrigger 
                        context={{ 
                          type: 'client_invoice', 
                          id: invoice.id,
                          name: `${invoice.invoice_number} - ${invoice.client_name}`
                        }} 
                      />
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    No client proforma invoices recorded
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
