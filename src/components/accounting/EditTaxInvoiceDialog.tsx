import { useState, useEffect } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
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

interface TaxInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  client_name: string;
  client_email: string | null;
  billing_address: string | null;
  line_items: LineItem[];
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total_amount: number;
  currency: string;
  notes: string | null;
  status: string;
}

interface EditTaxInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: TaxInvoice | null;
}

export function EditTaxInvoiceDialog({
  open,
  onOpenChange,
  invoice
}: EditTaxInvoiceDialogProps) {
  const queryClient = useQueryClient();
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unit_price: 0, amount: 0 }
  ]);
  const [invoiceDate, setInvoiceDate] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [currency, setCurrency] = useState<string>('EUR');
  const [vatRate, setVatRate] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<string>('issued');

  // Pre-fill form when invoice loads
  useEffect(() => {
    if (invoice && open) {
      setLineItems(invoice.line_items || [{ description: '', quantity: 1, unit_price: 0, amount: 0 }]);
      setInvoiceDate(invoice.invoice_date);
      setClientName(invoice.client_name || '');
      setClientEmail(invoice.client_email || '');
      setBillingAddress(invoice.billing_address || '');
      setCurrency(invoice.currency || 'EUR');
      setVatRate(invoice.vat_rate || 0);
      setNotes(invoice.notes || '');
      setStatus(invoice.status || 'issued');
    }
  }, [invoice, open]);

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

  const updateInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!invoice) throw new Error('No invoice to update');

      const totalAmount = calculateTotal();
      const netAmount = calculateNetAmount();
      const vatAmount = calculateVAT();

      const { data, error } = await supabase
        .from('tax_invoices')
        .update({
          invoice_date: invoiceDate,
          client_name: clientName,
          client_email: clientEmail || null,
          billing_address: billingAddress || null,
          line_items: lineItems as any,
          subtotal: netAmount,
          vat_rate: vatRate,
          vat_amount: vatAmount,
          total_amount: totalAmount,
          currency,
          notes: notes || null,
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', invoice.id)
        .select()
        .single();

      if (error) throw error;

      // Regenerate PDF after updating invoice
      try {
        await supabase.functions.invoke('generate-tax-invoice-pdf', {
          body: { invoice_id: data.id }
        });
      } catch (pdfError) {
        console.error('PDF generation error:', pdfError);
        toast.warning("Invoice updated but PDF regeneration failed. You can regenerate it from the invoice list.");
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tax-invoices'] });
      toast.success(`Tax invoice ${data.invoice_number} updated successfully`);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error('Failed to update invoice: ' + error.message);
    }
  });

  const isValid = clientName && lineItems.every(item => item.description && item.amount > 0) && invoiceDate;

  if (!invoice) return null;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            Edit Tax Invoice {invoice.invoice_number}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Update invoice details, line items, and client information
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-4 px-1">
          <div>
            <Label htmlFor="invoice-date">Invoice Date *</Label>
            <Input
              id="invoice-date"
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </div>

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

          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="issued">Issued</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
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
            onClick={() => updateInvoiceMutation.mutate()}
            disabled={!isValid || updateInvoiceMutation.isPending}
            className="w-full sm:w-auto"
          >
            {updateInvoiceMutation.isPending && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            Save Changes
          </Button>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}