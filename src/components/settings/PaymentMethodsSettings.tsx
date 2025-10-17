import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreditCard, Pencil, Save, X } from "lucide-react";

interface PaymentMethod {
  id: string;
  method_type: string;
  display_name: string;
  description: string;
  fee_percentage: number;
  currency: string;
  requires_conversion: boolean;
  is_enabled: boolean;
  admin_only: boolean;
  sort_order: number;
}

export const PaymentMethodsSettings = () => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<PaymentMethod>>({});

  const { data: paymentMethods, isLoading } = useQuery({
    queryKey: ["payment_methods_admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .order("sort_order");

      if (error) throw error;
      return data as PaymentMethod[];
    },
  });

  const { data: conversionRates } = useQuery({
    queryKey: ["conversion_rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("currency_conversion_rates")
        .select("*")
        .order("effective_date", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const updateMethodMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<PaymentMethod> }) => {
      const { error } = await supabase
        .from("payment_methods")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment_methods_admin"] });
      toast.success("Payment method updated");
      setEditingId(null);
      setEditValues({});
    },
    onError: (error) => {
      console.error("Update error:", error);
      toast.error("Failed to update payment method");
    },
  });

  const addConversionRateMutation = useMutation({
    mutationFn: async ({ fromCurrency, toCurrency, rate }: { fromCurrency: string; toCurrency: string; rate: number }) => {
      const { error } = await supabase
        .from("currency_conversion_rates")
        .insert({
          from_currency: fromCurrency,
          to_currency: toCurrency,
          rate,
          effective_date: new Date().toISOString().split('T')[0],
          source: 'manual',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversion_rates"] });
      toast.success("Conversion rate added");
    },
    onError: (error) => {
      console.error("Add rate error:", error);
      toast.error("Failed to add conversion rate");
    },
  });

  const handleEdit = (method: PaymentMethod) => {
    setEditingId(method.id);
    setEditValues({
      fee_percentage: method.fee_percentage,
      is_enabled: method.is_enabled,
    });
  };

  const handleSave = (id: string) => {
    updateMethodMutation.mutate({ id, updates: editValues });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValues({});
  };

  const handleToggleEnabled = (id: string, currentValue: boolean) => {
    updateMethodMutation.mutate({ id, updates: { is_enabled: !currentValue } });
  };

  if (isLoading) {
    return <div>Loading payment methods...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            <CardTitle>Payment Methods</CardTitle>
          </div>
          <CardDescription>
            Configure payment methods, fees, and currency conversion rates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Method</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Fee %</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Admin Only</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentMethods?.map((method) => (
                <TableRow key={method.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{method.display_name}</div>
                      <div className="text-sm text-muted-foreground">{method.description}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{method.currency}</Badge>
                    {method.requires_conversion && (
                      <Badge variant="secondary" className="ml-2">Conversion</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === method.id ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={editValues.fee_percentage ?? method.fee_percentage}
                        onChange={(e) =>
                          setEditValues({ ...editValues, fee_percentage: parseFloat(e.target.value) })
                        }
                        className="w-20"
                      />
                    ) : (
                      <span>{method.fee_percentage}%</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={editingId === method.id ? (editValues.is_enabled ?? method.is_enabled) : method.is_enabled}
                      onCheckedChange={() =>
                        editingId === method.id
                          ? setEditValues({ ...editValues, is_enabled: !editValues.is_enabled })
                          : handleToggleEnabled(method.id, method.is_enabled)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    {method.admin_only ? (
                      <Badge variant="secondary">Admin</Badge>
                    ) : (
                      <Badge variant="outline">Public</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {editingId === method.id ? (
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" onClick={() => handleSave(method.id)}>
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={handleCancel}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(method)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Conversion Rates */}
      <Card>
        <CardHeader>
          <CardTitle>Currency Conversion Rates</CardTitle>
          <CardDescription>
            Latest conversion rates for payment methods requiring currency conversion
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {conversionRates?.slice(0, 5).map((rate) => (
              <div key={rate.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">
                    {rate.from_currency} → {rate.to_currency}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Rate: {rate.rate} | Effective: {new Date(rate.effective_date).toLocaleDateString()}
                  </div>
                </div>
                <Badge variant="outline">{rate.source}</Badge>
              </div>
            ))}
            
            <Separator />
            
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Add New Rate</h4>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  addConversionRateMutation.mutate({
                    fromCurrency: formData.get('from') as string,
                    toCurrency: formData.get('to') as string,
                    rate: parseFloat(formData.get('rate') as string),
                  });
                  e.currentTarget.reset();
                }}
                className="grid grid-cols-4 gap-3"
              >
                <div>
                  <Label htmlFor="from">From</Label>
                  <Input id="from" name="from" placeholder="EUR" required />
                </div>
                <div>
                  <Label htmlFor="to">To</Label>
                  <Input id="to" name="to" placeholder="CHF" required />
                </div>
                <div>
                  <Label htmlFor="rate">Rate</Label>
                  <Input id="rate" name="rate" type="number" step="0.0001" placeholder="1.0850" required />
                </div>
                <div className="flex items-end">
                  <Button type="submit" className="w-full">Add Rate</Button>
                </div>
              </form>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};