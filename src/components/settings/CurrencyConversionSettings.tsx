import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserViewScope } from "@/hooks/useUserViewScope";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, RefreshCw, TrendingUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";

export const CurrencyConversionSettings = () => {
  const [newRate, setNewRate] = useState("");
  const queryClient = useQueryClient();
  const { isReadOnly } = useUserViewScope();

  // Fetch current rate
  const { data: currentRate, isLoading: loadingCurrent } = useQuery({
    queryKey: ['current-conversion-rate'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('currency_conversion_rates')
        .select('*')
        .eq('from_currency', 'EUR')
        .eq('to_currency', 'CHF')
        .order('effective_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Fetch rate history
  const { data: rateHistory, isLoading: loadingHistory } = useQuery({
    queryKey: ['conversion-rate-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('currency_conversion_rates')
        .select('*')
        .eq('from_currency', 'EUR')
        .eq('to_currency', 'CHF')
        .order('effective_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
  });

  // Manual rate update
  const updateRateMutation = useMutation({
    mutationFn: async (rate: number) => {
      const { data, error } = await supabase.functions.invoke('update-conversion-rate', {
        body: { rate, manual: true },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-conversion-rate'] });
      queryClient.invalidateQueries({ queryKey: ['conversion-rate-history'] });
      toast.success('Conversion rate updated successfully');
      setNewRate("");
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update conversion rate');
    },
  });

  // Fetch latest rate from API
  const fetchLatestMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('update-conversion-rate', {
        body: { fetch_from_api: true },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['current-conversion-rate'] });
      queryClient.invalidateQueries({ queryKey: ['conversion-rate-history'] });
      toast.success(`Latest rate fetched: ${data.rate} EUR/CHF`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to fetch latest rate');
    },
  });

  const handleManualUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    const rate = parseFloat(newRate);
    if (isNaN(rate) || rate <= 0) {
      toast.error('Please enter a valid rate');
      return;
    }
    updateRateMutation.mutate(rate);
  };

  return (
    <div className="space-y-6">
      {/* Current Rate Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Current Exchange Rate
          </CardTitle>
          <CardDescription>EUR to CHF conversion rate</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingCurrent ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : currentRate ? (
            <div className="space-y-2">
              <div className="text-4xl font-bold text-primary">
                {currentRate.rate.toFixed(4)}
              </div>
              <div className="text-sm text-muted-foreground">
                Effective from: {format(new Date(currentRate.effective_date), 'PPP')}
              </div>
              <div className="text-xs text-muted-foreground">
                Source: {currentRate.source || 'Manual'}
                {currentRate.created_by && ` • Updated by staff`}
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground">No rate configured</div>
          )}
        </CardContent>
      </Card>

      {/* Manual Rate Entry */}
      <Card>
        <CardHeader>
          <CardTitle>Update Exchange Rate</CardTitle>
          <CardDescription>
            Set a new EUR to CHF conversion rate manually or fetch from API
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <form onSubmit={handleManualUpdate} className="flex-1 flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <Label htmlFor="rate" className="sr-only">
                  Rate
                </Label>
                <Input
                  id="rate"
                  type="number"
                  step="0.0001"
                  placeholder="e.g., 0.9500"
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value)}
                  disabled={updateRateMutation.isPending || isReadOnly}
                />
              </div>
              <Button
                type="submit"
                disabled={updateRateMutation.isPending || !newRate || isReadOnly}
              >
                {updateRateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Set Rate'
                )}
              </Button>
            </form>

            <Button
              variant="outline"
              onClick={() => fetchLatestMutation.mutate()}
              disabled={fetchLatestMutation.isPending || isReadOnly}
            >
              {fetchLatestMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Fetching...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Fetch Latest
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            The rate will be effective immediately for all new conversions
          </p>
        </CardContent>
      </Card>

      {/* Rate History */}
      <Card>
        <CardHeader>
          <CardTitle>Rate History</CardTitle>
          <CardDescription>
            Historical exchange rates (last 20 entries)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : rateHistory && rateHistory.length > 0 ? (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rate</TableHead>
                  <TableHead>Effective Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rateHistory.map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell className="font-mono font-semibold">
                      {rate.rate.toFixed(4)}
                    </TableCell>
                    <TableCell>
                      {format(new Date(rate.effective_date), 'PPP')}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {rate.source || 'manual'}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(rate.created_at), 'PPp')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No rate history available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
