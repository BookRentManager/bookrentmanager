import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";

export default function Fines() {
  const [filter, setFilter] = useState<"all" | "paid" | "unpaid">("all");
  const { data: fines, isLoading } = useQuery({
    queryKey: ["fines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fines")
        .select("*")
        .is("deleted_at", null)
        .order("issue_date", { ascending: false });

      if (error) throw error;
      return data;
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Fines</h2>
          <p className="text-muted-foreground">Track and manage traffic fines</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Fine
        </Button>
      </div>

      {unpaidFines && unpaidFines.length > 0 && (
        <Card className="shadow-card border-warning/20 bg-warning/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              <CardTitle className="text-warning">Pending Fines</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
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
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Fines</CardTitle>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | "paid" | "unpaid")} className="w-auto">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="unpaid">Unpaid</TabsTrigger>
                <TabsTrigger value="paid">Paid</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredFines && filteredFines.length > 0 ? (
              filteredFines.map((fine) => (
                <div
                  key={fine.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{fine.fine_number}</span>
                      <Badge
                        variant={fine.payment_status === "paid" ? "default" : "outline"}
                        className={fine.payment_status === "paid" ? "bg-success text-success-foreground" : "bg-warning/10 text-warning border-warning/20"}
                      >
                        {fine.payment_status}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {fine.car_plate} • Issued: {format(new Date(fine.issue_date), "PPP")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">€{Number(fine.amount).toLocaleString()}</div>
                  </div>
                </div>
              ))
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
