import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import { format } from "date-fns";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { AddInvoiceDialog } from "@/components/AddInvoiceDialog";
import { useNavigate } from "react-router-dom";

export default function Invoices() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "paid" | "to_pay">("all");
  const { data: supplierInvoices, isLoading } = useQuery({
    queryKey: ["supplier-invoices"],
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

  const pendingInvoices = supplierInvoices?.filter((i) => i.payment_status === "to_pay");
  const pendingTotal = pendingInvoices?.reduce((sum, i) => sum + Number(i.amount), 0) || 0;
  
  const filteredInvoices = supplierInvoices?.filter((i) => {
    if (filter === "all") return true;
    return i.payment_status === filter;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Supplier Invoices</h2>
          <p className="text-sm md:text-base text-muted-foreground">Manage supplier payments</p>
        </div>
        <AddInvoiceDialog />
      </div>
      
      <div className="bg-muted/50 p-4 rounded-lg border">
        <p className="text-sm text-muted-foreground">
          <strong>Note:</strong> Client invoices are automatically generated when a booking is marked as paid. You can manage client invoices from the individual booking details page.
        </p>
      </div>

      {pendingInvoices && pendingInvoices.length > 0 && (
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
                  {pendingInvoices.length}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold">Total amount</span>
                <span className="text-lg font-bold text-warning">
                  €{pendingTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-card">
        <CardHeader className="px-4 md:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base md:text-lg">Supplier Invoices</CardTitle>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | "paid" | "to_pay")} className="w-full sm:w-auto">
              <TabsList className="w-full sm:w-auto grid grid-cols-3">
                <TabsTrigger value="all" className="text-xs md:text-sm">All</TabsTrigger>
                <TabsTrigger value="to_pay" className="text-xs md:text-sm">To Pay</TabsTrigger>
                <TabsTrigger value="paid" className="text-xs md:text-sm">Paid</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="px-4 md:px-6">
          <div className="space-y-4">
            {filteredInvoices && filteredInvoices.length > 0 ? (
              filteredInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 md:p-5 border rounded-lg hover:shadow-card hover:border-accent transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                  onClick={() => invoice.booking_id && navigate(`/bookings/${invoice.booking_id}?tab=invoices`)}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm md:text-base truncate">{invoice.supplier_name}</span>
                      <Badge variant={invoice.payment_status === "paid" ? "success" : "warning"}>
                        {invoice.payment_status === "to_pay" ? "To Pay" : "Paid"}
                      </Badge>
                    </div>
                    <div className="text-xs md:text-sm text-muted-foreground">
                      Issued: {format(new Date(invoice.issue_date), "PP")}
                    </div>
                  </div>
                  <div className="text-left sm:text-right flex-shrink-0">
                    <div className="font-semibold text-sm md:text-base">€{Number(invoice.amount).toLocaleString()}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                {filter === "all" ? "No invoices recorded" : `No ${filter === "to_pay" ? "pending" : "paid"} invoices`}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
