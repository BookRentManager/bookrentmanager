import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";

const fineSchema = z.object({
  fine_number: z.string().min(1, "Fine number is required").max(100),
  car_plate: z.string().min(1, "Car plate is required").max(20),
  issue_date: z.string().min(1, "Issue date is required"),
  amount: z.string().min(1, "Amount is required"),
  payment_status: z.enum(["paid", "unpaid"]),
});

type FineFormValues = z.infer<typeof fineSchema>;

export function AddFineDialog() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<FineFormValues>({
    resolver: zodResolver(fineSchema),
    defaultValues: {
      fine_number: "",
      car_plate: "",
      issue_date: new Date().toISOString().split('T')[0],
      amount: "",
      payment_status: "unpaid",
    },
  });

  const addFineMutation = useMutation({
    mutationFn: async (values: FineFormValues) => {
      const { error } = await supabase
        .from("fines")
        .insert({
          fine_number: values.fine_number,
          car_plate: values.car_plate,
          issue_date: values.issue_date,
          amount: parseFloat(values.amount),
          payment_status: values.payment_status,
          currency: "EUR",
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fines"] });
      toast.success("Fine added successfully");
      form.reset();
      setOpen(false);
    },
    onError: (error) => {
      console.error('Add fine error:', error);
      toast.error("Failed to add fine");
    },
  });

  const onSubmit = (values: FineFormValues) => {
    addFineMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Fine
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Fine</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fine_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fine Number *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., FINE-2024-001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="car_plate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Car Plate *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., ZH-12345" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="issue_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Issue Date *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (EUR) *</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="0.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="payment_status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Status *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="unpaid">Unpaid</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addFineMutation.isPending}>
                {addFineMutation.isPending ? "Adding..." : "Add Fine"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
