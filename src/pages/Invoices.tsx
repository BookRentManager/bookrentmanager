import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText } from "lucide-react";
import { format } from "date-fns";

export default function Invoices() {
  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices"],
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

  const pendingInvoices = invoices?.filter((i) => i.payment_status === "to_pay");
  const pendingTotal = pendingInvoices?.reduce((sum, i) => sum + Number(i.amount), 0) || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Supplier Invoices</h2>
          <p className="text-muted-foreground">Manage supplier payments and invoices</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Invoice
        </Button>
      </div>

      {pendingInvoices && pendingInvoices.length > 0 && (
        <Card className="shadow-card border-warning/20 bg-warning/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-warning" />
              <CardTitle className="text-warning">Pending Invoices</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
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
        <CardHeader>
          <CardTitle>All Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {invoices && invoices.length > 0 ? (
              invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
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
                    <div className="text-sm text-muted-foreground">
                      Issued: {format(new Date(invoice.issue_date), "PPP")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">€{Number(invoice.amount).toLocaleString()}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground">No invoices recorded</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
