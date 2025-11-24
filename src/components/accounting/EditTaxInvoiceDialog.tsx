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
import { Card } from "@/components/ui/card";

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
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [currency, setCurrency] = useState<string>('EUR');
  const [vatRate, setVatRate] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<string>('issued');
  
  // Rental detail fields
  const [rentalDescription, setRentalDescription] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [collectionLocation, setCollectionLocation] = useState('');
  const [rentalStartDate, setRentalStartDate] = useState('');
  const [rentalEndDate, setRentalEndDate] = useState('');

  // Pre-fill form when invoice loads
  useEffect(() => {
    if (invoice && open) {
      setLineItems(invoice.line_items || [{ description: '', quantity: 1, unit_price: 0, amount: 0 }]);
      setInvoiceDate(invoice.invoice_date);
      setInvoiceNumber(invoice.invoice_number);
      setClientName(invoice.client_name || '');
      setClientEmail(invoice.client_email || '');
      setBillingAddress(invoice.billing_address || '');
      setCurrency(invoice.currency || 'EUR');
      setVatRate(invoice.vat_rate || 0);
      setNotes(invoice.notes || '');
      setStatus(invoice.status || 'issued');
      
      // Pre-fill rental details
      setRentalDescription((invoice as any).rental_description || '');
      setDeliveryLocation((invoice as any).delivery_location || '');
      setCollectionLocation((invoice as any).collection_location || '');
      setRentalStartDate((invoice as any).rental_start_date || '');
      setRentalEndDate((invoice as any).rental_end_date || '');
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
          rental_description: rentalDescription || null,
          delivery_location: deliveryLocation || null,
          collection_location: collectionLocation || null,
          rental_start_date: rentalStartDate || null,
          rental_end_date: rentalEndDate || null,
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
      <ResponsiveDialogContent className="w-full sm:max-w-6xl max-h-[90vh] overflow-y-auto">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            Edit Tax Invoice {invoice.invoice_number}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Update invoice details, line items, and client information. PDF will be regenerated.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-4">
          {/* Left Column - Client & Invoice Details */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
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
                <Label htmlFor="currency-edit">Currency *</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger id="currency-edit">
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

            {/* Rental Details Section */}
            <div className="border rounded-lg p-4 space-y-3">
              <Label className="font-semibold">Rental Details (Optional)</Label>
              
              <div>
                <Label htmlFor="rental-description">Rental Description</Label>
                <Input
                  id="rental-description"
                  value={rentalDescription}
                  onChange={(e) => setRentalDescription(e.target.value)}
                  placeholder="e.g., Tesla Model X - 6 days rental"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="delivery-location">Delivery Location</Label>
                  <Input
                    id="delivery-location"
                    value={deliveryLocation}
                    onChange={(e) => setDeliveryLocation(e.target.value)}
                    placeholder="Venice Airport"
                  />
                </div>
                <div>
                  <Label htmlFor="collection-location">Collection Location</Label>
                  <Input
                    id="collection-location"
                    value={collectionLocation}
                    onChange={(e) => setCollectionLocation(e.target.value)}
                    placeholder="Venice Airport"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="rental-start-date">Rental Start Date</Label>
                  <Input
                    id="rental-start-date"
                    type="date"
                    value={rentalStartDate}
                    onChange={(e) => setRentalStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="rental-end-date">Rental End Date</Label>
                  <Input
                    id="rental-end-date"
                    type="date"
                    value={rentalEndDate}
                    onChange={(e) => setRentalEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="vat-rate">VAT Rate (%) *</Label>
                <Input
                  id="vat-rate"
                  type="number"
                  value={vatRate}
                  onChange={(e) => setVatRate(Number(e.target.value))}
                  min="0"
                  step="0.1"
                  placeholder="0"
                />
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="issued">Issued</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes or payment terms"
                rows={2}
              />
            </div>
          </div>

          {/* Right Column - Line Items & Totals */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Line Items *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                <Plus className="w-4 h-4 mr-1" />
                Add Item
              </Button>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-4 py-3 border-b">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Description</div>
                  <div className="grid grid-cols-12 gap-3 text-sm font-medium">
                    <div className="col-span-2 text-center">Qty</div>
                    <div className="col-span-4 text-center">Unit Price (incl. VAT)</div>
                    <div className="col-span-4 text-center">Total</div>
                    <div className="col-span-2"></div>
                  </div>
                </div>
              </div>
              <div className="divide-y">
                {lineItems.map((item, index) => (
                  <div key={index} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div className="space-y-2">
                      {/* Row 1: Description (full width) */}
                      <div>
                        <Input
                          placeholder="Item description"
                          value={item.description}
                          onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                          className="h-9 w-full"
                        />
                      </div>
                      
                      {/* Row 2: Qty, Unit Price, Total, Actions */}
                      <div className="grid grid-cols-12 gap-3 items-center">
                        <div className="col-span-2">
                          <Input
                            type="number"
                            placeholder="1"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(index, 'quantity', Number(e.target.value))}
                            min="1"
                            className="h-9 text-center"
                          />
                        </div>
                        <div className="col-span-4">
                          <Input
                            type="number"
                            placeholder="0.00"
                            value={item.unit_price}
                            onChange={(e) => updateLineItem(index, 'unit_price', Number(e.target.value))}
                            min="0"
                            step="0.01"
                            className="h-9 text-center"
                          />
                        </div>
                        <div className="col-span-4">
                          <Input
                            type="number"
                            value={item.amount.toFixed(2)}
                            disabled
                            className="h-9 text-center bg-muted/50 font-medium"
                          />
                        </div>
                        <div className="col-span-2 flex justify-center">
                          {lineItems.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeLineItem(index)}
                              className="h-9 w-9 p-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {lineItems.map((item, index) => (
                <Card key={index} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">Line Item {index + 1}</span>
                      {lineItems.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLineItem(index)}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Description</Label>
                        <Input
                          placeholder="Item description"
                          value={item.description}
                          onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">Quantity</Label>
                          <Input
                            type="number"
                            placeholder="1"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(index, 'quantity', Number(e.target.value))}
                            min="1"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Unit Price</Label>
                          <Input
                            type="number"
                            placeholder="0.00"
                            value={item.unit_price}
                            onChange={(e) => updateLineItem(index, 'unit_price', Number(e.target.value))}
                            min="0"
                            step="0.01"
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Total</Label>
                        <Input
                          type="number"
                          value={item.amount.toFixed(2)}
                          disabled
                          className="mt-1 bg-muted/50 font-medium"
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Calculated Totals */}
            <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
              <div className="flex justify-between text-sm">
                <span>Subtotal (Net):</span>
                <span className="font-medium">{currency} {calculateNetAmount().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>VAT ({vatRate}%):</span>
                <span className="font-medium">{currency} {calculateVAT().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total (incl. VAT):</span>
                <span>{currency} {calculateTotal().toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-4 px-1 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => updateInvoiceMutation.mutate()} 
            disabled={!isValid || updateInvoiceMutation.isPending}
          >
            {updateInvoiceMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
