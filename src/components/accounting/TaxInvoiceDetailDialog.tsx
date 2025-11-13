import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Edit, Download } from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { TaxInvoicePDF } from "./TaxInvoicePDF";

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
  pdf_url: string | null;
  notes: string | null;
  bookings?: {
    reference_code: string;
    car_model: string;
  };
}

interface TaxInvoiceDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: TaxInvoice | null;
  onEdit?: (invoice: TaxInvoice) => void;
}

export function TaxInvoiceDetailDialog({
  open,
  onOpenChange,
  invoice,
  onEdit
}: TaxInvoiceDetailDialogProps) {
  // Fetch app settings for PDF generation
  const { data: appSettings } = useQuery({
    queryKey: ['app-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  if (!invoice) return null;

  const formatCurrency = (amount: number) => {
    return `${invoice.currency} ${Number(amount).toFixed(2)}`;
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Tax Invoice {invoice.invoice_number}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <div className="space-y-6 px-1">
          {/* Invoice Header Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Invoice Date</p>
              <p className="font-medium">{format(new Date(invoice.invoice_date), 'PPP')}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Invoice Number</p>
              <p className="font-medium">{invoice.invoice_number}</p>
            </div>
            {invoice.bookings && (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">Booking Reference</p>
                  <p className="font-medium">{invoice.bookings.reference_code}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Vehicle</p>
                  <p className="font-medium">{invoice.bookings.car_model}</p>
                </div>
              </>
            )}
            {(invoice as any).rental_description && (
              <div>
                <p className="text-sm text-muted-foreground">Rental Description</p>
                <p className="font-medium">{(invoice as any).rental_description}</p>
              </div>
            )}
            {((invoice as any).delivery_location || (invoice as any).collection_location) && (
              <div className="md:col-span-2">
                <p className="text-sm text-muted-foreground">Locations</p>
                <p className="font-medium">
                  {(invoice as any).delivery_location || 'N/A'} → {(invoice as any).collection_location || 'N/A'}
                </p>
              </div>
            )}
            {((invoice as any).rental_start_date || (invoice as any).rental_end_date) && (
              <div className="md:col-span-2">
                <p className="text-sm text-muted-foreground">Rental Period</p>
                <p className="font-medium">
                  {(invoice as any).rental_start_date ? format(new Date((invoice as any).rental_start_date), 'dd/MM/yyyy') : 'N/A'} - {(invoice as any).rental_end_date ? format(new Date((invoice as any).rental_end_date), 'dd/MM/yyyy') : 'N/A'}
                </p>
              </div>
            )}
          </div>

          {/* Client Information */}
          <div className="space-y-3">
            <h3 className="font-semibold text-base">Client Information</h3>
            <div className="grid grid-cols-1 gap-3 p-4 border rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Client Name</p>
                <p className="font-medium">{invoice.client_name}</p>
              </div>
              {invoice.client_email && (
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{invoice.client_email}</p>
                </div>
              )}
              {invoice.billing_address && (
                <div>
                  <p className="text-sm text-muted-foreground">Billing Address</p>
                  <p className="font-medium whitespace-pre-line">{invoice.billing_address}</p>
                </div>
              )}
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-3">
            <h3 className="font-semibold text-base">Line Items</h3>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50%]">Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.line_items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Totals */}
          <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
            <div className="flex justify-between text-sm">
              <span>Subtotal (Net):</span>
              <span className="font-medium">{formatCurrency(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>VAT ({invoice.vat_rate}%):</span>
              <span className="font-medium">{formatCurrency(invoice.vat_amount)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Total (incl. VAT):</span>
              <span>{formatCurrency(invoice.total_amount)}</span>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="space-y-2">
              <h3 className="font-semibold text-base">Notes</h3>
              <div className="p-4 border rounded-lg bg-muted/20">
                <p className="text-sm whitespace-pre-line">{invoice.notes}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2 justify-end pt-4 border-t">
            {onEdit && (
              <Button
                variant="outline"
                onClick={() => {
                  onEdit(invoice);
                  onOpenChange(false);
                }}
                className="w-full sm:w-auto"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Invoice
              </Button>
            )}
            
            <PDFDownloadLink 
              document={<TaxInvoicePDF invoice={invoice} appSettings={appSettings || undefined} />}
              fileName={`tax-invoice-${invoice.invoice_number}.pdf`}
              className="w-full sm:w-auto"
            >
              {({ loading }) => (
                <Button variant="outline" className="w-full" disabled={loading}>
                  <Download className="h-4 w-4 mr-2" />
                  {loading ? 'Preparing PDF...' : 'Download PDF'}
                </Button>
              )}
            </PDFDownloadLink>
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
