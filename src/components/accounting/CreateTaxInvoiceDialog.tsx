import { useState, useEffect } from "react";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle, ResponsiveDialogDescription } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

interface CreateTaxInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentId?: string;
  bookingId?: string;
  mode?: 'from_receipt' | 'standalone';
}

export function CreateTaxInvoiceDialog({
  open,
  onOpenChange,
  paymentId,
  bookingId,
  mode = 'standalone'
}: CreateTaxInvoiceDialogProps) {
  const queryClient = useQueryClient();
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unit_price: 0, amount: 0 }
  ]);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [currency, setCurrency] = useState<string>('EUR');
  const [vatRate, setVatRate] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [selectedBookingId, setSelectedBookingId] = useState<string | undefined>(bookingId);

  // Fetch payment data if creating from receipt
  const { data: paymentData } = useQuery({
    queryKey: ['payment-for-invoice', paymentId],
    queryFn: async () => {
      if (!paymentId) return null;
      const { data, error } = await supabase
        .from('payments')
        .select('*, bookings(*)')
        .eq('id', paymentId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!paymentId && open
  });

  // Fetch booking data if creating from booking
  const { data: bookingData } = useQuery({
    queryKey: ['booking-for-invoice', selectedBookingId],
    queryFn: async () => {
      if (!selectedBookingId) return null;
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', selectedBookingId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedBookingId && open
  });

  // Pre-fill form when payment/booking data loads
  useEffect(() => {
    if (paymentData && mode === 'from_receipt') {
      const booking = paymentData.bookings;
      setClientName(booking?.client_name || '');
      setClientEmail(booking?.client_email || '');
      setBillingAddress(booking?.billing_address || '');
      setCurrency(paymentData.currency || 'EUR');
      setSelectedBookingId(paymentData.booking_id);
      
      // Pre-fill line item from payment
      setLineItems([{
        description: `Payment - ${booking?.car_model || 'Car Rental'} (${booking?.reference_code})`,
        quantity: 1,
        unit_price: Number(paymentData.amount),
        amount: Number(paymentData.amount)
      }]);
    } else if (bookingData && !paymentData) {
      setClientName(bookingData.client_name || '');
      setClientEmail(bookingData.client_email || '');
      setBillingAddress(bookingData.billing_address || '');
    }
  }, [paymentData, bookingData, mode]);

  const addLineItem = () => {
    setLineItems([...lineItems, { description: '', quantity: 1, unit_price: 0, amount: 0 }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-calculate amount
    if (field === 'quantity' || field === 'unit_price') {
      updated[index].amount = updated[index].quantity * updated[index].unit_price;
    }
    
    setLineItems(updated);
  };

  // Prices include VAT - calculate backwards
  const calculateTotal = () => {
    return lineItems.reduce((sum, item) => sum + item.amount, 0);
  };

  const calculateNetAmount = () => {
    const total = calculateTotal();
    return total / (1 + vatRate / 100);
  };

  const calculateVAT = () => {
    return calculateTotal() - calculateNetAmount();
  };

  const createInvoiceMutation = useMutation({
    mutationFn: async () => {
      // Get next invoice number
      const { data: invoiceNumber, error: numError } = await supabase
        .rpc('get_next_tax_invoice_number');
      
      if (numError) throw numError;

      const totalAmount = calculateTotal();
      const netAmount = calculateNetAmount();
      const vatAmount = calculateVAT();

      const { data, error } = await supabase
        .from('tax_invoices')
        .insert([{
          invoice_number: invoiceNumber,
          booking_id: selectedBookingId,
          payment_id: paymentId,
          client_name: clientName,
          client_email: clientEmail || null,
          billing_address: billingAddress || null,
          line_items: lineItems as any,
          subtotal: netAmount,
          vat_rate: vatRate,
          vat_amount: vatAmount,
          total_amount: totalAmount,
          currency,
          notes: notes || null
        }])
        .select()
        .single();

      if (error) throw error;

      // Generate PDF immediately after creating invoice
      try {
        await supabase.functions.invoke('generate-tax-invoice-pdf', {
          body: { invoice_id: data.id }
        });
      } catch (pdfError) {
        console.error('PDF generation error:', pdfError);
        toast.warning("Invoice created but PDF generation failed. You can regenerate it from the invoice list.");
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tax-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['payments-to-review'] });
      queryClient.invalidateQueries({ queryKey: ['booking-tax-invoices'] });
      toast.success(`Tax invoice ${data.invoice_number} created successfully`);
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error('Failed to create invoice: ' + error.message);
    }
  });

  const resetForm = () => {
    setLineItems([{ description: '', quantity: 1, unit_price: 0, amount: 0 }]);
    setClientName('');
    setClientEmail('');
    setBillingAddress('');
    setCurrency('EUR');
    setVatRate(0);
    setNotes('');
    setSelectedBookingId(undefined);
  };

  const isValid = clientName && lineItems.every(item => item.description && item.amount > 0);

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {mode === 'from_receipt' ? 'Create Tax Invoice from Receipt' : 'Create Tax Invoice'}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Create a formal tax invoice for accounting purposes
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-4 px-1">
          <div>
            <Label htmlFor="client-name">Client Name *</Label>
            <Input
              id="client-name"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Enter client name"
            />
          </div>

          <div>
            <Label htmlFor="client-email">Client Email</Label>
            <Input
              id="client-email"
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="client@example.com"
            />
          </div>

          <div>
            <Label htmlFor="billing-address">Billing Address</Label>
            <Textarea
              id="billing-address"
              value={billingAddress}
              onChange={(e) => setBillingAddress(e.target.value)}
              placeholder="Enter billing address"
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="currency">Currency *</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EUR">EUR (€)</SelectItem>
                <SelectItem value="CHF">CHF (Fr.)</SelectItem>
                <SelectItem value="USD">USD ($)</SelectItem>
                <SelectItem value="GBP">GBP (£)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <Label>Line Items *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                <Plus className="w-4 h-4 mr-1" />
                Add Item
              </Button>
            </div>

            {lineItems.map((item, index) => (
              <div key={index} className="flex flex-col gap-3 p-3 border rounded-lg md:grid md:grid-cols-12 md:gap-2 md:items-start md:p-0 md:border-0">
                <div className="md:col-span-5">
                  <Label className="md:hidden text-xs text-muted-foreground">Description</Label>
                  <Input
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="md:hidden text-xs text-muted-foreground">Quantity</Label>
                  <Input
                    type="number"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => updateLineItem(index, 'quantity', Number(e.target.value))}
                    min="1"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="md:hidden text-xs text-muted-foreground">Unit Price (incl. VAT)</Label>
                  <Input
                    type="number"
                    placeholder="Price"
                    value={item.unit_price}
                    onChange={(e) => updateLineItem(index, 'unit_price', Number(e.target.value))}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="md:hidden text-xs text-muted-foreground">Total (incl. VAT)</Label>
                  <Input
                    type="number"
                    placeholder="Total"
                    value={item.amount}
                    disabled
                  />
                </div>
                <div className="md:col-span-1">
                  {lineItems.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLineItem(index)}
                      className="w-full md:w-auto"
                    >
                      <Trash2 className="w-4 h-4 md:mr-0 mr-2" />
                      <span className="md:hidden">Remove</span>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div>
            <Label htmlFor="vat-rate">VAT Rate</Label>
            <Select value={vatRate.toString()} onValueChange={(val) => setVatRate(Number(val))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0% (No VAT)</SelectItem>
                <SelectItem value="8.1">8.1%</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-lg p-4 space-y-2 bg-muted/50">
            <div className="flex justify-between text-sm">
              <span>Net Amount:</span>
              <span className="font-medium">{currency} {calculateNetAmount().toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>VAT ({vatRate}%):</span>
              <span className="font-medium">{currency} {calculateVAT().toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base md:text-lg font-bold border-t pt-2">
              <span>Total (incl. VAT):</span>
              <span>{currency} {calculateTotal().toFixed(2)}</span>
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes for this invoice"
              rows={3}
            />
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button
            onClick={() => createInvoiceMutation.mutate()}
            disabled={!isValid || createInvoiceMutation.isPending}
            className="w-full sm:w-auto"
          >
            {createInvoiceMutation.isPending && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            Create Invoice
          </Button>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
