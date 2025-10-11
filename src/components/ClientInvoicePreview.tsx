import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer';
import { ClientInvoicePDF } from './ClientInvoicePDF';
import { Button } from './ui/button';
import { Download, FileText, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
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
} from './ui/alert-dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ClientInvoicePreviewProps {
  invoice: {
    id: string;
    booking_id: string;
    invoice_number: string;
    client_name: string;
    billing_address: string | null;
    subtotal: number;
    vat_rate: number;
    vat_amount: number;
    total_amount: number;
    issue_date: string;
    notes: string | null;
  };
  booking?: {
    reference_code: string;
    car_model: string;
    car_plate: string;
    delivery_datetime: string;
    collection_datetime: string;
  };
}

export function ClientInvoicePreview({ invoice, booking }: ClientInvoicePreviewProps) {
  const queryClient = useQueryClient();

  const deleteInvoiceMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('client_invoices')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', invoice.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-invoices', invoice.booking_id] });
      queryClient.invalidateQueries({ queryKey: ['booking', invoice.booking_id] });
      toast.success('Client invoice cancelled successfully');
    },
    onError: (error) => {
      console.error('Delete client invoice error:', error);
      toast.error('Failed to cancel client invoice');
    },
  });

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoice Preview - {invoice.invoice_number}
          </CardTitle>
          <div className="flex gap-2">
            <PDFDownloadLink
              document={<ClientInvoicePDF invoice={invoice} booking={booking} />}
              fileName={`${invoice.invoice_number}.pdf`}
            >
              {({ loading }) => (
                <Button size="sm" variant="outline" disabled={loading}>
                  <Download className="h-4 w-4 mr-2" />
                  {loading ? 'Preparing...' : 'Download PDF'}
                </Button>
              )}
            </PDFDownloadLink>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Do you really want to cancel this invoice? This action will mark the invoice as deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>No, keep it</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteInvoiceMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Yes, cancel invoice
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden" style={{ height: '600px' }}>
          <PDFViewer width="100%" height="100%" showToolbar={false}>
            <ClientInvoicePDF invoice={invoice} booking={booking} />
          </PDFViewer>
        </div>
      </CardContent>
    </Card>
  );
}
