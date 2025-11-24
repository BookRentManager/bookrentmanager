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
import { Card } from "@/components/ui/card";

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
  
  // Rental detail fields
  const [rentalDescription, setRentalDescription] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [collectionLocation, setCollectionLocation] = useState('');
  const [rentalStartDate, setRentalStartDate] = useState('');
  const [rentalEndDate, setRentalEndDate] = useState('');

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
      
      // Pre-fill rental details from booking
      if (booking) {
        const deliveryDate = new Date(booking.delivery_datetime);
        const collectionDate = new Date(booking.collection_datetime);
        const days = Math.ceil((collectionDate.getTime() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24));
        
        setRentalDescription(`${booking.car_model} - ${days} days rental`);
        setDeliveryLocation(booking.delivery_location || '');
        setCollectionLocation(booking.collection_location || '');
        setRentalStartDate(booking.delivery_datetime.split('T')[0]);
        setRentalEndDate(booking.collection_datetime.split('T')[0]);
      }
      
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
      
      // Pre-fill rental details from booking
      const deliveryDate = new Date(bookingData.delivery_datetime);
      const collectionDate = new Date(bookingData.collection_datetime);
      const days = Math.ceil((collectionDate.getTime() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24));
      
      setRentalDescription(`${bookingData.car_model} - ${days} days rental`);
      setDeliveryLocation(bookingData.delivery_location || '');
      setCollectionLocation(bookingData.collection_location || '');
      setRentalStartDate(bookingData.delivery_datetime.split('T')[0]);
      setRentalEndDate(bookingData.collection_datetime.split('T')[0]);
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
          notes: notes || null,
          rental_description: rentalDescription || null,
          delivery_location: deliveryLocation || null,
          collection_location: collectionLocation || null,
          rental_start_date: rentalStartDate || null,
          rental_end_date: rentalEndDate || null,
          status: mode === 'from_receipt' ? 'paid' : 'issued'
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
    setRentalDescription('');
    setDeliveryLocation('');
    setCollectionLocation('');
    setRentalStartDate('');
    setRentalEndDate('');
  };

  const isValid = clientName && lineItems.every(item => item.description && item.amount > 0);

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="w-full sm:max-w-6xl max-h-[90vh] overflow-y-auto">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {mode === 'from_receipt' ? 'Create Tax Invoice from Receipt' : 'Create Tax Invoice'}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Create a formal tax invoice for accounting purposes
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-4">
          {/* Left Column - Client & Invoice Details */}
          <div className="space-y-4">
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
                <Label htmlFor="vat-rate">VAT Rate (%)</Label>
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
                <div className="grid grid-cols-12 gap-3 text-sm font-medium">
                  <div className="col-span-5">Description</div>
                  <div className="col-span-2 text-center">Qty</div>
                  <div className="col-span-2 text-center">Unit Price (incl. VAT)</div>
                  <div className="col-span-2 text-center">Total</div>
                  <div className="col-span-1"></div>
                </div>
              </div>
              <div className="divide-y">
                {lineItems.map((item, index) => (
                  <div key={index} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div className="grid grid-cols-12 gap-3 items-center">
                      <div className="col-span-5">
                        <Input
                          placeholder="Item description"
                          value={item.description}
                          onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                          className="h-9"
                        />
                      </div>
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
                      <div className="col-span-2">
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
                      <div className="col-span-2">
                        <Input
                          type="number"
                          value={item.amount.toFixed(2)}
                          disabled
                          className="h-9 text-center bg-muted/50 font-medium"
                        />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        {lineItems.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLineItem(index)}
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
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
                          <Label className="text-xs text-muted-foreground">Unit Price (incl. VAT)</Label>
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
                        <Label className="text-xs text-muted-foreground">Total (auto-calculated)</Label>
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
