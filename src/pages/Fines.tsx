import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { Link } from "react-router-dom";
import { QuickChatTrigger } from "@/components/chat/QuickChatTrigger";
import { AddFineDialog } from "@/components/AddFineDialog";

interface FinePayment {
  id: string;
  amount: number;
  paid_at: string | null;
  note: string | null;
  payment_method_type: string | null;
}

export default function Fines() {
  const [filter, setFilter] = useState<"all" | "paid" | "unpaid">("all");
  const { data: fines, isLoading } = useQuery({
    queryKey: ["fines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fines")
        .select(`
          *,
          bookings(reference_code, client_name),
          payments!payments_fine_id_fkey(id, amount, paid_at, note, payment_method_type)
        `)
        .is("deleted_at", null)
        .order("issue_date", { ascending: false });

      if (error) throw error;
      return data as (typeof data[number] & { payments: FinePayment[] })[];
    },
  });

  const unpaidFines = fines?.filter((f) => f.payment_status === "unpaid");
  const unpaidTotal = unpaidFines?.reduce((sum, f) => sum + Number(f.amount), 0) || 0;
  
  const filteredFines = fines?.filter((f) => {
    if (filter === "all") return true;
    return f.payment_status === filter;
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
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Fines</h2>
          <p className="text-sm md:text-base text-muted-foreground">Track and manage traffic fines</p>
        </div>
        <AddFineDialog />
      </div>

      {unpaidFines && unpaidFines.length > 0 && (
        <Card className="shadow-card border-warning/20 bg-warning/5">
          <CardHeader className="px-4 md:px-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 md:h-5 w-4 md:w-5 text-warning" />
              <CardTitle className="text-warning text-base md:text-lg">Pending Fines</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Unpaid fines</span>
                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                  {unpaidFines.length}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold">Total amount</span>
                <span className="text-lg font-bold text-warning">
                  €{unpaidTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-card">
        <CardHeader className="px-4 md:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base md:text-lg">All Fines</CardTitle>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | "paid" | "unpaid")} className="w-full sm:w-auto">
              <TabsList className="w-full sm:w-auto grid grid-cols-3">
                <TabsTrigger value="all" className="text-xs md:text-sm">All</TabsTrigger>
                <TabsTrigger value="unpaid" className="text-xs md:text-sm">Unpaid</TabsTrigger>
                <TabsTrigger value="paid" className="text-xs md:text-sm">Paid</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="px-4 md:px-6">
          <div className="space-y-4">
            {filteredFines && filteredFines.length > 0 ? (
              filteredFines.map((fine) => {
                const cardContent = (
                  <>
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm md:text-base break-words">{fine.display_name || fine.fine_number || 'Fine Document'}</span>
                        <Badge variant={fine.payment_status === "paid" ? "success" : "warning"}>
                          {fine.payment_status}
                        </Badge>
                        {!fine.booking_id && (
                          <Badge variant="outline" className="text-muted-foreground">Unlinked</Badge>
                        )}
                      </div>
                      <div className="text-xs md:text-sm text-muted-foreground">
                        {fine.bookings?.reference_code ? (
                          <>
                            <span className="font-medium text-foreground">
                              {fine.bookings.reference_code}
                            </span>
                            {fine.bookings?.client_name && (
                              <span> • {fine.bookings.client_name}</span>
                            )}
                          </>
                        ) : fine.car_plate ? (
                          <span className="font-medium text-foreground">Car: {fine.car_plate}</span>
                        ) : null}
                        {fine.issue_date && (
                          <span> • {format(new Date(fine.issue_date), "PP")}</span>
                        )}
                      </div>
                      {/* Show linked payment info if fine was paid via manual payment */}
                      {fine.payments && fine.payments.length > 0 && fine.payments[0].paid_at && (
                        <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                          ✓ Paid on {format(new Date(fine.payments[0].paid_at), "PP")}
                          {fine.payments[0].payment_method_type && (
                            <span className="text-muted-foreground ml-1">
                              via {fine.payments[0].payment_method_type === 'bank_transfer' ? 'Bank Transfer' : 
                                   fine.payments[0].payment_method_type === 'cash' ? 'Cash' :
                                   fine.payments[0].payment_method_type === 'crypto' ? 'Crypto' :
                                   fine.payments[0].payment_method_type}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-left sm:text-right flex-shrink-0">
                      {fine.amount && (
                        <div className="font-semibold text-sm md:text-base">€{Number(fine.amount).toLocaleString()}</div>
                      )}
                    </div>
                  </>
                );

                return (
                  <div key={fine.id} className="flex items-center gap-3 p-4 md:p-5 border rounded-lg hover:shadow-card hover:border-accent transition-all group">
                    {fine.booking_id ? (
                      <Link
                        to={`/bookings/${fine.booking_id}?tab=fines`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 cursor-pointer"
                      >
                        {cardContent}
                      </Link>
                    ) : (
                      <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        {cardContent}
                      </div>
                    )}
                    <QuickChatTrigger 
                      context={{ 
                        type: 'fine', 
                        id: fine.id,
                        name: fine.display_name || fine.fine_number || `Fine ${fine.id.slice(0, 8)}`
                      }} 
                    />
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                {filter === "all" ? "No fines recorded" : `No ${filter} fines`}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
