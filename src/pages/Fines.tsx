import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { Link } from "react-router-dom";
import { QuickChatTrigger } from "@/components/chat/QuickChatTrigger";
import { AddFineDialog } from "@/components/AddFineDialog";
import { useUserViewScope } from "@/hooks/useUserViewScope";
import { cn } from "@/lib/utils";
import { FineDocumentPreview } from "@/components/FineDocumentPreview";
import { FinePaymentProof } from "@/components/FinePaymentProof";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";

interface FinePayment {
  id: string;
  amount: number;
  paid_at: string | null;
  note: string | null;
  payment_method_type: string | null;
}

export default function Fines() {
  const [filter, setFilter] = useState<"all" | "paid" | "unpaid">("all");
  const queryClient = useQueryClient();
  const { isReadOnly } = useUserViewScope();

  const deleteFine = useMutation({
    mutationFn: async (fineId: string) => {
      const { error } = await supabase
        .from("fines")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", fineId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fines"] });
      toast.success("Fine cancelled successfully");
    },
    onError: () => {
      toast.error("Failed to cancel fine");
    },
  });

  const { data: fines, isLoading } = useQuery({
    queryKey: ["fines"],
    refetchOnMount: 'always',
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
  
  // Calculate fines balance (client payments vs fine amounts for fines with linked payments)
  // Exclude unlinked fines from balance calculation
  const finesWithClientPayment = fines?.filter(f => 
    f.booking_id && // Only include fines linked to a booking
    f.payments && f.payments.length > 0 && f.payments[0].amount
  ) || [];

  const totalClientPayments = finesWithClientPayment.reduce(
    (sum, f) => sum + Number(f.payments[0].amount), 0
  );
  const totalFineAmounts = finesWithClientPayment.reduce(
    (sum, f) => sum + Number(f.amount), 0
  );
  const finesBalance = totalClientPayments - totalFineAmounts;

  // Calculate unlinked fines totals
  const unlinkedFines = fines?.filter(f => !f.booking_id) || [];
  const unlinkedTotal = unlinkedFines.reduce((sum, f) => sum + Number(f.amount || 0), 0);
  const unlinkedPaidCount = unlinkedFines.filter(f => f.payment_status === 'paid').length;
  const unlinkedUnpaidCount = unlinkedFines.filter(f => f.payment_status === 'unpaid').length;

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
        {!isReadOnly && <AddFineDialog />}
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Pending Fines Card */}
        {unpaidFines && unpaidFines.length > 0 && (
          <Card className="shadow-card border-warning/20 bg-warning/5">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-warning" />
                <span className="font-semibold text-warning text-sm">Pending Fines</span>
                <Badge variant="outline" className="ml-auto bg-warning/10 text-warning border-warning/20 text-xs">
                  {unpaidFines.length}
                </Badge>
              </div>
              <div className="text-lg font-bold text-warning">
                €{unpaidTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Fines Balance Card */}
        {finesWithClientPayment.length > 0 && (
          <Card className="shadow-card">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm">Fines Balance</span>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground mb-2">
                <div className="flex justify-between">
                  <span>Received</span>
                  <span>€{totalClientPayments.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>Paid out</span>
                  <span>€{totalFineAmounts.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              <div className={cn(
                "text-lg font-bold",
                finesBalance > 0 ? "text-green-600 dark:text-green-400" :
                finesBalance < 0 ? "text-red-600 dark:text-red-400" :
                "text-muted-foreground"
              )}>
                {finesBalance >= 0 ? '+' : ''}€{finesBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Unlinked Fines Card */}
        {unlinkedFines.length > 0 && (
          <Card className="shadow-card">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold text-sm">Unlinked Fines</span>
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  {unlinkedFines.length}
                </Badge>
              </div>
              <div className="text-lg font-bold mb-2">
                €{unlinkedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className="flex gap-2 text-xs">
                <Badge variant="outline" className="bg-success/10 text-success text-xs">
                  {unlinkedPaidCount} paid
                </Badge>
                <Badge variant="outline" className="bg-warning/10 text-warning text-xs">
                  {unlinkedUnpaidCount} unpaid
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

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
                          ✓ Client paid €{Number(fine.payments[0].amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} on {format(new Date(fine.payments[0].paid_at), "PP")}
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
                      <div className="flex-1 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          {cardContent}
                        </div>
                        {/* Treatment actions for unlinked fines */}
                        <div className="space-y-3 pt-2 border-t">
                          {fine.document_url && (
                            <FineDocumentPreview 
                              fineId={fine.id}
                              documentUrl={fine.document_url}
                              displayName={fine.display_name || 'Fine Document'}
                            />
                          )}
                          {!isReadOnly && (
                            <>
                              <FinePaymentProof 
                                fineId={fine.id}
                                currentProofUrl={fine.payment_proof_url || undefined}
                              />
                              <div className="flex justify-end pt-2">
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Cancel Fine
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Cancel this fine?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will remove the fine from the list. You can restore it from the Trash if needed.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Keep Fine</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteFine.mutate(fine.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Cancel Fine
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </>
                          )}
                        </div>
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
